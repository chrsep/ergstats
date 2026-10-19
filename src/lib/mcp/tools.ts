import type { AuthInfo, CallToolResult, McpServer, ToolAnnotations } from "@modelcontextprotocol/server";
import { z } from "zod";

import {
  bucketStrokes,
  personalBests,
  summarizeWorkout,
  trainingSummary,
  workoutDetail,
  workoutLine,
} from "@/lib/concept2/analysis";
import { Concept2Client, Concept2Error } from "@/lib/concept2/client";
import { formatDistance, machineLabel } from "@/lib/concept2/format";
import {
  dateSchema,
  machineSchema,
  personalBestsSchema,
  profileSchema,
  strokesSchema,
  trainingSummarySchema,
  workoutDetailSchema,
  workoutListSchema,
} from "./schemas";
import { MCP_SCOPE } from "./scopes";

export interface ToolDeps {
  /** Build a Concept2 client for the caller identified by the verified API key. */
  getClient: (authInfo: AuthInfo | undefined) => Promise<Concept2Client>;
  /** Today's date as YYYY-MM-DD. Injected so tests are deterministic. */
  today?: () => string;
}

/**
 * Every tool needs a signed-in athlete. ChatGPT reads this to know the tools
 * need OAuth with this scope (an API key also works for clients that send one).
 */
const REQUIRES_SIGN_IN = { securitySchemes: [{ type: "oauth2", scopes: [MCP_SCOPE] }] };

/** Every tool only reads the athlete's own logbook. */
const READ_ONLY: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

export const SERVER_INSTRUCTIONS = `ErgStats reads the signed-in athlete's Concept2 Logbook (RowErg, SkiErg, BikeErg and other machines). Everything is read-only.

- Start with get_training_summary for questions about volume, consistency or trends, and get_personal_bests for PRs.
- Use list_workouts to find specific sessions, then get_workout for splits or intervals and get_workout_strokes for pacing within a piece.
- Times are h:mm:ss.t. Pace is per 500m, except per 1000m on the BikeErg. Lower pace is faster.
- Dates are YYYY-MM-DD in the athlete's local time.`;

function ok(text: string, structuredContent: Record<string, unknown>): CallToolResult {
  return { content: [{ type: "text", text }], structuredContent };
}

function fail(error: unknown): CallToolResult {
  const message =
    error instanceof Concept2Error
      ? error.message
      : error instanceof Error && error.name === "NotConnectedError"
        ? error.message
        : "Something went wrong reading your Concept2 Logbook. Try again in a moment.";
  if (!(error instanceof Concept2Error)) console.error("[mcp] tool failed", error);
  return { content: [{ type: "text", text: message }], isError: true };
}

