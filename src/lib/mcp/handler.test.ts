import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { afterEach, describe, expect, it } from "vitest";

import { Concept2Client } from "@/lib/concept2/client";
import { allResults, twoK, twoKStrokes, user } from "@/lib/concept2/__fixtures__/results";
import { createErgstatsMcpHandler, type KeyCheck } from "./handler";

const GOOD_KEY = "erg_test_key";

/** A fake Concept2 Logbook API serving the fixtures. */
async function fakeConcept2(input: RequestInfo | URL): Promise<Response> {
  const url = new URL(input instanceof Request ? input.url : input);
  const json = (body: unknown) => Response.json(body);
  if (url.pathname === "/api/users/me") return json({ data: user });
  if (url.pathname === "/api/users/me/results") {
    const type = url.searchParams.get("type");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const data = allResults.filter(
      (r) =>
        (!type || r.type === type) &&
        (!from || r.date.slice(0, 10) >= from) &&
        (!to || r.date.slice(0, 10) <= to),
    );
    return json({ data, meta: { pagination: { total: data.length, count: data.length, per_page: 250, current_page: 1, total_pages: 1 } } });
  }
  if (url.pathname === `/api/users/me/results/${twoK.id}`) return json({ data: twoK });
  if (url.pathname === `/api/users/me/results/${twoK.id}/strokes`) return json({ data: twoKStrokes });
  return new Response("not found", { status: 404 });
}

const handler = createErgstatsMcpHandler({
  dashboardUrl: "https://ergstats.com/dashboard",
  today: () => "2026-10-19",
  async verifyKey(key): Promise<KeyCheck> {
    if (key === GOOD_KEY) return { ok: true, authInfo: { token: key, clientId: "k1", scopes: [], extra: { userId: "u1" } } };
    if (key === "erg_busy") return { ok: false, status: 429, message: "slow down", retryAfterSeconds: 30 };
    return { ok: false, status: 401, message: "bad key" };
  },
  async getClient(authInfo) {
    expect(authInfo?.extra?.userId).toBe("u1");
    return new Concept2Client({ accessToken: "c2-token", baseUrl: "https://c2.test", fetch: fakeConcept2 as typeof fetch });
  },
});

const clients: Client[] = [];

async function connect(key = GOOD_KEY) {
  const transport = new StreamableHTTPClientTransport(new URL("https://ergstats.test/mcp"), {
    requestInit: { headers: { authorization: `Bearer ${key}` } },
    fetch: (input, init) => handler(new Request(input, init)),
  });
  const client = new Client({ name: "test", version: "1.0.0" });
  await client.connect(transport);
  clients.push(client);
  return client;
}

afterEach(async () => {
  await Promise.all(clients.splice(0).map((c) => c.close()));
});

describe("MCP endpoint", () => {
  it("rejects requests without a key, with a pointer to the dashboard", async () => {
    const res = await handler(new Request("https://ergstats.test/mcp", { method: "POST", body: "{}" }));
    expect(res.status).toBe(401);
    expect((await res.json()).error.message).toContain("https://ergstats.com/dashboard");
  });

  it("returns 429 with Retry-After when a key is rate limited", async () => {
    const res = await handler(
      new Request("https://ergstats.test/mcp", { method: "POST", body: "{}", headers: { "x-api-key": "erg_busy" } }),
    );
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
  });

  it("lists read-only tools with output schemas", async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "get_personal_bests",
      "get_profile",
      "get_training_summary",
      "get_workout",
      "get_workout_strokes",
      "list_workouts",
    ]);
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint).toBe(true);
      expect(tool.outputSchema).toBeDefined();
      expect(tool.description?.length).toBeGreaterThan(20);
    }
    expect(client.getInstructions()).toContain("Concept2 Logbook");
  });

  it("lists workouts as compact lines plus structured data", async () => {
    const client = await connect();
    const result = await client.callTool({ name: "list_workouts", arguments: { machine: "rower", limit: 10 } });
    expect(result.isError).toBeFalsy();
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(text).toContain("2026-10-18 07:30 · RowErg · 2,000m · 7:31.4 · 1:52.9/500m · 30spm · 178bpm · id 1001");
    expect((result.structuredContent as { total: number }).total).toBe(4);
  });

  it("returns workout detail with splits", async () => {
    const client = await connect();
    const result = await client.callTool({ name: "get_workout", arguments: { workout_id: twoK.id } });
    const structured = result.structuredContent as { segments: unknown[]; dragFactor: number };
    expect(structured.segments).toHaveLength(4);
    expect(structured.dragFactor).toBe(125);
  });

  it("summarizes stroke data", async () => {
    const client = await connect();
    const result = await client.callTool({ name: "get_workout_strokes", arguments: { workout_id: twoK.id, segments: 4 } });
    expect((result.structuredContent as { buckets: unknown[] }).buckets).toHaveLength(4);
  });

  it("summarizes training over the default 12 weeks", async () => {
    const client = await connect();
    const result = await client.callTool({ name: "get_training_summary", arguments: {} });
    const structured = result.structuredContent as { from: string; to: string; sessions: number };
    expect(structured).toMatchObject({ from: "2026-07-28", to: "2026-10-19", sessions: 5 });
  });

  it("finds personal bests", async () => {
    const client = await connect();
    const result = await client.callTool({ name: "get_personal_bests", arguments: {} });
    const text = (result.content as { text: string }[])[0].text;
    expect(text).toContain("RowErg 2k: 7:31.4");
  });

  it("turns Concept2 errors into tool errors the model can read", async () => {
    const client = await connect();
    const result = await client.callTool({ name: "get_workout", arguments: { workout_id: 999 } });
    expect(result.isError).toBe(true);
    expect((result.content as { text: string }[])[0].text).toContain("Not found");
  });
});
