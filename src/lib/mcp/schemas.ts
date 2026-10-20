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

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
