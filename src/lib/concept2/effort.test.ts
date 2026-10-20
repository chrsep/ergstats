import { describe, expect, it } from "vitest";

import { analyzeEffort } from "./effort";
import type { Concept2Stroke } from "./types";

/**
 * A steady row: one stroke every 3 s at a fixed pace, with heart rate from
 * `hr(seconds)`. Pace is tenths per 500m; 2:00 is about 203W.
 */
function row(minutes: number, hr: (seconds: number) => number | undefined, pace = 1200): Concept2Stroke[] {
  const out: Concept2Stroke[] = [];
  const metersPerStroke = (500 / (pace / 10)) * 3;
  for (let t = 30; t <= minutes * 600; t += 30) {
    out.push({ t, d: Math.round((t / 30) * metersPerStroke * 10), p: pace, spm: 20, hr: hr(t / 10) });
  }
  return out;
}

const opts = { maxHeartRate: 190, intervals: false };

describe("analyzeEffort", () => {
  it("finds no decoupling when heart rate holds steady", () => {
    const a = analyzeEffort(row(40, (s) => 140 + (s % 9 < 3 ? 1 : 0)), "rower", opts);
    expect(a.quality).toMatchObject({ coverage: 1, stuck: null, spikes: 0, aboveMax: null, usable: true });
    expect(Math.abs(a.decoupling!.percent)).toBeLessThan(0.5);
  });

  it("measures drift: heart rate rising through the piece at the same watts", () => {
    // 140 to 147 bpm over the hour, with a little noise so the strap check passes.
    const a = analyzeEffort(row(60, (s) => Math.round(140 + (7 * s) / 3600 + (s % 9 < 3 ? 1 : 0))), "rower", opts);
    expect(a.quality?.usable).toBe(true);
    expect(a.decoupling!.percent).toBeGreaterThan(1.5);
    expect(a.decoupling!.percent).toBeLessThan(3);
    expect(a.decoupling!.second.hr).toBeGreaterThan(a.decoupling!.first.hr);
    expect(a.decoupling!.variation).toBeLessThan(0.01);
    expect(a.efficiency).toBeCloseTo(203 / 144, 1);
  });

  it("adds up time in zones from the profile's max heart rate", () => {
    // 120 bpm (63%) for the first 10 min, then 150 bpm (79%).
    const a = analyzeEffort(row(30, (s) => (s <= 600 ? 120 + (s % 6 < 3 ? 1 : 0) : 150 + (s % 6 < 3 ? 1 : 0))), "rower", opts);
    const zones = a.zones!;
    expect(zones.reduce((sum, z) => sum + z.seconds, 0)).toBeCloseTo(a.workSeconds, 5);
    expect(zones[1].seconds).toBeCloseTo(600, -1);
    expect(zones[2].seconds).toBeCloseTo(1200, -1);
  });

  it("leaves heart rate out when the strap is stuck on one reading", () => {
    const a = analyzeEffort(row(60, (s) => (s < 120 ? 100 + Math.round(s / 10) : 88)), "rower", opts);
    expect(a.quality).toMatchObject({ usable: false, stuck: { bpm: 88 } });
    expect(a.quality!.stuck!.seconds).toBeGreaterThan(3000);
    expect(a.zones).toBeNull();
    expect(a.decoupling).toBeNull();
    expect(a.efficiency).toBeNull();
  });

  it("leaves heart rate out when most strokes have no reading", () => {
    const a = analyzeEffort(row(30, (s) => (s < 600 ? 140 + (s % 6 < 3 ? 1 : 0) : undefined)), "rower", opts);
    expect(a.quality?.coverage).toBeCloseTo(1 / 3, 1);
    expect(a.quality?.usable).toBe(false);
  });

  it("doesn't call a jump or a run across a dropout a strap glitch", () => {
    // 140 bpm, a 5 min dropout, then 165 bpm: a real rise, not a spike, and no single run of 140.
    const hr = (s: number) => (s < 600 ? 140 + (s % 6 < 3 ? 1 : 0) : s < 900 ? undefined : 165 + (s % 6 < 3 ? 1 : 0));
    expect(analyzeEffort(row(60, hr), "rower", opts).quality).toMatchObject({ spikes: 0, stuck: null });
  });

  it("counts strap spikes and readings above max", () => {
    const a = analyzeEffort(row(30, (s) => (s > 900 && s < 904 ? 205 : 140 + (s % 6 < 3 ? 1 : 0))), "rower", opts);
    expect(a.quality?.spikes).toBe(2);
    expect(a.quality?.aboveMax).toBe(205);
  });

  it("skips decoupling for short pieces and intervals, and zones without a max heart rate", () => {
    const steady = (s: number) => 140 + (s % 6 < 3 ? 1 : 0);
    expect(analyzeEffort(row(20, steady), "rower", opts)).toMatchObject({ decoupling: null, decouplingSkipped: "too short" });
    expect(analyzeEffort(row(7, steady), "rower", opts).efficiency).toBeNull();
    const intervals = analyzeEffort(row(40, steady), "rower", { maxHeartRate: 190, intervals: true });
    expect(intervals).toMatchObject({ decoupling: null, decouplingSkipped: "intervals", efficiency: null });
    expect(intervals.zones).not.toBeNull();
    expect(analyzeEffort(row(40, steady), "rower", { maxHeartRate: null, intervals: false }).zones).toBeNull();
  });

  it("reports nothing without heart rate", () => {
    expect(analyzeEffort(row(30, () => undefined), "rower", opts)).toMatchObject({ quality: null, zones: null, decoupling: null });
  });
});
