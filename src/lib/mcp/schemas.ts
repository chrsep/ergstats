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

export const machineSchema = z.enum(machines).describe("rower is the RowErg, bike the BikeErg.");

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine((s) => {
    // The regex lets through dates like 2025-13-01; a real one round-trips through Date unchanged.
    const ms = Date.parse(`${s}T00:00:00Z`);
    return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === s;
  }, "Not a real date");

/**
 * What a model reads when it sends no workout ID or a made-up one (0, null, a row
 * number). Zod's own message names the problem but not where a valid ID comes from.
 */
export const WORKOUT_ID_HINT = "Pass the whole-number id of one workout, from the id column of list_workouts.";

/**
 * A Logbook workout ID. Some clients send numeric IDs as strings ("123"); accept those
 * instead of failing validation, while the advertised JSON Schema stays a plain integer.
 */
export const workoutIdSchema = z
  .preprocess(
    (value) => (typeof value === "string" && /^\s*\d+\s*$/.test(value) ? Number(value) : value),
    z.number({ error: WORKOUT_ID_HINT }).int(WORKOUT_ID_HINT).min(1, WORKOUT_ID_HINT).max(1e12, WORKOUT_ID_HINT),
  )
  .describe("From list_workouts.");
