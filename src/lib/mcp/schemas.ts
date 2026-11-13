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
 * A Logbook workout ID. Some clients send numeric IDs as strings ("123"); accept those
 * instead of failing validation, while the advertised JSON Schema stays a plain integer.
 */
export const workoutIdSchema = z
  .preprocess(
    (value) => (typeof value === "string" && /^\s*\d+\s*$/.test(value) ? Number(value) : value),
    z.number().int().min(1).max(1e12),
  )
  .describe("From list_workouts.");
