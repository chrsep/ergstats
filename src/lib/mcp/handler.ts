import type { AuthInfo } from "@modelcontextprotocol/server";
import { createMcpHandler } from "mcp-handler";

import { registerTools, SERVER_INSTRUCTIONS, type ToolDeps } from "./tools";

export type KeyCheck =
  | { ok: true; authInfo: AuthInfo }
  | { ok: false; status: 401 | 429; message: string; retryAfterSeconds?: number };

export interface HandlerDeps extends ToolDeps {
  /** Check an API key and resolve it to the user it belongs to. */
  verifyKey: (key: string) => Promise<KeyCheck>;
  /** Where people get a key, linked from auth errors. */
  dashboardUrl: string;
}

export const SERVER_VERSION = "0.1.0";

/** Accept `Authorization: Bearer <key>`, or `X-API-Key: <key>` for clients that only set custom headers. */
export function readApiKey(req: Request): string | undefined {
  const header = req.headers.get("authorization");
  if (header) {
    const [scheme, value] = header.split(" ");
    if (scheme?.toLowerCase() === "bearer" && value) return value.trim();
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
 * The /mcp endpoint: API-key auth in front of a stateless Streamable HTTP MCP
 * server (spec 2026-07-28, with the 2025 fallback mcp-handler provides).
 */
export function createErgstatsMcpHandler(deps: HandlerDeps) {
  const mcp = createMcpHandler((server) => registerTools(server, deps), {
    serverInfo: { name: "ergstats", version: SERVER_VERSION },
    instructions: SERVER_INSTRUCTIONS,
  });

  return async function handler(req: Request): Promise<Response> {
    const key = readApiKey(req);
    if (!key) {
      return jsonError(401, `Missing API key. Create one at ${deps.dashboardUrl} and send it as "Authorization: Bearer <key>".`, {
        "www-authenticate": 'Bearer realm="ergstats"',
      });
    }
    const check = await deps.verifyKey(key);
    if (!check.ok) {
      const headers: Record<string, string> =
        check.status === 401 ? { "www-authenticate": 'Bearer realm="ergstats", error="invalid_token"' } : {};
      if (check.retryAfterSeconds) headers["retry-after"] = String(check.retryAfterSeconds);
      return jsonError(check.status, check.message, headers);
    }
    req.auth = check.authInfo;
    return mcp(req);
  };
}
