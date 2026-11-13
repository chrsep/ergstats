import { describe, expect, it } from "vitest";
import { z } from "zod";

import { dateSchema, workoutIdSchema } from "./schemas";

describe("dateSchema", () => {
  it("accepts real dates and rejects ones that only look right", () => {
    expect(dateSchema.safeParse("2024-02-29").success).toBe(true);
    expect(dateSchema.safeParse("2025-13-01").success).toBe(false);
    expect(dateSchema.safeParse("2025-02-29").success).toBe(false);
    expect(dateSchema.safeParse("2025-1-01").success).toBe(false);
  });
});

describe("workoutIdSchema", () => {
  it("accepts integer IDs, as numbers or digit strings", () => {
    expect(workoutIdSchema.parse(123)).toBe(123);
    expect(workoutIdSchema.parse("123")).toBe(123);
    expect(workoutIdSchema.parse(" 45 ")).toBe(45);
  });

  it("rejects anything that isn't a positive whole number", () => {
    for (const value of ["abc", "", "1.5", 1.5, 0, -3, null, true]) {
      expect(workoutIdSchema.safeParse(value).success).toBe(false);
    }
  });

  it("still advertises a plain integer to clients", () => {
    expect(z.toJSONSchema(workoutIdSchema, { io: "input" })).toMatchObject({ type: "integer", minimum: 1 });
  });
});
