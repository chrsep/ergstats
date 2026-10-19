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

export const workoutSummarySchema = z.object({
  id: z.number().describe("Workout id, for get_workout and get_workout_strokes."),
  date: z.string().describe('Local time the workout was logged (its end), "YYYY-MM-DD HH:MM:SS".'),
  machine: machineSchema,
  workoutType: z.string().nullable().describe("Concept2 workout type, e.g. JustRow, FixedDistanceSplits, FixedTimeInterval."),
  distanceMeters: z.number(),
  time: z.string().describe('Elapsed time, e.g. "7:31.4".'),
  timeSeconds: z.number(),
  pace,
  watts: wattsField,
  strokeRate: z.number().nullable().describe("Average strokes per minute."),
  heartRateAvg: z.number().nullable(),
  calories: z.number().nullable(),
  hasStrokeData: z.boolean().describe("Whether get_workout_strokes has data for this workout."),
});

const splitSchema = z.object({
  number: z.number(),
  distanceMeters: z.number(),
  time: z.string(),
  pace,
  watts: wattsField,
  strokeRate: z.number().nullable(),
  heartRateAvg: z.number().nullable(),
  restTime: z.string().nullable(),
  restMeters: z.number().nullable(),
});

export const workoutDetailSchema = workoutSummarySchema.extend({
  dragFactor: z.number().nullable(),
  strokeCount: z.number().nullable(),
  heartRate: z
    .object({ min: z.number().nullable(), max: z.number().nullable(), ending: z.number().nullable() })
    .nullable(),
  restTime: z.string().nullable(),
  restMeters: z.number().nullable(),
  comments: z.string().nullable(),
  verified: z.boolean(),
  segmentKind: z.enum(["intervals", "splits"]).nullable(),
  segments: z.array(splitSchema),
});

export const profileSchema = z.object({
  id: z.number(),
  username: z.string(),
  name: z.string().nullable(),
  country: z.string().nullable(),
  gender: z.string().nullable(),
  maxHeartRate: z.number().nullable(),
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
  buckets: z.array(
    z.object({
      fromMeters: z.number(),
      toMeters: z.number(),
      fromTime: z.string(),
      toTime: z.string(),
      pace,
      strokeRate: z.number().nullable(),
      heartRateAvg: z.number().nullable(),
      strokes: z.number(),
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
