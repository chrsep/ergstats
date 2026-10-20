import { writeFileSync } from "node:fs";

import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { afterAll, describe, expect, it } from "vitest";

import { Concept2Client } from "@/lib/concept2/client";
import { logbook, steadyHourStrokes } from "@/lib/concept2/__fixtures__/logbook";
import { user } from "@/lib/concept2/__fixtures__/results";
import { createErgstatsMcpHandler } from "./handler";

/**
 * What a model actually reads from this server, measured against a realistic
 * year of training. Agents pay for every tool definition on every turn and for
 * every result they keep in context, so each tool has a budget.
 *
 * Budgets are characters. Prose runs about 4 characters a token, number-heavy
 * tables nearer 1.5, so the stroke table is the one to watch. MCP_TOKEN_REPORT=path
 * writes every payload to a JSON file for counting with a real tokenizer.
 */

const strokes = steadyHourStrokes();
const hour = logbook.find((r) => r.workout_type === "FixedTimeSplits" && r.type === "rower")!;
const intervals = logbook.find((r) => r.workout_type === "FixedDistanceInterval")!;

async function fakeConcept2(input: RequestInfo | URL): Promise<Response> {
  const url = new URL(input instanceof Request ? input.url : input);
  const json = (body: unknown) => Response.json(body);
  if (url.pathname === "/api/users/me") return json({ data: user });
  if (url.pathname === "/api/users/me/results") {
    const q = url.searchParams;
    const matches = logbook.filter(
      (r) =>
        (!q.get("type") || r.type === q.get("type")) &&
        (!q.get("from") || r.date.slice(0, 10) >= q.get("from")!) &&
        (!q.get("to") || r.date.slice(0, 10) <= q.get("to")!),
    );
    const perPage = Number(q.get("number") ?? 50);
    const page = Number(q.get("page") ?? 1);
    return json({
      data: matches.slice((page - 1) * perPage, page * perPage),
      meta: { pagination: { total: matches.length, per_page: perPage, current_page: page, total_pages: Math.max(1, Math.ceil(matches.length / perPage)) } },
    });
  }
  const strokesMatch = /^\/api\/users\/me\/results\/(\d+)\/strokes$/.exec(url.pathname);
  if (strokesMatch) return json({ data: strokes });
  const resultMatch = /^\/api\/users\/me\/results\/(\d+)$/.exec(url.pathname);
  if (resultMatch) {
    const r = logbook.find((w) => w.id === Number(resultMatch[1]));
    return r ? json({ data: r }) : new Response("not found", { status: 404 });
  }
  if (url.pathname.startsWith("/api/challenges")) {
    return json({
      data: [
        {
          key: "holiday",
          name: "Holiday Challenge",
          start: "2026-11-26",
          end: "2026-12-24",
          activity: "Row/Ski/Ride",
          category: "Individual",
          short_description: "Row, ski or ride 100,000 meters.",
          link: "https://www.concept2.com/holiday-challenge",
        },
      ],
    });
  }
  return new Response("not found", { status: 404 });
}

const handler = createErgstatsMcpHandler({
  dashboardUrl: "https://ergstats.test/dashboard",
  resourceMetadataUrl: "https://ergstats.test/.well-known/oauth-protected-resource/mcp",
  today: () => "2026-10-19",
  async verifyKey(key) {
    return { ok: true, authInfo: { token: key, clientId: "k", scopes: [], extra: { userId: "u1" } } };
  },
  async withOAuth() {
    return new Response(null, { status: 401 });
  },
  async getClient() {
    return new Concept2Client({ accessToken: "t", baseUrl: "https://c2.test", fetch: fakeConcept2 as typeof fetch });
  },
});

async function connect() {
  const transport = new StreamableHTTPClientTransport(new URL("https://ergstats.test/mcp"), {
    requestInit: { headers: { authorization: "Bearer erg_test" } },
    fetch: (input, init) => handler(new Request(input, init)),
  });
  const client = new Client({ name: "budget", version: "1.0.0" });
  await client.connect(transport);
  return client;
}

interface Seen {
  /** Text content blocks, joined. */
  text: string;
  /** structuredContent as JSON, or "" when the tool sent none. */
  structured: string;
}

/**
 * Claude Code, Codex and Claude's connectors read structuredContent when a
 * result has it and the text otherwise; ChatGPT reads both.
 */
const claudeSees = (s: Seen) => s.structured || s.text;
const chatgptSees = (s: Seen) => s.text + s.structured;

const report: Record<string, unknown> = {};

afterAll(() => {
  if (process.env.MCP_TOKEN_REPORT) writeFileSync(process.env.MCP_TOKEN_REPORT, JSON.stringify(report, null, 2));
});

/** [label, tool, arguments, budget in characters]. */
const calls: [label: string, tool: string, args: Record<string, unknown>, budget: number][] = [
  ["list_workouts (defaults)", "list_workouts", {}, 2_000],
  ["get_workout (30 min, 6 splits)", "get_workout", { workout_id: hour.id }, 800],
  ["get_workout (8 x 500m)", "get_workout", { workout_id: intervals.id }, 1_100],
  ["get_workout_strokes (defaults, 1 hour)", "get_workout_strokes", { workout_id: hour.id }, 1_200],
  ["get_workout_strokes (every stroke, defaults)", "get_workout_strokes", { workout_id: hour.id, format: "strokes" }, 5_000],
  // The biggest pages anyone can ask for stay under the 10,000 tokens where
  // Claude Code warns and Codex truncates.
  ["get_workout_strokes (250 strokes)", "get_workout_strokes", { workout_id: hour.id, format: "strokes", limit: 250 }, 12_000],
  ["list_workouts (100 per page)", "list_workouts", { limit: 100 }, 10_000],
  ["get_training_summary (defaults)", "get_training_summary", {}, 1_000],
  ["get_training_summary (a year by month)", "get_training_summary", { from: "2025-10-20", group_by: "month" }, 1_000],
  ["get_personal_bests (defaults)", "get_personal_bests", {}, 400],
  ["get_profile", "get_profile", {}, 150],
];

describe("token budget", () => {
  it("keeps tool definitions small", async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    // What Claude's API sees per tool: name, description and input schema.
    const definitions = JSON.stringify(tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema })));
    const full = JSON.stringify(tools);
    const instructions = client.getInstructions() ?? "";
    report["tools/list"] = { definitions, full, instructions };
    expect(definitions.length).toBeLessThan(4_800);
    expect(full.length).toBeLessThan(6_000);
    // Claude Code keeps only the first 4,096 characters.
    expect(instructions.length).toBeLessThan(1_000);
    await client.close();
  });

  for (const [label, tool, args, budget] of calls) {
    it(`keeps ${label} small`, async () => {
      const client = await connect();
      const result = await client.callTool({ name: tool, arguments: args });
      expect(result.isError, JSON.stringify(result.content)).toBeFalsy();
      const seen: Seen = {
        text: (result.content as { type: string; text?: string }[]).map((c) => c.text ?? "").join("\n"),
        structured: result.structuredContent ? JSON.stringify(result.structuredContent) : "",
      };
      report[label] = { ...seen, claude: claudeSees(seen), chatgpt: chatgptSees(seen) };
      // One representation, so every client reads the same compact text once.
      expect(seen.structured).toBe("");
      expect(seen.text.length).toBeLessThan(budget);
      await client.close();
    });
  }
});
