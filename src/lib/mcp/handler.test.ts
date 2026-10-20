import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { afterEach, describe, expect, it } from "vitest";

import { Concept2Client } from "@/lib/concept2/client";
import { allResults, intervals, twoK, twoKStrokes, user } from "@/lib/concept2/__fixtures__/results";
import { createErgstatsMcpHandler, type KeyCheck } from "./handler";
import type { AgentFeedback } from "./tools";

const GOOD_KEY = "erg_test_key";

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
    const perPage = Number(url.searchParams.get("number") ?? 50);
    const page = Number(url.searchParams.get("page") ?? 1);
    const rows = data.slice((page - 1) * perPage, page * perPage);
    const pagination = { total: data.length, count: rows.length, per_page: perPage, current_page: page, total_pages: Math.ceil(data.length / perPage) };
    return json({ data: rows, meta: { pagination } });
  }
  if (url.pathname === `/api/users/me/results/${twoK.id}/strokes`) return json({ data: twoKStrokes });
  const result = allResults.find((r) => url.pathname === `/api/users/me/results/${r.id}`);
  if (result) return json({ data: result });
  return new Response("not found", { status: 404 });
}

/** Reports send_feedback stored, and whether the fake store is full. */
const feedback: { userId: unknown; report: AgentFeedback }[] = [];
let feedbackFull = false;

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
  async saveFeedback(authInfo, report) {
    if (feedbackFull) return false;
    feedback.push({ userId: authInfo?.extra?.userId, report });
    return true;
  },
});

const clients: Client[] = [];

