import { describe, expect, it } from "vitest";

import { allResults, intervalStrokes, intervals, steadyState, twoK, twoKStrokes } from "./__fixtures__/results";
import { bucketStrokes, personalBests, strokeRows, summarizeWorkout, trainingSummary, workoutDetail } from "./analysis";

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
    expect(d.segments[0]).toMatchObject({ time: "1:47.5", pace: "1:47.5/500m", restTime: "2:00.0", kind: "distance" });
    expect(d.segments[0].heartRate).toMatchObject({ average: 170, ending: 178, rest: 120, min: null });
    expect(d.segments[1].heartRate).toBeNull();
  });

  it("works out the start time from the logged end time, work and rest", () => {
    expect(workoutDetail(twoK).startedAt).toBe("2026-10-18 07:22:28");
    // 7:10.0 of work plus 6:00.0 of rest before 07:00:00.
    expect(workoutDetail(intervals).startedAt).toBe("2026-10-12 06:46:50");
  });

  it("uses the UTC time and timezone across a daylight-saving change", () => {
    // An hour's row ending at 01:30 EST, after clocks fell back from 02:00 EDT.
    const fallBack = { ...steadyState, date: "2026-11-01 01:30:00", date_utc: "2026-11-01 06:30:00", time: 36000 };
    expect(workoutDetail({ ...fallBack, timezone: "America/New_York" }).startedAt).toBe("2026-11-01 01:30:00");
    expect(workoutDetail({ ...fallBack, timezone: "Not/AZone" }).startedAt).toBe("2026-11-01 00:30:00");
  });

  it("carries every field Concept2 returns for a result", () => {
    const d = workoutDetail(twoK);
    expect(d).toMatchObject({
      dateUtc: "2026-10-18 00:30:00",
      timezone: "Asia/Jakarta",
      source: "ErgData iOS",
      weightClass: "H",
      ranked: true,
      verified: true,
      privacy: "everyone",
      wattMinutes: 1960,
      strokeCount: 226,
      heartRateMax: 190,
      comments: "Test day.\nFelt strong in the last 500.",
    });
    // Concept2 sends 0 for readings it didn't take.
    expect(d.heartRate).toEqual({ average: 178, min: 120, max: 190, ending: 189, rest: null, recovery: null });
    expect(d.targets).toEqual({ strokeRate: 30, heartRateZone: null, pace: "1:53.0/500m", watts: null, calories: null });
    expect(d.segments[0]).toMatchObject({ calories: 34, heartRate: { min: 120, max: 176, ending: 175 } });
  });

  it("leaves optional fields null on sparse results", () => {
    const s = summarizeWorkout(allResults[2]);
    expect(s).toMatchObject({ dateUtc: null, source: null, comments: null, dragFactor: null, ranked: false });
    expect(workoutDetail(allResults[2])).toMatchObject({ targets: null, heartRate: { average: 145 } });
  });
});

describe("strokeRows", () => {
  it("undoes interval resets and numbers the intervals", () => {
    const rows = strokeRows(intervalStrokes, "rower");
    expect(rows.map((r) => r.interval)).toEqual([1, 1, 2, 2]);
    expect(rows.map((r) => r.meters)).toEqual([9, 500, 508.5, 1000]);
    expect(rows[2]).toMatchObject({ time: "1:50.0", metersPerStroke: 8.5, pace: "1:55.0/500m", heartRate: 150 });
    expect(rows[0].heartRate).toBeNull();
    expect(rows[1].watts).toBe(278);
  });

  it("reads BikeErg pace per 1000m", () => {
    const [row] = strokeRows([{ t: 20, d: 100, p: 1200, spm: 90, hr: 140 }], "bike");
    expect(row.pace).toBe("2:00.0/1k");
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
