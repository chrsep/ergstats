import { gunzipSync } from "node:zlib";

import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { PostHog } from "posthog-node";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { allResults, twoK, user } from "@/lib/concept2/__fixtures__/results";
import { Concept2Client } from "@/lib/concept2/client";
import { createErgstatsMcpHandler } from "@/lib/mcp/handler";
import { createMcpTelemetry } from "./mcp";
import { pseudonymFor } from "./pseudonym";

const TOKEN = "oauth-access-token";

vi.stubEnv("BETTER_AUTH_SECRET", "test-secret");

/** Request bodies come as JSON, possibly gzipped, in a string, a Blob or bytes. */
async function decode(body: unknown): Promise<unknown> {
  if (body === undefined || body === null) return null;
  const bytes =
    typeof body === "string"
      ? Buffer.from(body)
      : body instanceof Blob
        ? Buffer.from(await body.arrayBuffer())
        : Buffer.from(body as Uint8Array);
  return JSON.parse((bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes).toString("utf8"));
}

/** What PostHog would have received: event batches and OTLP span exports. */
const sent: { url: string; body: unknown }[] = [];

const posthog = new PostHog("phc_test", {
  host: "https://eu.i.posthog.com",
  flushAt: 1000,
  disableGeoip: true,
  traces: { serviceName: "ergstats-test" },
  fetch: async (url, options) => {
    sent.push({ url, body: await decode(options.body) });
    return { status: 200, text: async () => "{}", json: async () => ({}) };
  },
});

async function concept2(input: RequestInfo | URL): Promise<Response> {
  const url = new URL(input instanceof Request ? input.url : input);
  // A malformed answer, to stand in for a bug: the tool fails in a way nobody planned for.
  if (url.pathname === "/api/users/me") return new Response("<html>", { status: 200 });
  if (url.pathname === "/api/users/me/results") {
    return Response.json({
      data: allResults,
      meta: { pagination: { total: allResults.length, count: allResults.length, per_page: 250, current_page: 1, total_pages: 1 } },
    });
  }
  if (url.pathname === `/api/users/me/results/${twoK.id}`) return Response.json({ data: twoK });
  return new Response("not found", { status: 404 });
}

const telemetry = createMcpTelemetry(posthog)!;

const handler = createErgstatsMcpHandler({
  dashboardUrl: "https://ergstats.test/dashboard",
  resourceMetadataUrl: "https://ergstats.test/.well-known/oauth-protected-resource/mcp",
  today: () => "2026-10-19",
  telemetry,
  onToolError: telemetry.toolFailed,
  verifyKey: async () => ({ ok: false, status: 401, message: "bad key" }),
  async withOAuth(req, next) {
    if (req.headers.get("authorization") !== `Bearer ${TOKEN}`) return new Response(null, { status: 401 });
    return next(req, {
      token: TOKEN,
      clientId: "https://claude.ai/oauth/mcp-oauth-client-metadata",
      scopes: ["logbook:read"],
      extra: { userId: "user-1" },
    });
  },
  getClient: async () => new Concept2Client({ accessToken: "c2", baseUrl: "https://log.concept2.test", fetch: telemetry.fetch }),
});

type Captured = { event: string; distinct_id: string; properties: Record<string, unknown> };

function events(): Captured[] {
  return sent.flatMap(({ body }) => ((body as { batch?: Captured[] })?.batch ?? []));
}

function spanNames(): string[] {
  return JSON.stringify(sent.filter((s) => s.url.includes("/traces")).map((s) => s.body)).match(/"name":"[^"]+"/g) ?? [];
}

beforeAll(async () => {
  vi.stubGlobal("fetch", concept2);
  const transport = new StreamableHTTPClientTransport(new URL("https://ergstats.test/mcp"), {
    requestInit: { headers: { authorization: `Bearer ${TOKEN}`, "user-agent": "claude-code/2.1.0" } },
    fetch: (input, init) => handler(new Request(input, init)),
  });
  const client = new Client({ name: "claude-code", version: "2.1.0" });
  await client.connect(transport);
  await client.listTools();
  await client.callTool({ name: "list_workouts", arguments: { from: "2026-01-01", to: "2026-01-31", machine: "rower", limit: 10 } });
  await client.callTool({ name: "get_workout", arguments: { workout_id: 999 } });
  await client.callTool({ name: "get_profile", arguments: {} });
  await client.close();
  await handler(new Request("https://ergstats.test/mcp", { method: "POST", body: "{}", headers: { "user-agent": "openai-mcp/1.0.0" } }));
  await new Promise((resolve) => setTimeout(resolve, 10));
  await posthog.flush();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("MCP telemetry", () => {
  it("records each tool call against the caller's pseudonym", () => {
    const calls = events().filter((e) => e.event === "$mcp_tool_call");
    expect(calls.map((e) => e.properties.$mcp_tool_name)).toEqual(["list_workouts", "get_workout", "get_profile"]);
    for (const call of calls) {
      expect(call.distinct_id).toBe(pseudonymFor("user-1"));
      expect(call.properties.auth_method).toBe("oauth");
      expect(call.properties.oauth_client).toBe("claude.ai");
      expect(call.properties.$geoip_disable).toBe(true);
    }
  });

  it("keeps how a tool was used and drops what it was used on", () => {
    const [list, get] = events().filter((e) => e.event === "$mcp_tool_call");
    expect(list.properties).toMatchObject({ arg_machine: "rower", arg_limit: 10, arg_range_days: 31, upstream_requests: 1 });
    expect(list.properties.response_bytes).toBeGreaterThan(100);
    const json = JSON.stringify(events());
    expect(json).not.toContain("2026-01-01");
    expect(json).not.toContain(String(twoK.id));
    expect(json).not.toContain(user.username);
    expect(get.properties).toMatchObject({ $mcp_is_error: true, $mcp_error_type: "not_found", upstream_failures: 1, upstream_status: 404 });
    expect(get.properties).not.toHaveProperty("arg_workout_id");
    expect(list.properties).not.toHaveProperty("$mcp_response");
    expect(list.properties).not.toHaveProperty("$mcp_parameters");
  });

  it("reports only unexpected failures to error tracking, with their stack", () => {
    const exceptions = events().filter((e) => e.event === "$exception");
    expect(exceptions).toHaveLength(1);
    expect(exceptions[0].distinct_id).toBe(pseudonymFor("user-1"));
    expect(exceptions[0].properties).toMatchObject({ source: "mcp_tool", auth_method: "oauth" });
    expect(JSON.stringify(exceptions[0].properties.$exception_list)).toContain("SyntaxError");
    const profile = events().find((e) => e.properties.$mcp_tool_name === "get_profile");
    expect(profile?.properties.$mcp_error_type).toBe("internal");
  });

  it("drops the SDK's per-request identify events", () => {
    expect(events().map((e) => e.event)).not.toContain("$identify");
  });

  it("counts requests turned away before sign-in", () => {
    const rejected = events().find((e) => e.event === "mcp_request_rejected");
    expect(rejected?.properties).toMatchObject({ reason: "no_token", status: 401, client: "openai-mcp", $process_person_profile: false });
  });

  it("traces tool calls and the Concept2 requests they make", () => {
    const names = spanNames();
    expect(names).toContain('"name":"mcp tool list_workouts"');
    expect(names).toContain('"name":"concept2 GET /api/users/me/results/:id"');
  });
});
