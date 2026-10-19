import { z } from "zod";

const machines = [
  "rower",
  "skierg",
  "bike",
  "dynamic",
  "slides",
  "paddle",
  "water",
  "snow",
  "rollerski",
  "multierg",
] as const;

export const machineSchema = z
  .enum(machines)
  .describe("Concept2 machine: rower (RowErg), skierg, bike (BikeErg), or another logbook type.");

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .describe("A date as YYYY-MM-DD, in the athlete's local time.");

const pace = z.string().nullable().describe('Average pace, e.g. "1:52.3/500m" ("/1k" on the BikeErg).');
const wattsField = z.number().nullable().describe("Average watts.");

const heartRateSchema = z
  .object({
    average: z.number().nullable(),
    min: z.number().nullable(),
    max: z.number().nullable(),
    ending: z.number().nullable(),
    rest: z.number().nullable().describe("Heart rate at the end of the following rest (intervals)."),
    recovery: z.number().nullable().describe("Recovery heart rate the monitor took after the piece."),
  })
  .nullable()
  .describe("Beats per minute; null when the monitor recorded none.");

export const workoutSummarySchema = z.object({
  id: z.number().describe("Workout id, for get_workout and get_workout_strokes."),
  date: z.string().describe('Local time the workout was logged (its end), "YYYY-MM-DD HH:MM:SS".'),
  dateUtc: z.string().nullable().describe("The same moment in UTC, when Concept2 knows the timezone."),
  timezone: z.string().nullable().describe("IANA timezone the workout was logged in."),
  machine: machineSchema,
  workoutType: z.string().nullable().describe("Concept2 workout type, e.g. JustRow, FixedDistanceSplits, FixedTimeInterval."),
  distanceMeters: z.number(),
  time: z.string().describe('Elapsed time, e.g. "7:31.4".'),
  timeSeconds: z.number(),
  pace,
  watts: wattsField,
  strokeRate: z.number().nullable().describe("Average strokes per minute."),
  strokeCount: z.number().nullable(),
  heartRateAvg: z.number().nullable(),
  heartRateMax: z.number().nullable(),
  calories: z.number().nullable(),
  dragFactor: z.number().nullable(),
  restTime: z.string().nullable().describe("Total rest between intervals."),
  restMeters: z.number().nullable().describe("Meters covered during rest."),
  verified: z.boolean().describe("Concept2 verified the result (logged from a PM5 through a trusted app)."),
  ranked: z.boolean().describe("The result is entered in Concept2's online rankings."),
  source: z.string().nullable().describe('Where it was logged from, e.g. "ErgData", "Web", "ErgZone".'),
  comments: z.string().nullable().describe("The athlete's own notes on the workout."),
  hasStrokeData: z.boolean().describe("Whether get_workout_strokes has data for this workout."),
});

const splitSchema = z.object({
  number: z.number(),
  kind: z.string().nullable().describe("Intervals only: set by time, distance, calorie or wattminute."),
  machine: machineSchema.nullable().describe("MultiErg intervals only: the machine used."),
  distanceMeters: z.number(),
  time: z.string(),
  timeSeconds: z.number(),
  pace,
  watts: wattsField,
  strokeRate: z.number().nullable(),
  calories: z.number().nullable(),
  wattMinutes: z.number().nullable(),
  heartRateAvg: z.number().nullable(),
  heartRate: heartRateSchema,
  restTime: z.string().nullable(),
  restMeters: z.number().nullable(),
});

export const workoutDetailSchema = workoutSummarySchema.extend({
  startedAt: z.string().nullable().describe("Local start time: the logged end time minus work and rest time."),
  weightClass: z.enum(["H", "L"]).nullable().describe("Heavyweight or lightweight, for rankings."),
  privacy: z.string().nullable().describe("Who can see the result in the Logbook."),
  wattMinutes: z.number().nullable(),
  heartRate: heartRateSchema,
  targets: z
    .object({
      strokeRate: z.number().nullable(),
      heartRateZone: z.number().nullable(),
      pace,
      watts: z.number().nullable(),
      calories: z.number().nullable(),
    })
    .nullable()
    .describe("What the monitor was set to aim for."),
  device: z
    .object({
      monitor: z.string().nullable().describe("Performance Monitor version, e.g. PM5."),
      firmware: z.string().nullable(),
      serialNumber: z.string().nullable(),
      ergModel: z.string().nullable(),
      app: z.string().nullable().describe("App and version that logged it."),
      device: z.string().nullable().describe("Phone or tablet that logged it."),
      deviceOs: z.string().nullable(),
      heartRateMonitor: z.string().nullable().describe("How the heart rate strap connected: BT, ANT or Apple."),
      other: z.string().nullable(),
    })
    .nullable(),
  segmentKind: z.enum(["intervals", "splits"]).nullable(),
  segments: z.array(splitSchema),
});

