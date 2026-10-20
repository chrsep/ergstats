import { AsyncLocalStorage } from "node:async_hooks";

import type { AuthInfo, McpServer } from "@modelcontextprotocol/server";
import { instrument } from "@posthog/mcp";
import type { PostHog } from "posthog-node";

import { deploymentEnvironment, release } from "./config";
import {
  classifyToolError,
  type McpRequestStats,
  oauthClientLabel,
  sanitizeMcpEvent,
} from "./mcp-events";
import { pseudonymFor } from "./pseudonym";
import { captureError, posthogServer } from "./server";

/**
 * MCP usage analytics on top of PostHog's MCP SDK, which records every tool
 * call (`$mcp_tool_call`: tool, client, duration, error) and tool listing.
 * ErgStats adds, per call: how the caller signed in, which app it is, the
 * Concept2 requests the call made, the response size and a failure category,
 * and keeps the athlete's data out (see mcp-events.ts).
 */
export interface McpTelemetry {
  /** Runs one authorized request so its events are attributed to the caller. */
  withRequest(req: Request, authInfo: AuthInfo, run: () => Promise<Response>): Promise<Response>;
  /** Hooks a fresh per-request server, before its tools are registered. */
  instrumentServer(server: McpServer): void;
  /** A tool call failed; unexpected failures are reported to error tracking. */
  toolFailed(error: unknown): void;
  /** fetch for Concept2 API calls: counted and timed per tool call. */
  fetch: typeof fetch;
}

const requests = new AsyncLocalStorage<McpRequestStats>();

function userIdOf(authInfo: AuthInfo): string | undefined {
  const userId = authInfo.extra?.userId;
  return typeof userId === "string" ? userId : undefined;
}

export function createMcpTelemetry(posthog: PostHog | null = posthogServer()): McpTelemetry | undefined {
  if (!posthog) return undefined;
  const environment = deploymentEnvironment();

  const countingFetch: typeof fetch = async (input, init) => {
    const stats = requests.getStore();
    const started = performance.now();
    try {
      const res = await fetch(input, init);
      if (!res.ok && stats) {
        stats.upstreamFailures += 1;
        stats.upstreamStatus = res.status;
      }
      return res;
    } catch (error) {
      if (stats) stats.upstreamFailures += 1;
      throw error;
    } finally {
      if (stats) {
        stats.upstreamRequests += 1;
        stats.upstreamMs += performance.now() - started;
      }
    }
  };

  return {
    fetch: countingFetch,

    withRequest(req, authInfo, run) {
      const userId = userIdOf(authInfo);
      const isApiKey = authInfo.token.startsWith("erg_");
      const stats: McpRequestStats = {
        userId,
        authMethod: isApiKey ? "api_key" : "oauth",
        oauthClient: isApiKey ? undefined : oauthClientLabel(authInfo.clientId),
        upstreamRequests: 0,
        upstreamMs: 0,
        upstreamFailures: 0,
      };
      const distinctId = userId ? pseudonymFor(userId) : undefined;
      return posthog.withContext({ distinctId }, () => requests.run(stats, run));
    },

    instrumentServer(server) {
      // Wrap each tool before the SDK does, so the SDK times the wrapped tool
      // and its event is built after the wrapper has recorded the call's stats.
      const register = server.registerTool.bind(server);
      server.registerTool = ((name: string, config: unknown, callback: (...args: unknown[]) => unknown) =>
        register(
          name,
          config as never,
          (async (...args: unknown[]) => {
            const result = (await callback(...args)) as { content?: unknown; structuredContent?: unknown };
            const stats = requests.getStore();
            if (stats) stats.responseBytes = Buffer.byteLength(JSON.stringify(result.structuredContent ?? result.content ?? ""));
            return result;
          }) as never,
        )) as typeof server.registerTool;

      instrument(server, posthog, {
        serverBuild: release(),
        // Each of these adds an argument to every tool or text to every result.
        // Tools stay exactly as an agent expects, and nothing the agent writes
        // (its intent, a conversation handle, model names) is collected.
        context: false,
        captureModel: false,
        enableConversationId: false,
        // Unexpected failures go to error tracking with a stack from toolFailed().
        enableExceptionAutocapture: false,
        identify: async () => {
          const userId = requests.getStore()?.userId;
          return userId ? { distinctId: pseudonymFor(userId) } : null;
        },
        beforeSend: (event) => sanitizeMcpEvent(event, requests.getStore(), environment),
      });
    },

    toolFailed(error) {
      const category = classifyToolError(error);
      const stats = requests.getStore();
      if (stats) stats.errorCategory = category;
      if (category === "internal") {
        console.error("[mcp] tool failed", error);
        captureError(posthog, error, { source: "mcp_tool", auth_method: stats?.authMethod }, stats?.userId);
      } else if (category === "concept2_unavailable" || category === "concept2_timeout") {
        console.warn("[mcp] Concept2 unavailable", { category, status: stats?.upstreamStatus });
      }
    },
  };
}
