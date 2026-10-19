import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { afterEach, describe, expect, it } from "vitest";

import { Concept2Client } from "@/lib/concept2/client";
import { allResults, twoK, twoKStrokes, user } from "@/lib/concept2/__fixtures__/results";
import { createErgstatsMcpHandler, type KeyCheck } from "./handler";

const GOOD_KEY = "erg_test_key";

const holidayChallenge = {
  key: "holiday",
  name: "Holiday Challenge",
  season: 2027,
  start: "2026-11-26",
  end: "2026-12-24",
  activity: "Row/Ski/Ride",
  category: "Individual",
  description: "Long description",
  short_description: "Row, ski or ride 100,000 meters.",
  link: "https://www.concept2.com/holiday-challenge",
  image: "https://example.com/holiday.png",
};
const GOOD_TOKEN = "oauth-access-token";
const RESOURCE_METADATA = "https://ergstats.test/.well-known/oauth-protected-resource/mcp";

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
  if (url.pathname === `/api/users/me/results/${twoK.id}`) {
    // Device details only come back when asked for.
    return json({ data: url.searchParams.get("include") === "metadata" ? twoK : { ...twoK, metadata: undefined } });
  }
  if (url.pathname === "/api/challenges/current") return json({ data: [holidayChallenge] });
  if (url.pathname === "/api/challenges/season/2027") return json({ data: [holidayChallenge, { ...holidayChallenge, key: "other", name: "Other" }] });
  if (url.pathname === `/api/users/me/results/${twoK.id}/strokes`) return json({ data: twoKStrokes });
  return new Response("not found", { status: 404 });
}

const handler = createErgstatsMcpHandler({
  dashboardUrl: "https://ergstats.com/dashboard",
  resourceMetadataUrl: RESOURCE_METADATA,
  today: () => "2026-10-19",
  async verifyKey(key): Promise<KeyCheck> {
    if (key === GOOD_KEY) return { ok: true, authInfo: { token: key, clientId: "k1", scopes: [], extra: { userId: "u1" } } };
    if (key === "erg_busy") return { ok: false, status: 429, message: "slow down", retryAfterSeconds: 30 };
    return { ok: false, status: 401, message: "bad key" };
  },
  // Stands in for Better Auth's token verification: one good token, otherwise the sign-in challenge.
  async withOAuth(req, next) {
    if (req.headers.get("authorization") === `Bearer ${GOOD_TOKEN}`) {
      return next(req, { token: GOOD_TOKEN, clientId: "https://claude.ai/oauth/mcp-oauth-client-metadata", scopes: ["logbook:read"], extra: { userId: "u1" } });
    }
    return new Response(null, {
      status: 401,
      headers: { "www-authenticate": `Bearer resource_metadata="${RESOURCE_METADATA}", scope="logbook:read"` },
    });
  },
  async getClient(authInfo) {
    expect(authInfo?.extra?.userId).toBe("u1");
    return new Concept2Client({ accessToken: "c2-token", baseUrl: "https://c2.test", fetch: fakeConcept2 as typeof fetch });
  },
});

const clients: Client[] = [];

