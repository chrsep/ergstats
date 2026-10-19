import { describe, expect, it } from "vitest";

import { continuousStrokes, formatPace, formatTenths, watts, weekStart } from "./format";

describe("formatTenths", () => {
  it("formats like a PM5", () => {
    expect(formatTenths(4514)).toBe("7:31.4");
    expect(formatTenths(36000)).toBe("1:00:00.0");
    expect(formatTenths(95)).toBe("0:09.5");
  });
});

describe("pace and watts", () => {
  it("uses /500m on the rower and /1k on the bike", () => {
    expect(formatPace(4514, 2000, "rower")).toBe("1:52.9/500m");
    expect(formatPace(6000, 2000, "bike")).toBe("5:00.0/1k");
  });

  it("matches Concept2's watts for a 2:00/500m pace", () => {
    expect(watts(1200, 500, "rower")).toBe(203);
    expect(watts(1200, 500, "bike")).toBe(25);
  });
});

describe("weekStart", () => {
  it("returns the Monday of the ISO week", () => {
    expect(weekStart("2026-10-18")).toBe("2026-10-12"); // Sunday
    expect(weekStart("2026-10-12")).toBe("2026-10-12"); // Monday
  });
});

describe("continuousStrokes", () => {
  it("keeps counting across interval resets", () => {
    const strokes = continuousStrokes([
      { t: 20, d: 100 },
      { t: 40, d: 200 },
      { t: 20, d: 90 },
      { t: 40, d: 190 },
    ]);
    expect(strokes.map((s) => s.d)).toEqual([100, 200, 290, 390]);
    expect(strokes.map((s) => s.t)).toEqual([20, 40, 60, 80]);
  });
});
