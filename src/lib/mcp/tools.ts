import type { AuthInfo, CallToolResult, McpServer, ToolAnnotations } from "@modelcontextprotocol/server";
import { z } from "zod";

import {
  bucketStrokes,
  personalBests,
  strokeRows,
  summarizeWorkout,
  trainingSummary,
  workoutDetail,
  workoutLine,
  workoutListLine,
} from "@/lib/concept2/analysis";
import { type ChallengesQuery, Concept2Client, Concept2Error } from "@/lib/concept2/client";
import { formatDistance, machineLabel } from "@/lib/concept2/format";
import {
  challengesSchema,
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
- Use list_workouts to find specific sessions, then get_workout for splits or intervals, targets, full heart rate and device details, and get_workout_strokes for pacing within a piece (averaged segments, or every stroke with format "strokes").
- get_profile has age, weight and max heart rate for zones and watts per kg. list_challenges has Concept2's challenges and events.
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

/** Whole years between a YYYY-MM-DD birth date and today. */
export function ageOn(dob: string | null | undefined, today: string): number | null {
  if (!dob || !/^\d{4}-\d{2}-\d{2}/.test(dob)) return null;
  const [by, bm, bd] = dob.slice(0, 10).split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  const age = ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
  return age >= 0 && age < 130 ? age : null;
}

/** Concept2 seasons run May 1 to April 30 and are named for the year they end. */
export function concept2Season(today: string): number {
  const [year, month] = today.split("-").map(Number);
  return month >= 5 ? year + 1 : year;
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
      description:
        "The athlete's Concept2 Logbook profile: name, username, country, gender, date of birth and age, weight, max heart rate and default logbook privacy. Use age, weight and max heart rate for heart rate zones, watts per kg and age-group comparisons.",
      outputSchema: profileSchema,
      annotations: READ_ONLY,
      _meta: REQUIRES_SIGN_IN,
    },
    async (ctx) => {
      try {
        const client = await deps.getClient(ctx.http?.authInfo);
        const me = await client.getMe();
        const name = [me.first_name, me.last_name].filter(Boolean).join(" ") || null;
        const age = ageOn(me.dob, today());
        // Concept2 calls this decigrams but means hundredths of a kilo: 7500 is 75kg.
        const weightKg = me.weight ? Math.round(me.weight) / 100 : null;
        const profile = {
          id: me.id,
          username: me.username,
          name,
          country: me.country || null,
          gender: me.gender || null,
          dateOfBirth: me.dob || null,
          age,
          weightKg,
          maxHeartRate: me.max_heart_rate || null,
          logbookPrivacy: me.logbook_privacy || null,
          profileImage: me.profile_image || null,
        };
        const lines = [
          `${name ?? me.username} (@${me.username}, Concept2 id ${me.id})`,
          profile.gender ? `Gender: ${profile.gender}` : null,
          profile.dateOfBirth ? `Born: ${profile.dateOfBirth}${age !== null ? ` (age ${age})` : ""}` : null,
          profile.country ? `Country: ${profile.country}` : null,
          weightKg ? `Weight: ${weightKg} kg` : null,
          profile.maxHeartRate ? `Max heart rate: ${profile.maxHeartRate} bpm` : "Max heart rate: not set",
          profile.logbookPrivacy ? `Logbook privacy: ${profile.logbookPrivacy}` : null,
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
        "List logged workouts, newest first, one line each with date, machine, distance, time, pace, stroke rate, heart rate, rest, the athlete's comment and id. Structured results add type, watts, calories, drag factor, stroke count, max heart rate, timezone, source, and whether it is verified or ranked. Filter by date range and machine; page through long histories.",
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
        const text = [header, ...workouts.map(workoutListLine)].join("\n");
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
        "Everything Concept2 stores for one workout: start and end time, splits or intervals (pace, watts, stroke rate, calories, watt-minutes, heart rate including rest and recovery, rest time and distance), the targets set on the monitor, drag factor, stroke count, heart rate, comments, source, verified and ranked status, and the monitor, firmware, app and heart rate strap it was logged with.",
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
        const hr = detail.heartRate;
        const targets = detail.targets;
        const device = detail.device;
        const join = (parts: (string | number | null | false | undefined)[], sep = ", ") => parts.filter(Boolean).join(sep);
        const lines = [
          workoutLine(detail),
          detail.startedAt ? `Started ${detail.startedAt}, ended ${detail.date}${detail.timezone ? ` (${detail.timezone})` : ""}` : null,
          detail.workoutType ? `Type: ${detail.workoutType}` : null,
          join([
            detail.watts && `${detail.watts}W`,
            detail.calories && `${detail.calories} cal`,
            detail.wattMinutes && `${detail.wattMinutes} watt-minutes`,
            detail.strokeCount && `${detail.strokeCount} strokes`,
            detail.dragFactor && `drag factor ${detail.dragFactor}`,
          ]) || null,
          hr
            ? `Heart rate: ${join([
                hr.average && `avg ${hr.average}`,
                hr.min && `min ${hr.min}`,
                hr.max && `max ${hr.max}`,
                hr.ending && `ending ${hr.ending}`,
                hr.recovery && `recovery ${hr.recovery}`,
              ])}`
            : null,
          detail.restTime ? `Rest: ${detail.restTime}${detail.restMeters ? `, ${formatDistance(detail.restMeters)}` : ""}` : null,
          targets
            ? `Targets: ${join([
                targets.pace,
                targets.watts && `${targets.watts}W`,
                targets.calories && `${targets.calories} cal`,
                targets.strokeRate && `${targets.strokeRate}spm`,
                targets.heartRateZone && `HR zone ${targets.heartRateZone}`,
              ])}`
            : null,
          join([
            detail.source && `Logged from ${detail.source}`,
            detail.verified ? "verified" : "not verified",
            detail.ranked && "ranked",
            detail.weightClass && (detail.weightClass === "L" ? "lightweight" : "heavyweight"),
            detail.privacy && `privacy ${detail.privacy}`,
          ]),
          device
            ? `Equipment: ${join([
                device.monitor && `PM${device.monitor.replace(/^PM/i, "")}`,
                device.firmware && `firmware ${device.firmware}`,
                device.ergModel,
                device.serialNumber && `serial ${device.serialNumber}`,
                device.app,
                device.device,
                device.deviceOs,
                device.heartRateMonitor && `${device.heartRateMonitor} heart rate`,
                device.other,
              ])}`
            : null,
          detail.comments ? `Comments: ${detail.comments}` : null,
          detail.segments.length ? `\n${detail.segmentKind === "intervals" ? "Intervals" : "Splits"}:` : null,
          ...detail.segments.map((s) =>
            join(
              [
                `${s.number}.`,
                s.machine && machineLabel(s.machine),
                s.kind && `(${s.kind})`,
                formatDistance(s.distanceMeters),
                s.time,
                s.pace,
                s.watts && `${s.watts}W`,
                s.strokeRate && `${s.strokeRate}spm`,
                s.calories && `${s.calories}cal`,
                s.wattMinutes && `${s.wattMinutes}Wmin`,
                s.heartRate &&
                  `HR ${join(
                    [
                      s.heartRate.average && `avg ${s.heartRate.average}`,
                      s.heartRate.min && `min ${s.heartRate.min}`,
                      s.heartRate.max && `max ${s.heartRate.max}`,
                      s.heartRate.ending && `end ${s.heartRate.ending}`,
                      s.heartRate.rest && `rest ${s.heartRate.rest}`,
                      s.heartRate.recovery && `recovery ${s.heartRate.recovery}`,
                    ],
                    "/",
                  )}`,
                s.restTime && `rest ${s.restTime}${s.restMeters ? ` ${formatDistance(s.restMeters)}` : ""}`,
              ],
              " ",
            ),
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
        'Per-stroke data for one workout. By default it is averaged into equal-distance segments (pace, watts, stroke rate, meters per stroke, heart rate) to show how pacing changed through the piece. With format "strokes" it returns every stroke (elapsed time and distance, pace, watts, stroke rate, meters per stroke, heart rate, interval number), paged with offset and limit. Only works when the workout has stroke data.',
      inputSchema: z.object({
        workout_id: z.number().int().positive().describe("Workout id from list_workouts."),
        format: z
          .enum(["segments", "strokes"])
          .default("segments")
          .describe("segments: averaged equal-distance segments. strokes: every stroke, paged."),
        segments: z
          .number()
          .int()
          .min(2)
          .max(100)
          .default(20)
          .describe("With format segments: how many equal-distance segments to average into, 2 to 100."),
        offset: z.number().int().min(0).default(0).describe("With format strokes: strokes to skip."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(500)
          .default(250)
          .describe("With format strokes: strokes to return, 1 to 500."),
      }),
      outputSchema: strokesSchema,
      annotations: READ_ONLY,
      _meta: REQUIRES_SIGN_IN,
    },
    async ({ workout_id, format, segments, offset, limit }, ctx) => {
      try {
        const client = await deps.getClient(ctx.http?.authInfo);
        const [result, strokes] = await Promise.all([client.getResult(workout_id), client.getStrokes(workout_id)]);
        if (strokes.length === 0) {
          return {
            content: [{ type: "text", text: `Workout ${workout_id} has no stroke data.` }],
            isError: true,
          };
        }
        const base = { workoutId: workout_id, machine: result.type, totalStrokes: strokes.length, format };
        if (format === "strokes") {
          const rows = strokeRows(strokes, result.type).slice(offset, offset + limit);
          const end = offset + rows.length;
          const nextOffset = end < strokes.length ? end : null;
          const text = [
            workoutLine(summarizeWorkout(result)),
            rows.length
              ? `Strokes ${offset + 1}-${end} of ${strokes.length} (n interval time meters pace watts spm m/stroke hr):`
              : `No strokes after offset ${offset}; the workout has ${strokes.length}.`,
            ...rows.map((r) =>
              [
                r.n,
                r.interval,
                r.time,
                r.meters,
                r.pace ?? "–",
                r.watts ?? "–",
                r.strokeRate,
                r.metersPerStroke,
                r.heartRate ?? "–",
              ].join(" "),
            ),
            nextOffset !== null ? `More strokes: call again with offset ${nextOffset}.` : null,
          ]
            .filter((l) => l !== null)
            .join("\n");
          return ok(text, { ...base, buckets: [], strokes: rows, nextOffset });
        }
        const buckets = bucketStrokes(strokes, result.type, segments);
        const text = [
          `${workoutLine(summarizeWorkout(result))}`,
          `${strokes.length} strokes in ${buckets.length} segments:`,
          ...buckets.map(
            (b) =>
              `${b.fromMeters}-${b.toMeters}m (${b.fromTime}-${b.toTime}) ${b.pace ?? "–"} ${b.watts ?? "–"}W ${b.strokeRate ?? "–"}spm ${b.metersPerStroke ?? "–"}m/stroke${b.heartRateAvg ? ` ${b.heartRateAvg}bpm` : ""}`,
          ),
        ].join("\n");
        return ok(text, { ...base, buckets, strokes: [], nextOffset: null });
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

  server.registerTool(
    "list_challenges",
    {
      title: "List Concept2 challenges",
      description:
        "Concept2's challenges and events (e.g. the Holiday Challenge, World Erg Challenge) with dates, activity, category and a link. Defaults to the ones running now. Combine with get_training_summary to see progress toward a challenge's meters.",
      inputSchema: z.object({
        when: z
          .enum(["current", "upcoming", "recent", "season", "events"])
          .default("current")
          .describe(
            "current: running now. upcoming/recent: starting or ended within `days`. season: every challenge in a Concept2 season. events: other events in a calendar year.",
          ),
        days: z.number().int().min(1).max(365).default(30).describe("For upcoming and recent."),
        season: z
          .number()
          .int()
          .min(2000)
          .max(2100)
          .optional()
          .describe("For season: the year the season ends (seasons run May 1 to April 30). Defaults to the current season."),
        year: z.number().int().min(2000).max(2100).optional().describe("For events. Defaults to this year."),
      }),
      outputSchema: challengesSchema,
      annotations: READ_ONLY,
      _meta: REQUIRES_SIGN_IN,
    },
    async ({ when, days, season, year }, ctx) => {
      try {
        const client = await deps.getClient(ctx.http?.authInfo);
        const query: ChallengesQuery =
          when === "current"
            ? { kind: "current" }
            : when === "season"
              ? { kind: "season", season: season ?? concept2Season(today()) }
              : when === "events"
                ? { kind: "events", year: year ?? Number(today().slice(0, 4)) }
                : { kind: when, days };
        const challenges = (await client.listChallenges(query)).map((c) => ({
          key: c.key ?? null,
          name: c.name,
          start: c.start,
          end: c.end,
          activity: c.activity || null,
          category: c.category || null,
          description: c.short_description || c.description || null,
          link: c.link || null,
        }));
        const text =
          challenges.length === 0
            ? "No Concept2 challenges or events match."
            : challenges
                .map((c) =>
                  [
                    `${c.name} (${c.start} to ${c.end})`,
                    [c.activity, c.category].filter(Boolean).join(", ") || null,
                    c.description,
                    c.link,
                  ]
                    .filter(Boolean)
                    .join(" · "),
                )
                .join("\n");
        return ok(text, { challenges });
      } catch (error) {
        return fail(error);
      }
    },
  );
}