export const profileSchema = z.object({
  id: z.number(),
  username: z.string(),
  name: z.string().nullable(),
  country: z.string().nullable().describe("Three-letter IOC code."),
  gender: z.string().nullable().describe("M or F."),
  dateOfBirth: z.string().nullable(),
  age: z.number().nullable().describe("Age today, from the date of birth."),
  weightKg: z.number().nullable(),
  maxHeartRate: z.number().nullable(),
  logbookPrivacy: z.string().nullable().describe("Default visibility of new workouts."),
  profileImage: z.string().nullable(),
});

export const workoutListSchema = z.object({
  workouts: z.array(workoutSummarySchema),
  page: z.number(),
  totalPages: z.number(),
  total: z.number().describe("Workouts matching the filters across all pages."),
});

export const strokesSchema = z.object({
  workoutId: z.number(),
  machine: machineSchema,
  totalStrokes: z.number(),
  format: z.enum(["segments", "strokes"]),
  buckets: z
    .array(
      z.object({
        fromMeters: z.number(),
        toMeters: z.number(),
        fromTime: z.string(),
        toTime: z.string(),
        pace,
        watts: wattsField,
        strokeRate: z.number().nullable(),
        metersPerStroke: z.number().nullable(),
        heartRateAvg: z.number().nullable(),
        strokes: z.number(),
      }),
    )
    .describe("Equal-distance segments; empty when format is strokes."),
  strokes: z
    .array(
      z.object({
        n: z.number(),
        interval: z.number(),
        time: z.string(),
        timeSeconds: z.number(),
        meters: z.number(),
        pace,
        paceSeconds: z.number().nullable(),
        watts: wattsField,
        strokeRate: z.number(),
        metersPerStroke: z.number(),
        heartRate: z.number().nullable(),
      }),
    )
    .describe("Raw strokes from offset; empty when format is segments."),
  nextOffset: z.number().nullable().describe("Pass as offset to read the next strokes; null at the end."),
});

export const challengesSchema = z.object({
  challenges: z.array(
    z.object({
      key: z.string().nullable(),
      name: z.string(),
      start: z.string(),
      end: z.string(),
      activity: z.string().nullable(),
      category: z.string().nullable(),
      description: z.string().nullable(),
      link: z.string().nullable(),
    }),
  ),
});

export const trainingSummarySchema = z.object({
  from: z.string().nullable(),
  to: z.string().nullable(),
  sessions: z.number(),
  meters: z.number(),
  time: z.string(),
  timeSeconds: z.number(),
  byMachine: z.array(
    z.object({
      machine: machineSchema,
      sessions: z.number(),
      meters: z.number(),
      time: z.string(),
      averagePace: z.string().nullable(),
    }),
  ),
  byPeriod: z.array(
    z.object({
      period: z.string().describe("Week start (Monday, YYYY-MM-DD) or month (YYYY-MM)."),
      sessions: z.number(),
      meters: z.number(),
      time: z.string(),
      timeSeconds: z.number(),
    }),
  ),
  longestWorkout: workoutSummarySchema.nullable(),
  truncated: z.boolean().describe("True if the range held more workouts than one call reads; narrow the dates."),
});

export const personalBestsSchema = z.object({
  bests: z.array(
    z.object({
      event: z.string().describe('e.g. "2k", "500m", "Half marathon", "30 min".'),
      machine: machineSchema,
      time: z.string(),
      distanceMeters: z.number(),
      pace,
      watts: wattsField,
      date: z.string(),
      workoutId: z.number(),
    }),
  ),
  workoutsScanned: z.number(),
  truncated: z.boolean(),
});