function textOf(result: Awaited<ReturnType<Client["callTool"]>>): string {
  return (result.content as { type: string; text: string }[]).map((c) => c.text).join("\n");
}

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

  it("lists read-only training tools and send_feedback, answering in text", async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "get_personal_bests",
      "get_profile",
      "get_training_summary",
      "get_workout",
      "get_workout_strokes",
      "list_workouts",
      "send_feedback",
    ]);
    for (const tool of tools) {
      expect(tool.title).toBeTruthy();
      // send_feedback writes a report, so it is the one tool that isn't read-only.
      expect(tool.annotations?.readOnlyHint).toBe(tool.name !== "send_feedback");
      expect(tool.annotations?.destructiveHint).toBe(false);
      // Clients that see structuredContent read it instead of the text (or as well
      // as it), so results are text only and declare no output schema.
      expect(tool.outputSchema).toBeUndefined();
      expect(tool.description?.length).toBeGreaterThan(20);
      expect(tool._meta?.securitySchemes).toEqual([{ type: "oauth2", scopes: ["logbook:read"] }]);
    }
    expect(client.getInstructions()).toContain("Concept2 Logbook");
  });

  it("lists workouts as CSV rows", async () => {
    const client = await connect();
    const result = await client.callTool({ name: "list_workouts", arguments: { machine: "rower", limit: 10 } });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toBeUndefined();
    const text = textOf(result);
    expect(text).toContain("4 workouts match, showing 1-4, newest first");
    expect(text).toContain("start,machine,meters,time,pace,spm,hr,rest,id,comment\n");
    // Concept2 logs the end time; the list shows when each piece started.
    expect(text).toContain("2026-10-18 07:22,RowErg,2000,7:31.4,1:52.9,30,178,,1001,Test day. Felt strong in the last 500.");
    expect(text).toContain("2026-10-12 06:46,RowErg,2000,7:10.0,1:47.5,,,6:00.0,1004,");
  });

  it("tells the agent which page comes next", async () => {
    const client = await connect();
    const first = textOf(await client.callTool({ name: "list_workouts", arguments: { limit: 2 } }));
    expect(first).toMatch(/^5 workouts match, showing 1-2, newest first; next page 2 of 3; pace per 500m, \/1k on the BikeErg\.\n/);
    const last = textOf(await client.callTool({ name: "list_workouts", arguments: { limit: 2, page: 3 } }));
    expect(last).toMatch(/^5 workouts match, showing 5-5, newest first; pace/);
    expect(last.split("\n")).toHaveLength(3);
  });

  it("returns the training-relevant profile only", async () => {
    const client = await connect();
    const result = await client.callTool({ name: "get_profile", arguments: {} });
    expect(textOf(result)).toBe("Chris Example, gender M, age 35, 82.5 kg, max heart rate 192.");
  });

  it("returns workout detail with a splits table and targets", async () => {
    const client = await connect();
    const text = textOf(await client.callTool({ name: "get_workout", arguments: { workout_id: twoK.id } }));
    expect(text).toContain("RowErg FixedDistanceSplits on 2026-10-18 07:30:00, started 07:22:28, Asia/Jakarta. id 1001.");
    expect(text).toContain("2000m in 7:31.4, 1:52.9/500m, 244W, 30spm, 226 strokes, 140 cal, drag factor 125.");
    expect(text).toContain("Heart rate: avg 178, min 120, max 190, end 189.");
    expect(text).toContain("Targets: 1:53.0/500m, 30spm.");
    expect(text).toContain("4 splits (pace per 500m):\nn,meters,time,pace,watts,spm,hr_avg,hr_max\n1,500,1:55.0,1:55.0,230,31,168,176\n");
    // Equipment and logging details are not training data.
    expect(text).not.toMatch(/serial|firmware|privacy|ErgData/);
  });

  it("shows rest and heart rate after rest for intervals", async () => {
    const client = await connect();
    const text = textOf(await client.callTool({ name: "get_workout", arguments: { workout_id: intervals.id } }));
    expect(text).toContain(
      "4 distance intervals (pace per 500m):\nn,meters,time,pace,watts,spm,hr_avg,hr_max,rest,rest_m,hr_end_of_rest\n1,500,1:47.5,1:47.5,282,32,170,178,2:00.0,,120\n",
    );
  });

  it("summarizes stroke data into segments", async () => {
    const client = await connect();
    const text = textOf(
      await client.callTool({ name: "get_workout_strokes", arguments: { workout_id: twoK.id, segments: 4 } }),
    );
    // A 2k is too short for decoupling or efficiency, but zones still apply.
    expect(text).toContain("\nTime by heart rate, % of max 192: 70-80% 0:45, 80-90% 3:34, 90%+ 3:11.\n");
    expect(text).not.toContain("ecoupling");
    expect(text).not.toContain("Efficiency");
    expect(text).toContain("200 strokes in 4 equal-distance segments; pace per 500m.\nto_meters,to_time,pace,watts,spm,m_per_stroke,hr\n500,1:52.9,1:52.9,243,32,10,155\n");
  });

  it("pages through raw strokes", async () => {
    const client = await connect();
    const page = textOf(
      await client.callTool({
        name: "get_workout_strokes",
        arguments: { workout_id: twoK.id, format: "strokes", offset: 190, limit: 5 },
      }),
    );
    expect(page).toContain("Strokes 191-195 of 200; next offset 195; pace per 500m.");
    expect(page.split("\n").slice(-5).map((row) => row.split(",")[0])).toEqual(["191", "192", "193", "194", "195"]);
    const last = textOf(
      await client.callTool({ name: "get_workout_strokes", arguments: { workout_id: twoK.id, format: "strokes", offset: 195 } }),
    );
    expect(last).toContain("Strokes 196-200 of 200; pace per 500m.");
  });

  it("summarizes training over the default 12 weeks", async () => {
    const client = await connect();
    const text = textOf(await client.callTool({ name: "get_training_summary", arguments: {} }));
    expect(text).toContain("2026-07-28 to 2026-10-19: 5 sessions, 22900m, 1:33:23.");
    expect(text).toContain("SkiErg: 1 session, 6900m, 30:00, avg 2:10.4/500m.");
    expect(text).toContain("Per week: 0.4 sessions and 8 min of work on average; 1 of 13 weeks had 2+ sessions.");
    expect(text).toContain("Longest gap between workouts: 40 days, 2026-09-02 to 2026-10-12.\nLast workout 1 day ago.");
    // Empty weeks are listed so gaps show in the table too.
    expect(text).toContain("2026-08-31,1,2000,7:42\n2026-09-07,0,0,0:00\n");
    expect(text).toContain("2026-10-12,4,20900,1:25:41\n2026-10-19,0,0,0:00");
  });

  it("finds personal bests", async () => {
    const client = await connect();
    const text = textOf(await client.callTool({ name: "get_personal_bests", arguments: {} }));
    expect(text).toContain("RowErg 2k: 7:31.4, 1:52.9/500m, 2026-10-18, id 1001");
    expect(text).toContain("SkiErg 30 min: 6900m, 2:10.4/500m, 2026-10-16, id 1003");
  });

  it("turns Concept2 errors into tool errors the model can read", async () => {
    const client = await connect();
    const result = await client.callTool({ name: "get_workout", arguments: { workout_id: 999 } });
    expect(result.isError).toBe(true);
    expect((result.content as { text: string }[])[0].text).toContain("Not found");
  });

  it("stores feedback for the signed-in user", async () => {
    const client = await connect();
    feedback.length = 0;
    const result = await client.callTool({
      name: "send_feedback",
      arguments: { type: "missing_capability", summary: "  The user asked for rowing sessions logged by the PM5 only.  ", tool: "list_workouts" },
    });
    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toBe("Sent to the ErgStats developer. Thanks.");
    expect(feedback).toEqual([
      {
        userId: "u1",
        report: { type: "missing_capability", summary: "The user asked for rowing sessions logged by the PM5 only.", tool: "list_workouts" },
      },
    ]);
  });

  it("says when feedback was not sent because of the daily limit", async () => {
    const client = await connect();
    feedbackFull = true;
    try {
      const result = await client.callTool({ name: "send_feedback", arguments: { type: "issue", summary: "get_workout returned no splits." } });
      expect(result.isError).toBeFalsy();
      expect(textOf(result)).toContain("Not sent");
    } finally {
      feedbackFull = false;
    }
  });

  it("rejects feedback without a summary", async () => {
    const client = await connect();
    const result = await client.callTool({ name: "send_feedback", arguments: { type: "other", summary: "" } });
    expect(result.isError).toBe(true);
  });

  it("gives 2026-07-28 clients no reason to hold a subscription stream open", async () => {
    // The server is stateless and its tool list is fixed, so a listen stream would
    // only ever pin a serverless function open until its time limit.
    const methods: string[] = [];
    const transport = new StreamableHTTPClientTransport(new URL("https://ergstats.test/mcp"), {
      requestInit: { headers: { authorization: `Bearer ${GOOD_KEY}` } },
      fetch: (input, init) => {
        const body = typeof init?.body === "string" ? (JSON.parse(init.body) as { method?: string }) : undefined;
        if (body?.method) methods.push(body.method);
        return handler(new Request(input, init));
      },
    });
    const client = new Client(
      { name: "test", version: "1.0.0" },
      { versionNegotiation: { mode: { pin: "2026-07-28" } }, listChanged: { tools: { onChanged: () => {} } } },
    );
    await client.connect(transport);
    clients.push(client);
    expect(methods).toContain("server/discover");
    expect(client.getServerCapabilities()?.tools?.listChanged).toBe(false);
    expect(methods).not.toContain("subscriptions/listen");

    // A client that asks anyway is answered at once and the stream ends gracefully.
    const subscription = await client.listen({ toolsListChanged: true });
    expect(subscription.honoredFilter).toEqual({});
    await expect(subscription.closed).resolves.toBe("graceful");
  });
});
