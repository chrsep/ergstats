import type { AuthInfo, CallToolResult, McpServer, ToolAnnotations } from "@modelcontextprotocol/server";
import { z } from "zod";

import {
  bucketStrokes,
  personalBests,
  type SplitDetail,
  strokeRows,
  summarizeWorkout,
  trainingSummary,
  workoutDetail,
  type WorkoutSummary,
} from "@/lib/concept2/analysis";
import { Concept2Client, Concept2Error } from "@/lib/concept2/client";
import {
  analyzeEffort,
  type EffortAnalysis,
  UNEVEN_VARIATION,
  WARM_UP_SECONDS,
  type ZoneTime,
} from "@/lib/concept2/effort";
import { formatTenths, isInterval, machineLabel, paceUnit } from "@/lib/concept2/format";
import type { MachineType } from "@/lib/concept2/types";
import { dateSchema, machineSchema } from "./schemas";
import { MCP_SCOPE } from "./scopes";
import { clip, csv, join, shortPace, wholeSeconds } from "./text";

export interface ToolDeps {
  /** Build a Concept2 client for the caller identified by the verified API key. */
  getClient: (authInfo: AuthInfo | undefined) => Promise<Concept2Client>;
  /** Today's date as YYYY-MM-DD. Injected so tests are deterministic. */
  today?: () => string;
  /** Told about every failed tool call, for error tracking. Without it, unexpected failures are logged to the console. */
  onToolError?: (error: unknown) => void;
  /** Store a send_feedback report from the caller. Resolves false when they hit the daily limit. */
  saveFeedback: (authInfo: AuthInfo | undefined, feedback: AgentFeedback) => Promise<boolean>;
}

export const FEEDBACK_TYPES = ["missing_capability", "issue", "other"] as const;

