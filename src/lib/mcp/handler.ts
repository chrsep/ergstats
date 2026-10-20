import type { AuthInfo } from "@modelcontextprotocol/server";
import { createMcpHandler } from "mcp-handler";

import type { McpTelemetry } from "@/lib/observability/mcp";
import { registerTools, SERVER_INSTRUCTIONS, type ToolDeps } from "./tools";

export type KeyCheck =
  | { ok: true; authInfo: AuthInfo }
  | { ok: false; status: 401 | 429; message: string; retryAfterSeconds?: number };

/** Whether a caller who signed in with OAuth may make one more request now. */
export type QuotaCheck = { ok: true } | { ok: false; retryAfterSeconds: number };

/** Runs the MCP server for a caller whose credentials have been verified. */
export type AuthorizedHandler = (req: Request, authInfo: AuthInfo) => Promise<Response>;

export interface HandlerDeps extends ToolDeps {
  /** Check an API key and resolve it to the user it belongs to. */
  verifyKey: (key: string) => Promise<KeyCheck>;
  /**
   * Handle a request that carries no API key: verify its OAuth access token and
   * call `next`, or answer 401/403 with the challenge that starts sign-in.
   */
  withOAuth: (req: Request, next: AuthorizedHandler) => Promise<Response>;
  /** Count one request against the budget of a caller who signed in with OAuth. API keys carry their own budget. */
  consumeQuota?: (authInfo: AuthInfo) => Promise<QuotaCheck>;
  /** Where people get a key, linked from auth errors. */
  dashboardUrl: string;
  /** RFC 9728 protected resource metadata, so a client holding a bad key can switch to signing in. */
  resourceMetadataUrl: string;
  /** Usage analytics, when PostHog is configured. */
  telemetry?: McpTelemetry;
}

export const SERVER_VERSION = "0.1.0";

export const API_KEY_PREFIX = "erg_";

/**
 * An ErgStats API key from `Authorization: Bearer erg_...`, or `X-API-Key` for
 * clients that only set custom headers. Any other bearer token is an OAuth access token.
 */
export function readApiKey(req: Request): string | undefined {
  const header = req.headers.get("authorization");
  if (header) {
    const [scheme, value] = header.split(" ");
    if (scheme?.toLowerCase() === "bearer" && value?.startsWith(API_KEY_PREFIX)) return value.trim();
  }
  return req.headers.get("x-api-key")?.trim() || undefined;
}

function jsonError(status: number, message: string, headers: Record<string, string> = {}) {
  return Response.json(
    { jsonrpc: "2.0", id: null, error: { code: -32001, message } },
    { status, headers: { "cache-control": "no-store", ...headers } },
  );
}

/**
 * The /mcp endpoint: a stateless Streamable HTTP MCP server (spec 2026-07-28,
 * with the 2025 fallback mcp-handler provides) behind either an OAuth access
 * token, which connectors like Claude and ChatGPT get by signing in, or an API key.
 */
export function createErgstatsMcpHandler(deps: HandlerDeps) {
  const { telemetry } = deps;
  const mcp = createMcpHandler(
    (server) => {
      telemetry?.instrumentServer(server);
      registerTools(server, deps);
    },
    {
      serverInfo: { name: "ergstats", version: SERVER_VERSION },
      instructions: SERVER_INSTRUCTIONS,
      // Every request gets a fresh server with the same fixed tool list, so there is
      // never a list-changed notification to deliver. Saying so stops 2026-07-28
      // clients from opening a `subscriptions/listen` stream after they connect: on
      // Vercel that stream would hold a function open until its 60 s limit, once a
      // minute, for as long as the client stays connected.
      capabilities: { tools: { listChanged: false } },
    },
  );

  const run: AuthorizedHandler = (req, authInfo) => {
    req.auth = authInfo;
    return telemetry ? telemetry.withRequest(req, authInfo, () => mcp(req)) : mcp(req);
  };

  return async function handler(req: Request): Promise<Response> {
    const key = readApiKey(req);
    if (!key) {
      return deps.withOAuth(req, async (request, authInfo) => {
        const quota = deps.consumeQuota ? await deps.consumeQuota(authInfo) : { ok: true as const };
        if (!quota.ok) {
          return jsonError(429, "Too many requests for this account. Slow down and try again shortly.", {
            "retry-after": String(quota.retryAfterSeconds),
          });
        }
        return run(request, authInfo);
      });
    }

    const check = await deps.verifyKey(key);
    if (!check.ok) {
      const headers: Record<string, string> =
        check.status === 401
          ? { "www-authenticate": `Bearer resource_metadata="${deps.resourceMetadataUrl}", error="invalid_token"` }
          : {};
      if (check.retryAfterSeconds) headers["retry-after"] = String(check.retryAfterSeconds);
      return jsonError(check.status, check.message, headers);
    }
    return run(req, check.authInfo);
  };
}
