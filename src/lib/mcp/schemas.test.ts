import { describe, expect, it } from "vitest";

import { dateSchema } from "./schemas";

describe("dateSchema", () => {
  it("accepts real dates and rejects ones that only look right", () => {
    expect(dateSchema.safeParse("2024-02-29").success).toBe(true);
    expect(dateSchema.safeParse("2025-13-01").success).toBe(false);
    expect(dateSchema.safeParse("2025-02-29").success).toBe(false);
    expect(dateSchema.safeParse("2025-1-01").success).toBe(false);
  });
});