export interface AgentFeedback {
  type: (typeof FEEDBACK_TYPES)[number];
  summary: string;
  tool?: string;
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

/** Workouts per list_workouts page, and the most one page may hold. */
export const LIST_LIMIT = { default: 20, max: 100 };
/** Raw strokes per get_workout_strokes page, and the most one page may hold. */
export const STROKE_LIMIT = { default: 100, max: 250 };

// Claude Code loads only this text (not the tool list) until it searches for a
// tool, so it says what questions the server answers.
export const SERVER_INSTRUCTIONS = `ErgStats reads the signed-in athlete's Concept2 Logbook: rowing, SkiErg and BikeErg workouts, splits, intervals, heart rate, stroke data and personal bests. The Logbook is read-only.

- Volume, consistency or trends: get_training_summary. PRs: get_personal_bests.
- Find sessions with list_workouts, then get_workout for splits or intervals and get_workout_strokes for pacing and heart rate within a piece (zones, decoupling, efficiency, strap checks).
- get_profile has age, weight and max heart rate for zones and watts per kg.
- If these tools can't answer what the user asked, or a result looks wrong, tell the developer with send_feedback.
- Tables are CSV with a header row; empty cells are unrecorded. Times are h:mm:ss.t. Pace is per 500m, or per 1000m on the BikeErg (marked /1k); lower is faster. Times are the athlete's local time; workouts are listed by start time.`;

const PACE_NOTE = "pace per 500m, /1k on the BikeErg";

/** The pace unit for tables about one workout. MultiErg intervals mix machines, so they get the general note. */
const paceNote = (machine: MachineType) =>
  machine === "multierg" ? PACE_NOTE : paceUnit(machine) === 1000 ? "pace per 1000m" : "pace per 500m";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function ok(text: string): CallToolResult {
  return { content: [{ type: "text", text }] };
}

function fail(error: unknown, onError?: (error: unknown) => void): CallToolResult {
  const message =
    error instanceof Concept2Error
      ? error.message
      : error instanceof Error && error.name === "NotConnectedError"
        ? error.message
        : "Something went wrong reading your Concept2 Logbook. Try again in a moment, and if it keeps failing, report it with send_feedback.";
  if (onError) onError(error);
  else if (!(error instanceof Concept2Error)) console.error("[mcp] tool failed", error);
  return { content: [{ type: "text", text: message }], isError: true };
}

/** Whole years between a YYYY-MM-DD birth date and today. */
export function ageOn(dob: string | null | undefined, today: string): number | null {
  if (!dob || !/^\d{4}-\d{2}-\d{2}/.test(dob)) return null;
  const [by, bm, bd] = dob.slice(0, 10).split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  const age = ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
  return age >= 0 && age < 130 ? age : null;
}

function isoDaysAgo(today: string, days: number): string {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** One sentence naming a workout, to head results about it. */
function workoutHeading(w: WorkoutSummary): string {
  return join([
    w.startedAt ? `${machineLabel(w.machine)} started ${w.startedAt.slice(0, 16)}` : `${machineLabel(w.machine)} ${w.date.slice(0, 16)}`,
    `${w.distanceMeters}m in ${w.time}`,
    w.pace,
    w.strokeRate && `${w.strokeRate}spm`,
    w.heartRateAvg && `${w.heartRateAvg}bpm`,
    w.restTime && `rest ${w.restTime}`,
    `id ${w.id}`,
  ]);
}

/** Whole minutes and seconds, like "24:49". */
const duration = (seconds: number) => wholeSeconds(formatTenths(seconds * 10));
const percent = (share: number) => `${Math.round(share * 100)}%`;
/** "<60%", "60-70%" or "90%+" of max heart rate. */
const zoneLabel = (z: ZoneTime) =>
  z.ceiling === null
    ? `${percent(z.floor)}+`
    : z.floor === 0
      ? `<${percent(z.ceiling)}`
      : `${Math.round(z.floor * 100)}-${percent(z.ceiling)}`;

/** A few lines on heart rate from the stroke data, so agents don't have to read every stroke. */
/** `maxHeartRate` is undefined when the profile couldn't be read, null when it has none. */
function effortLines(a: EffortAnalysis, maxHeartRate: number | null | undefined): string[] {
  const q = a.quality;
  if (!q) return ["No heart rate recorded."];
  const lines = [
    q.stuck &&
      `Heart rate stuck at ${q.stuck.bpm}bpm for ${duration(q.stuck.seconds)}: the strap likely lost contact, so heart rate figures are left out.`,
    !q.stuck &&
      !q.usable &&
      `Heart rate recorded for only ${percent(q.coverage)} of the piece, so heart rate figures are left out.`,
    q.usable && q.spikes > 0 && `${q.spikes} heart rate jumps of 20+ bpm between strokes, likely strap glitches.`,
    q.usable && q.aboveMax && `Peak ${q.aboveMax}bpm is above the profile's max heart rate of ${maxHeartRate}.`,
  ];
  if (q.usable) {
    lines.push(
      a.zones
        ? `Time by heart rate, % of max ${maxHeartRate}: ${join(
            a.zones
              .filter((z) => z.seconds > 0)
              .map((z) => `${zoneLabel(z)} ${duration(z.seconds)}`),
          )}.`
        : maxHeartRate === undefined
          ? "Couldn't read the profile's max heart rate, so no zones."
          : "No max heart rate in the Concept2 profile, so no zones.",
    );
  }
  const d = a.decoupling;
  if (d) {
    lines.push(
      `Aerobic decoupling ${d.percent.toFixed(1)}% (watts per beat, 1st vs 2nd half after a ${WARM_UP_SECONDS / 60} min warm-up; under 5% is steady): ${Math.round(d.first.watts)}W at ${Math.round(d.first.hr)}bpm, then ${Math.round(d.second.watts)}W at ${Math.round(d.second.hr)}bpm; watts varied ${percent(d.variation)} minute to minute${d.variation > UNEVEN_VARIATION ? ", too uneven to read much into it" : ""}.`,
    );
  } else if (a.decouplingSkipped === "too short" && a.workSeconds >= 900) {
    // Only worth saying for pieces long enough that someone might expect it.
    lines.push(`No decoupling: it needs 20+ min of steady work after the warm-up.`);
  }
  if (a.efficiency !== null) {
    lines.push(`Efficiency ${a.efficiency.toFixed(2)} W/bpm after the warm-up (compare similar sessions).`);
  }
  return lines.filter((l): l is string => Boolean(l));
}

function segmentTable(segments: SplitDetail[], intervals: boolean): string {
  const kinds = new Set(segments.map((s) => s.kind).filter(Boolean));
  const multiErg = segments.some((s) => s.machine);
  const calories = kinds.has("calorie");
  const wattMinutes = kinds.has("wattminute");
  const columns = [
    "n",
    multiErg && "machine",
    kinds.size > 1 && "kind",
    "meters",
    "time",
    "pace",
    "watts",
    "spm",
    calories && "cal",
    wattMinutes && "watt_min",
    "hr_avg",
    "hr_max",
    intervals && "rest",
    intervals && "rest_m",
    intervals && "hr_end_of_rest",
  ];
  const keep = columns.map(Boolean);
  const rows = segments.map((s) =>
    [
      s.number,
      s.machine && machineLabel(s.machine),
      s.kind,
      s.distanceMeters,
      s.time,
      shortPace(s.pace),
      s.watts,
      s.strokeRate,
      s.calories,
      s.wattMinutes,
      s.heartRate?.average,
      s.heartRate?.max,
      s.restTime,
      s.restMeters,
      s.heartRate?.rest,
    ].filter((_, i) => keep[i]),
  );
  return csv(columns.filter((c): c is string => Boolean(c)), rows);
}

export function registerTools(server: McpServer, deps: ToolDeps) {
  const today = deps.today ?? (() => new Date().toISOString().slice(0, 10));

  server.registerTool(
    "get_profile",
    {
      title: "Get athlete profile",
      description:
        "The athlete's name, gender, age, weight and max heart rate, for heart rate zones, watts per kg and age-group comparisons.",
      annotations: READ_ONLY,
      _meta: REQUIRES_SIGN_IN,
    },
    async (ctx) => {
      try {
        const client = await deps.getClient(ctx.http?.authInfo);
        const me = await client.getMe();
        const name = [me.first_name, me.last_name].filter(Boolean).join(" ") || me.username;
        const age = ageOn(me.dob, today());
        // Concept2 calls this decigrams but means hundredths of a kilo: 7500 is 75kg.
        const weightKg = me.weight ? Math.round(me.weight) / 100 : null;
        return ok(
          `${join([
            name,
            me.gender && `gender ${me.gender}`,
            age !== null && `age ${age}`,
            weightKg && `${weightKg} kg`,
            me.max_heart_rate ? `max heart rate ${me.max_heart_rate}` : "max heart rate not set",
          ])}.`,
        );
      } catch (error) {
        return fail(error, deps.onToolError);
      }
    },
  );

  server.registerTool(
    "list_workouts",
    {
      title: "List workouts",
      description: `Find workouts by date range and machine, newest first, ${LIST_LIMIT.default} per page. One CSV row each: start time, machine, meters, time, pace, stroke rate, average heart rate, rest, id and the athlete's comment. Pass the id to get_workout for splits.`,
      inputSchema: z.object({
        from: dateSchema.optional().describe("On or after, YYYY-MM-DD."),
        to: dateSchema.optional().describe("On or before, YYYY-MM-DD."),
        machine: machineSchema.optional(),
        limit: z.number().int().min(1).max(LIST_LIMIT.max).default(LIST_LIMIT.default),
        page: z.number().int().min(1).max(10_000).default(1),
      }),
      annotations: READ_ONLY,
      _meta: REQUIRES_SIGN_IN,
    },
    async ({ from, to, machine, limit, page }, ctx) => {
      try {
        const client = await deps.getClient(ctx.http?.authInfo);
        const body = await client.listResults({ from, to, type: machine, page, number: limit });
        const workouts = body.data.map(summarizeWorkout);
        if (workouts.length === 0) return ok(page > 1 ? `No workouts on page ${page}.` : "No workouts match those filters.");
        const total = body.meta?.pagination?.total ?? workouts.length;
        const totalPages = body.meta?.pagination?.total_pages ?? 1;
        const first = (page - 1) * limit + 1;
        const header = join(
          [
            `${total} workouts match, showing ${first}-${first + workouts.length - 1}, newest first`,
            page < totalPages && `next page ${page + 1} of ${totalPages}`,
            PACE_NOTE,
          ],
          "; ",
        );
        const table = csv(
          ["start", "machine", "meters", "time", "pace", "spm", "hr", "rest", "id", "comment"],
          workouts.map((w) => [
            (w.startedAt ?? w.date).slice(0, 16),
            machineLabel(w.machine),
            w.distanceMeters,
            w.time,
            shortPace(w.pace),
            w.strokeRate,
            w.heartRateAvg,
            w.restTime,
            w.id,
            clip(w.comments, 80),
          ]),
        );
        return ok(`${header}.\n${table}`);
      } catch (error) {
        return fail(error, deps.onToolError);
      }
    },
  );

  server.registerTool(
    "get_workout",
    {
      title: "Get workout",
      description:
        "One workout in full: start and end time, totals (watts, calories, strokes, drag factor), heart rate, rest, monitor targets, comments, and a CSV of its splits or intervals with pace, watts, stroke rate, heart rate and rest.",
      inputSchema: z.object({
        workout_id: z.number().int().min(1).max(1e12).describe("From list_workouts."),
      }),
      annotations: READ_ONLY,
      _meta: REQUIRES_SIGN_IN,
    },
    async ({ workout_id }, ctx) => {
      try {
        const client = await deps.getClient(ctx.http?.authInfo);
        const detail = workoutDetail(await client.getResult(workout_id));
        const { heartRate: hr, targets } = detail;
        const sameDay = detail.startedAt?.slice(0, 10) === detail.date.slice(0, 10);
        const started = detail.startedAt && (sameDay ? detail.startedAt.slice(11) : detail.startedAt);
        const intervals = detail.segmentKind === "intervals";
        const kinds = [...new Set(detail.segments.map((s) => s.kind).filter(Boolean))];
        const lines = [
          `${join([
            `${machineLabel(detail.machine)} ${detail.workoutType ?? "workout"} on ${detail.date}`,
            started && `started ${started}`,
            detail.timezone,
          ])}. id ${detail.id}.`,
          `${join([
            `${detail.distanceMeters}m in ${detail.time}`,
            detail.pace,
            detail.watts && `${detail.watts}W`,
            detail.strokeRate && `${detail.strokeRate}spm`,
            detail.strokeCount && `${detail.strokeCount} strokes`,
            detail.calories && `${detail.calories} cal`,
            detail.dragFactor && `drag factor ${detail.dragFactor}`,
            detail.restTime && `rest ${detail.restTime}${detail.restMeters ? ` (${detail.restMeters}m)` : ""}`,
          ])}.`,
          hr &&
            `Heart rate: ${join([
              hr.average && `avg ${hr.average}`,
              hr.min && `min ${hr.min}`,
              hr.max && `max ${hr.max}`,
              hr.ending && `end ${hr.ending}`,
              hr.recovery && `recovery ${hr.recovery}`,
            ])}.`,
          targets &&
            `Targets: ${join([
              targets.pace,
              targets.watts && `${targets.watts}W`,
              targets.calories && `${targets.calories} cal`,
              targets.strokeRate && `${targets.strokeRate}spm`,
              targets.heartRateZone && `HR zone ${targets.heartRateZone}`,
            ])}.`,
          detail.comments && `Comments: ${detail.comments}`,
          detail.segments.length > 0 &&
            `${detail.segments.length} ${kinds.length === 1 && intervals ? `${kinds[0]} ` : ""}${intervals ? "intervals" : "splits"} (${paceNote(detail.machine)}):\n${segmentTable(detail.segments, intervals)}`,
        ];
        return ok(lines.filter(Boolean).join("\n"));
      } catch (error) {
        return fail(error, deps.onToolError);
      }
    },
  );

  server.registerTool(
    "get_workout_strokes",
    {
      title: "Get stroke data",
      description: `Pacing and heart rate within one workout from its stroke data. By default: time in heart rate zones, aerobic decoupling, efficiency (watts per beat) and heart rate strap checks, then a CSV averaged into equal-distance segments (pace, watts, stroke rate, meters per stroke, heart rate). format "strokes" gives every stroke instead, ${STROKE_LIMIT.default} per page from offset; prefer the default unless single strokes matter.`,
      inputSchema: z.object({
        workout_id: z.number().int().min(1).max(1e12).describe("From list_workouts."),
        format: z.enum(["segments", "strokes"]).default("segments"),
        segments: z.number().int().min(2).max(100).default(20).describe("Segment count, for format segments."),
        offset: z.number().int().min(0).max(100_000).default(0).describe("Strokes to skip, for format strokes."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(STROKE_LIMIT.max)
          .default(STROKE_LIMIT.default)
          .describe("Strokes to return, for format strokes."),
      }),
      annotations: READ_ONLY,
      _meta: REQUIRES_SIGN_IN,
    },
    async ({ workout_id, format, segments, offset, limit }, ctx) => {
      try {
        const client = await deps.getClient(ctx.http?.authInfo);
        // Max heart rate is only for zones, so the summary still runs if the profile can't be read.
        const maxHeartRate =
          format === "segments"
            ? client
                .getMe()
                .then((me) => me.max_heart_rate || null)
                .catch(() => undefined)
            : null;
        const [result, strokes] = await Promise.all([client.getResult(workout_id), client.getStrokes(workout_id)]);
        if (strokes.length === 0) {
          return { content: [{ type: "text", text: `Workout ${workout_id} has no stroke data.` }], isError: true };
        }
        const heading = workoutHeading(summarizeWorkout(result));
        if (format === "strokes") {
          const all = strokeRows(strokes, result.type);
          const rows = all.slice(offset, offset + limit);
          if (rows.length === 0) return ok(`${heading}.\nNo strokes after offset ${offset}; the workout has ${strokes.length}.`);
          const end = offset + rows.length;
          const multiInterval = all[all.length - 1].interval > 1;
          const header = join(
            [`Strokes ${offset + 1}-${end} of ${strokes.length}`, end < strokes.length && `next offset ${end}`, paceNote(result.type)],
            "; ",
          );
          const table = csv(
            [multiInterval && "interval", "n", "time", "meters", "pace", "watts", "spm", "m_per_stroke", "hr"].filter(
              (c): c is string => Boolean(c),
            ),
            rows.map((r) => [
              ...(multiInterval ? [r.interval] : []),
              r.n,
              r.time,
              r.meters,
              shortPace(r.pace),
              r.watts,
              r.strokeRate,
              r.metersPerStroke,
              r.heartRate,
            ]),
          );
          return ok(`${heading}.\n${header}.\n${table}`);
        }
        const maxHr = await maxHeartRate;
        const effort = analyzeEffort(strokes, result.type, { maxHeartRate: maxHr ?? null, intervals: isInterval(result) });
        const buckets = bucketStrokes(strokes, result.type, segments);
        // Readings the strap check rejected stay out of the table too.
        const hrOk = effort.quality?.usable !== false;
        const table = csv(
          ["to_meters", "to_time", "pace", "watts", "spm", "m_per_stroke", "hr"],
          buckets.map((b) => [
            b.toMeters,
            b.toTime,
            shortPace(b.pace),
            b.watts,
            b.strokeRate,
            b.metersPerStroke,
            hrOk ? b.heartRateAvg : null,
          ]),
        );
        return ok(
          [
            `${heading}.`,
            ...effortLines(effort, maxHr),
            `${strokes.length} strokes in ${buckets.length} equal-distance segments; ${paceNote(result.type)}.`,
            table,
          ].join("\n"),
        );
      } catch (error) {
        return fail(error, deps.onToolError);
      }
    },
  );

  server.registerTool(
    "get_training_summary",
    {
      title: "Get training summary",
      description:
        "Training volume and consistency for a date range (default the last 12 weeks): sessions, meters and time in total and per machine with average pace, sessions and minutes per week, weeks with 2+ sessions, the longest gap between workouts, and a CSV per week or month including empty ones.",
      inputSchema: z.object({
        from: dateSchema.optional().describe("YYYY-MM-DD; default 12 weeks ago."),
        to: dateSchema.optional().describe("YYYY-MM-DD; default today."),
        machine: machineSchema.optional(),
        group_by: z.enum(["week", "month"]).default("week"),
      }),
      annotations: READ_ONLY,
      _meta: REQUIRES_SIGN_IN,
    },
    async ({ from, to, machine, group_by }, ctx) => {
      try {
        const client = await deps.getClient(ctx.http?.authInfo);
        // Nothing is logged in the future, and counting empty future weeks would drag the averages down.
        // Dates are the athlete's local time, which can be a day ahead of the server's UTC date.
        const latest = isoDaysAgo(today(), -1);
        const end = !to ? today() : to < latest ? to : latest;
        const start = from ?? isoDaysAgo(end, 83);
        if (start > end) return ok(`No workouts: ${start} is after ${end === to ? end : "today"}.`);
        const { results, truncated } = await client.listAllResults({ from: start, to: end, type: machine });
        const summary = trainingSummary(results, { from: start, to: end, groupBy: group_by, truncated });
        if (summary.sessions === 0) return ok(`No workouts from ${start} to ${end}.`);
        const gap = summary.longestGap;
        const lines = [
          `${start} to ${end}: ${plural(summary.sessions, "session")}, ${summary.meters}m, ${wholeSeconds(summary.time)}.`,
          ...summary.byMachine.map(
            (m) =>
              `${machineLabel(m.machine)}: ${join([plural(m.sessions, "session"), `${m.meters}m`, wholeSeconds(m.time), m.averagePace && `avg ${m.averagePace}`])}.`,
          ),
          summary.weekly &&
            `Per week: ${summary.weekly.sessionsPerWeek.toFixed(1)} sessions and ${Math.round(summary.weekly.secondsPerWeek / 60)} min of work on average; ${summary.weekly.weeksWithTwoPlus} of ${summary.weekly.weeks} weeks had 2+ sessions.`,
          gap && gap.days > 1 && `Longest gap between workouts: ${plural(gap.days, "day")}, ${gap.from} to ${gap.to}.`,
          summary.daysSinceLast &&
            `Last workout ${plural(summary.daysSinceLast, "day")} ${end === today() ? "ago" : `before ${end}`}.`,
          summary.longestWorkout && `Longest: ${workoutHeading(summary.longestWorkout)}.`,
          `By ${group_by === "week" ? "week (starting Monday)" : "month"}${summary.emptyPeriodsListed ? "" : `, only ${group_by}s with workouts`}:`,
          csv(
            [group_by, "sessions", "meters", "time"],
            summary.byPeriod.map((p) => [p.period, p.sessions, p.meters, wholeSeconds(p.time)]),
          ),
          truncated && "Only the most recent workouts in this range were read. Narrow the dates for full totals.",
        ];
        return ok(lines.filter(Boolean).join("\n"));
      } catch (error) {
        return fail(error, deps.onToolError);
      }
    },
  );

  server.registerTool(
    "get_personal_bests",
    {
      title: "Get personal bests",
      description:
        "Best time or distance per standard Concept2 event (100m to marathon, 1/4/30/60 min) and machine, counting single pieces only, like Concept2's rankings. Optionally within a date range, e.g. a season.",
      inputSchema: z.object({
        machine: machineSchema.optional(),
        from: dateSchema.optional().describe("On or after, YYYY-MM-DD."),
        to: dateSchema.optional().describe("On or before, YYYY-MM-DD."),
      }),
      annotations: READ_ONLY,
      _meta: REQUIRES_SIGN_IN,
    },
    async ({ machine, from, to }, ctx) => {
      try {
        const client = await deps.getClient(ctx.http?.authInfo);
        const { results, truncated } = await client.listAllResults({ from, to, type: machine }, 40);
        const bests = personalBests(results);
        if (bests.length === 0) return ok(`No standard-distance or standard-time pieces in ${results.length} workouts.`);
        const lines = [
          `Personal bests from ${results.length} workouts:`,
          ...bests.map(
            (b) =>
              `${machineLabel(b.machine)} ${b.event}: ${b.event.endsWith("min") ? `${b.distanceMeters}m` : b.time}, ${b.pace}, ${b.date}, id ${b.workoutId}`,
          ),
          truncated && "Only the most recent workouts were scanned. Add a date range to look further back.",
        ];
        return ok(lines.filter(Boolean).join("\n"));
      } catch (error) {
        return fail(error, deps.onToolError);
      }
    },
  );

  server.registerTool(
    "send_feedback",
    {
      title: "Send feedback",
      description:
        "Report to the ErgStats developer when no tool can answer the user's question, or a tool fails or returns something wrong. Describe the gap without the athlete's names, dates, numbers or health details, and tell the user you sent it.",
      inputSchema: z.object({
        type: z
          .enum(FEEDBACK_TYPES)
          .describe("missing_capability: no tool answers it. issue: a tool failed or was wrong."),
        summary: z.string().trim().min(10).max(1000).describe("What the user wanted and what was missing or wrong."),
        tool: z.string().trim().max(64).optional().describe("The tool it is about, if any."),
      }),
      // It writes a report, so it isn't read-only; it never touches the Logbook.
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      _meta: REQUIRES_SIGN_IN,
    },
    async ({ type, summary, tool }, ctx) => {
      try {
        const saved = await deps.saveFeedback(ctx.http?.authInfo, { type, summary, tool: tool || undefined });
        return ok(saved ? "Sent to the ErgStats developer. Thanks." : "Not sent: this account has reached today's feedback limit.");
      } catch (error) {
        if (deps.onToolError) deps.onToolError(error);
        else console.error("[mcp] saving feedback failed", error);
        return { content: [{ type: "text", text: "Couldn't send feedback right now." }], isError: true };
      }
    },
  );
}
