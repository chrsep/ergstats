import { describe, expect, it } from "vitest";

import { allResults, intervals, twoK, twoKStrokes } from "./__fixtures__/results";
import { bucketStrokes, personalBests, trainingSummary, workoutDetail } from "./analysis";

describe("personalBests", () => {
  it("keeps the fastest exact-distance piece and ignores intervals", () => {
    const bests = personalBests(allResults);
    const rower2k = bests.find((b) => b.machine === "rower" && b.event === "2k");
    expect(rower2k).toMatchObject({ time: "7:31.4", workoutId: twoK.id });
    expect(bests.some((b) => b.workoutId === intervals.id)).toBe(false);
  });

  it("scores time events by distance", () => {
    const ski30 = personalBests(allResults).find((b) => b.machine === "skierg" && b.event === "30 min");
    expect(ski30).toMatchObject({ distanceMeters: 6900 });
  });
});

describe("trainingSummary", () => {
  it("totals by machine and by ISO week", () => {
    const s = trainingSummary(allResults, { groupBy: "week" });
    expect(s.sessions).toBe(5);
    expect(s.meters).toBe(22900);
    expect(s.byMachine[0]).toMatchObject({ machine: "rower", sessions: 4, meters: 16000 });
    expect(s.byPeriod.map((p) => p.period)).toEqual(["2026-08-31", "2026-10-12"]);
    expect(s.longestWorkout?.distanceMeters).toBe(10000);
  });
});

describe("workoutDetail", () => {
  it("prefers intervals and includes rest", () => {
    const d = workoutDetail(intervals);
    expect(d.segmentKind).toBe("intervals");
    expect(d.segments[0]).toMatchObject({ time: "1:47.5", pace: "1:47.5/500m", restTime: "2:00.0" });
  });
});

describe("bucketStrokes", () => {
  it("averages strokes into equal-distance segments", () => {
    const buckets = bucketStrokes(twoKStrokes, "rower", 4);
    expect(buckets).toHaveLength(4);
    expect(buckets[0]).toMatchObject({ fromMeters: 0, toMeters: 500, strokes: 50 });
    expect(buckets.at(-1)?.toMeters).toBe(2000);
    expect(buckets[0].strokeRate).toBeGreaterThan(buckets[1].strokeRate ?? 0);
  });
});