function isoDaysAgo(today: string, days: number): string {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export function registerTools(server: McpServer, deps: ToolDeps) {
  const today = deps.today ?? (() => new Date().toISOString().slice(0, 10));

  server.registerTool(
    "get_profile",
    {
      title: "Get profile",
      description: "The athlete's Concept2 Logbook profile: name, username, country and max heart rate.",
      outputSchema: profileSchema,
      annotations: READ_ONLY,
      _meta: REQUIRES_SIGN_IN,
    },
    async (ctx) => {
      try {
        const client = await deps.getClient(ctx.http?.authInfo);
        const me = await client.getMe();
        const name = [me.first_name, me.last_name].filter(Boolean).join(" ") || null;
        const profile = {
          id: me.id,
          username: me.username,
          name,
          country: me.country ?? null,
          gender: me.gender ?? null,
          maxHeartRate: me.max_heart_rate ?? null,
        };
        const lines = [
          `${name ?? me.username} (@${me.username}, Concept2 id ${me.id})`,
          me.country ? `Country: ${me.country}` : null,
          me.max_heart_rate ? `Max heart rate: ${me.max_heart_rate} bpm` : null,
        ];
        return ok(lines.filter(Boolean).join("\n"), profile);
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.registerTool(
    "list_workouts",
    {
      title: "List workouts",
      description:
        "List logged workouts, newest first, one line each with date, machine, distance, time, pace, stroke rate, heart rate and id. Filter by date range and machine; page through long histories.",
      inputSchema: z.object({
        from: dateSchema.optional().describe("Only workouts on or after this date (YYYY-MM-DD)."),
        to: dateSchema.optional().describe("Only workouts on or before this date (YYYY-MM-DD)."),
        machine: machineSchema.optional(),
        limit: z.number().int().min(1).max(100).default(25).describe("Workouts per page, 1 to 100."),
        page: z.number().int().min(1).default(1),
      }),
      outputSchema: workoutListSchema,
      annotations: READ_ONLY,
      _meta: REQUIRES_SIGN_IN,
    },
    async ({ from, to, machine, limit, page }, ctx) => {
      try {
        const client = await deps.getClient(ctx.http?.authInfo);
        const body = await client.listResults({ from, to, type: machine, page, number: limit });
        const workouts = body.data.map(summarizeWorkout);
        const pagination = body.meta?.pagination;
        const total = pagination?.total ?? workouts.length;
        const totalPages = pagination?.total_pages ?? 1;
        const header =
          workouts.length === 0
            ? "No workouts match those filters."
            : `${total} workouts${totalPages > 1 ? `, page ${page} of ${totalPages}` : ""}:`;
        const text = [header, ...workouts.map(workoutLine)].join("\n");
        return ok(text, { workouts, page, totalPages, total });
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.registerTool(
    "get_workout",
    {
      title: "Get workout",
      description:
        "Full detail for one workout: splits or intervals with pace, watts, stroke rate and heart rate, plus rest, drag factor and comments.",
      inputSchema: z.object({
        workout_id: z.number().int().positive().describe("Workout id from list_workouts."),
      }),
      outputSchema: workoutDetailSchema,
      annotations: READ_ONLY,
      _meta: REQUIRES_SIGN_IN,
    },
    async ({ workout_id }, ctx) => {
      try {
        const client = await deps.getClient(ctx.http?.authInfo);
        const detail = workoutDetail(await client.getResult(workout_id));
        const lines = [
          workoutLine(detail),
          detail.workoutType ? `Type: ${detail.workoutType}` : null,
          detail.watts ? `Average: ${detail.watts}W` : null,
          detail.dragFactor ? `Drag factor: ${detail.dragFactor}` : null,
          detail.heartRate?.max ? `Heart rate: avg ${detail.heartRateAvg ?? "–"}, max ${detail.heartRate.max}` : null,
          detail.restTime ? `Rest: ${detail.restTime}` : null,
          detail.comments ? `Comments: ${detail.comments}` : null,
          detail.segments.length ? `\n${detail.segmentKind === "intervals" ? "Intervals" : "Splits"}:` : null,
          ...detail.segments.map((s) =>
            [
              `${s.number}.`,
              formatDistance(s.distanceMeters),
              s.time,
              s.pace,
              s.strokeRate ? `${s.strokeRate}spm` : null,
              s.heartRateAvg ? `${s.heartRateAvg}bpm` : null,
              s.restTime ? `rest ${s.restTime}` : null,
            ]
              .filter(Boolean)
              .join(" "),
          ),
        ];
        return ok(lines.filter((l) => l !== null).join("\n"), { ...detail });
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.registerTool(
    "get_workout_strokes",
    {
      title: "Get stroke data",
      description:
        "Per-stroke data for one workout, averaged into equal-distance segments (pace, stroke rate, heart rate) so you can see how pacing changed through the piece. Only works when the workout has stroke data.",
      inputSchema: z.object({
        workout_id: z.number().int().positive().describe("Workout id from list_workouts."),
        segments: z
          .number()
          .int()
          .min(2)
          .max(100)
          .default(20)
          .describe("How many equal-distance segments to average into, 2 to 100."),
      }),
      outputSchema: strokesSchema,
      annotations: READ_ONLY,
      _meta: REQUIRES_SIGN_IN,
    },
    async ({ workout_id, segments }, ctx) => {
      try {
        const client = await deps.getClient(ctx.http?.authInfo);
        const [result, strokes] = await Promise.all([client.getResult(workout_id), client.getStrokes(workout_id)]);
        if (strokes.length === 0) {
          return {
            content: [{ type: "text", text: `Workout ${workout_id} has no stroke data.` }],
            isError: true,
          };
        }
        const buckets = bucketStrokes(strokes, result.type, segments);
        const text = [
          `${workoutLine(summarizeWorkout(result))}`,
          `${strokes.length} strokes in ${buckets.length} segments:`,
          ...buckets.map(
            (b) =>
              `${b.fromMeters}-${b.toMeters}m (${b.fromTime}-${b.toTime}) ${b.pace ?? "–"} ${b.strokeRate ?? "–"}spm${b.heartRateAvg ? ` ${b.heartRateAvg}bpm` : ""}`,
          ),
        ].join("\n");
        return ok(text, { workoutId: workout_id, machine: result.type, totalStrokes: strokes.length, buckets });
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.registerTool(
    "get_training_summary",
    {
      title: "Get training summary",
      description:
        "Totals for a date range: sessions, meters and time overall, per machine (with average pace) and per week or month. Defaults to the last 12 weeks.",
      inputSchema: z.object({
        from: dateSchema.optional().describe("Start date (YYYY-MM-DD). Defaults to 12 weeks ago."),
        to: dateSchema.optional().describe("End date (YYYY-MM-DD). Defaults to today."),
        machine: machineSchema.optional(),
        group_by: z.enum(["week", "month"]).default("week"),
      }),
      outputSchema: trainingSummarySchema,
      annotations: READ_ONLY,
      _meta: REQUIRES_SIGN_IN,
    },
    async ({ from, to, machine, group_by }, ctx) => {
      try {
        const client = await deps.getClient(ctx.http?.authInfo);
        const end = to ?? today();
        const start = from ?? isoDaysAgo(end, 83);
        const { results, truncated } = await client.listAllResults({ from: start, to: end, type: machine });
        const summary = trainingSummary(results, { from: start, to: end, groupBy: group_by, truncated });
        const lines = [
          `${start} to ${end}: ${summary.sessions} sessions, ${formatDistance(summary.meters)}, ${summary.time}`,
          ...summary.byMachine.map(
            (m) =>
              `${machineLabel(m.machine)}: ${m.sessions} sessions, ${formatDistance(m.meters)}, ${m.time}${m.averagePace ? `, avg ${m.averagePace}` : ""}`,
          ),
          `\nBy ${group_by}:`,
          ...summary.byPeriod.map(
            (p) => `${p.period}: ${p.sessions} sessions, ${formatDistance(p.meters)}, ${p.time}`,
          ),
          truncated ? "\nOnly the most recent workouts in this range were read. Narrow the dates for full totals." : null,
        ];
        return ok(lines.filter((l) => l !== null).join("\n"), { ...summary });
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.registerTool(
    "get_personal_bests",
    {
      title: "Get personal bests",
      description:
        "Best result per standard Concept2 event (100m to marathon, 1/4/30/60 min) and machine. Counts single pieces of exactly that distance or time, like Concept2's rankings. Optionally limit to a date range, e.g. one season.",
      inputSchema: z.object({
        machine: machineSchema.optional(),
        from: dateSchema.optional().describe("Only count workouts on or after this date."),
        to: dateSchema.optional().describe("Only count workouts on or before this date."),
      }),
      outputSchema: personalBestsSchema,
      annotations: READ_ONLY,
      _meta: REQUIRES_SIGN_IN,
    },
    async ({ machine, from, to }, ctx) => {
      try {
        const client = await deps.getClient(ctx.http?.authInfo);
        const { results, truncated } = await client.listAllResults({ from, to, type: machine }, 40);
        const bests = personalBests(results);
        const text =
          bests.length === 0
            ? `No standard-distance or standard-time pieces found in ${results.length} workouts.`
            : [
                `Personal bests from ${results.length} workouts:`,
                ...bests.map(
                  (b) =>
                    `${machineLabel(b.machine)} ${b.event}: ${b.time} (${formatDistance(b.distanceMeters)}${b.pace ? `, ${b.pace}` : ""}) on ${b.date}, id ${b.workoutId}`,
                ),
                truncated ? "\nOnly the most recent workouts were scanned. Add a date range to look further back." : null,
              ]
                .filter((l) => l !== null)
                .join("\n");
        return ok(text, { bests, workoutsScanned: results.length, truncated });
      } catch (error) {
        return fail(error);
      }
    },
  );
}