async function connect(credential = GOOD_KEY) {
  const transport = new StreamableHTTPClientTransport(new URL("https://ergstats.test/mcp"), {
    requestInit: { headers: { authorization: `Bearer ${credential}` } },
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
  it("answers requests without credentials with the sign-in challenge", async () => {
    const res = await handler(new Request("https://ergstats.test/mcp", { method: "POST", body: "{}" }));
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain(`resource_metadata="${RESOURCE_METADATA}"`);
  });

  it("rejects a bad API key, pointing the client at sign-in instead", async () => {
    const res = await handler(
      new Request("https://ergstats.test/mcp", { method: "POST", body: "{}", headers: { authorization: "Bearer erg_nope" } }),
    );
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain(`resource_metadata="${RESOURCE_METADATA}"`);
    expect((await res.json()).error.message).toBe("bad key");
  });

  it("serves tools to a client signed in with OAuth", async () => {
    const client = await connect(GOOD_TOKEN);
    const result = await client.callTool({ name: "get_profile", arguments: {} });
    expect(result.isError).toBeFalsy();
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
      "list_challenges",
      "list_workouts",
    ]);
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint).toBe(true);
      expect(tool.outputSchema).toBeDefined();
      expect(tool.description?.length).toBeGreaterThan(20);
      expect(tool._meta?.securitySchemes).toEqual([{ type: "oauth2", scopes: ["logbook:read"] }]);
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

  it("returns the profile with age and weight", async () => {
    const client = await connect();
    const result = await client.callTool({ name: "get_profile", arguments: {} });
    expect(result.structuredContent).toMatchObject({ dateOfBirth: "1990-11-02", age: 35, weightKg: 82.5, maxHeartRate: 192 });
    expect((result.content as { text: string }[])[0].text).toContain("Weight: 82.5 kg");
  });

  it("returns workout detail with splits, targets and equipment", async () => {
    const client = await connect();
    const result = await client.callTool({ name: "get_workout", arguments: { workout_id: twoK.id } });
    const structured = result.structuredContent as { segments: unknown[]; dragFactor: number; device: unknown };
    expect(structured.segments).toHaveLength(4);
    expect(structured.dragFactor).toBe(125);
    expect(structured.device).toMatchObject({ monitor: "5", heartRateMonitor: "BT" });
    const text = (result.content as { text: string }[])[0].text;
    expect(text).toContain("Started 2026-10-18 07:22:28, ended 2026-10-18 07:30:00 (Asia/Jakarta)");
    expect(text).toContain("Targets: 1:53.0/500m, 30spm");
    expect(text).toContain("Logged from ErgData iOS, verified, ranked, heavyweight, privacy everyone");
    expect(text).toContain("Equipment: PM5, firmware 211, Model D/E, RowErg or Dynamic, serial 430123456");
    expect(text).toContain("1. 500m 1:55.0 1:55.0/500m 230W 31spm 34cal");
    expect(text).toContain("HR avg 168/min 120/max 176/end 175");
  });

  it("summarizes stroke data", async () => {
    const client = await connect();
    const result = await client.callTool({ name: "get_workout_strokes", arguments: { workout_id: twoK.id, segments: 4 } });
    expect((result.structuredContent as { buckets: unknown[] }).buckets).toHaveLength(4);
  });

  it("pages through raw strokes", async () => {
    const client = await connect();
    const result = await client.callTool({
      name: "get_workout_strokes",
      arguments: { workout_id: twoK.id, format: "strokes", offset: 190, limit: 5 },
    });
    const structured = result.structuredContent as { strokes: { n: number }[]; nextOffset: number | null };
    expect(structured.strokes.map((s) => s.n)).toEqual([191, 192, 193, 194, 195]);
    expect(structured.nextOffset).toBe(195);
    const last = await client.callTool({
      name: "get_workout_strokes",
      arguments: { workout_id: twoK.id, format: "strokes", offset: 195 },
    });
    expect((last.structuredContent as { nextOffset: number | null }).nextOffset).toBeNull();
    expect((last.content as { text: string }[])[0].text).toContain("Strokes 196-200 of 200");
  });

  it("lists Concept2 challenges", async () => {
    const client = await connect();
    const current = await client.callTool({ name: "list_challenges", arguments: {} });
    expect((current.content as { text: string }[])[0].text).toContain(
      "Holiday Challenge (2026-11-26 to 2026-12-24) · Row/Ski/Ride, Individual · Row, ski or ride 100,000 meters.",
    );
    // 2026-10-19 falls in the season that ends in 2027.
    const season = await client.callTool({ name: "list_challenges", arguments: { when: "season" } });
    expect((season.structuredContent as { challenges: unknown[] }).challenges).toHaveLength(2);
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
