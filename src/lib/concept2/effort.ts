import { continuousStrokes, paceUnit, watts } from "./format";
import type { Concept2Stroke, MachineType } from "./types";

/**
 * Heart rate analysis of one workout's stroke data: time in zones, aerobic
 * decoupling, efficiency and checks for a strap that dropped out. It runs on
 * the server so an agent gets a few lines instead of reading every stroke.
 */

/** Zone floors as a share of max heart rate: the common five-zone %HRmax model. */
export const ZONE_FLOORS = [0, 0.6, 0.7, 0.8, 0.9] as const;
/** Heart rate lags effort by a few minutes, so decoupling skips this much at the start. */
export const WARM_UP_SECONDS = 300;
/** Decoupling needs at least this much steady work after the warm-up to mean anything. */
export const MIN_DECOUPLING_SECONDS = 1200;
/** Efficiency is for aerobic pieces; a shorter one is a test or sprint where heart rate never settles. */
const MIN_EFFICIENCY_SECONDS = 600;
/** The same reading for this long means the strap stopped updating. */
const STUCK_SECONDS = 300;
/** A jump this big between consecutive strokes is a strap glitch, not physiology. */
const SPIKE_BPM = 20;
/** Below this share of work time with a reading, heart rate figures aren't worth giving. */
const MIN_COVERAGE = 0.8;
/** Minute-to-minute watts varying more than this makes decoupling hard to read. */
export const UNEVEN_VARIATION = 0.1;

interface Sample {
  /** Seconds since the start, at the end of this stroke. */
  end: number;
  /** Seconds this stroke took. */
  seconds: number;
  watts: number | null;
  hr: number | null;
}

export interface HeartRateQuality {
  /** Share of work time with a heart rate reading, 0 to 1. */
  coverage: number;
  /** The longest run of one unchanging reading, when it is long enough to mean the strap stuck. */
  stuck: { bpm: number; seconds: number } | null;
  /** Jumps of 20 bpm or more between consecutive strokes. */
  spikes: number;
  /** The highest reading, when it is above the athlete's max heart rate. */
  aboveMax: number | null;
  /** False when the readings are too sparse or stuck to analyse. */
  usable: boolean;
}

export interface ZoneTime {
  /** Lower bound as a share of max heart rate. */
  floor: number;
  /** Upper bound, or null for the top zone. */
  ceiling: number | null;
  seconds: number;
}

export interface Decoupling {
  /** Positive when heart rate rose for the same output (efficiency fell), in percent. */
  percent: number;
  first: { watts: number; hr: number };
  second: { watts: number; hr: number };
  /** Coefficient of variation of per-minute average watts, 0 to 1. */
  variation: number;
}

export interface EffortAnalysis {
  workSeconds: number;
  quality: HeartRateQuality | null;
  /** Null without usable heart rate or a max heart rate. */
  zones: ZoneTime[] | null;
  /** Watts per beat over the analysed window: higher means more output for the same heart rate. */
  efficiency: number | null;
  decoupling: Decoupling | null;
  /** Why decoupling was left out, when it was. */
  decouplingSkipped: string | null;
}

function samples(raw: Concept2Stroke[], type: MachineType): Sample[] {
  const unit = paceUnit(type);
  let prev = 0;
  return continuousStrokes(raw).map((s) => {
    const end = s.t / 10;
    const sample = {
      end,
      seconds: Math.max(0, end - prev),
      watts: s.p > 0 ? watts(s.p, unit, type) : null,
      hr: typeof s.hr === "number" && s.hr > 0 ? s.hr : null,
    };
    prev = end;
    return sample;
  });
}

function quality(all: Sample[], maxHeartRate: number | null): HeartRateQuality | null {
  const total = all.reduce((sum, s) => sum + s.seconds, 0);
  const withHr = all.filter((s) => s.hr !== null);
  if (withHr.length === 0 || total === 0) return null;
  const coverage = withHr.reduce((sum, s) => sum + s.seconds, 0) / total;

  let stuck: HeartRateQuality["stuck"] = null;
  let run = 0;
  let spikes = 0;
  // A stroke without a reading breaks the run, so readings either side of a dropout aren't compared.
  let prev: number | null = null;
  for (const s of all) {
    if (s.hr === null) {
      prev = null;
      run = 0;
      continue;
    }
    run = s.hr === prev ? run + s.seconds : s.seconds;
    if (run >= STUCK_SECONDS && run > (stuck?.seconds ?? 0)) stuck = { bpm: s.hr, seconds: run };
    if (prev !== null && Math.abs(s.hr - prev) >= SPIKE_BPM) spikes += 1;
    prev = s.hr;
  }
  const highest = Math.max(...withHr.map((s) => s.hr!));
  return {
    coverage,
    stuck,
    spikes,
    aboveMax: maxHeartRate && highest > maxHeartRate ? highest : null,
    usable: coverage >= MIN_COVERAGE && !stuck,
  };
}

function zones(all: Sample[], maxHeartRate: number): ZoneTime[] {
  const out: ZoneTime[] = ZONE_FLOORS.map((floor, i) => ({ floor, ceiling: ZONE_FLOORS[i + 1] ?? null, seconds: 0 }));
  for (const s of all) {
    if (s.hr === null) continue;
    const share = s.hr / maxHeartRate;
    let zone = 0;
    while (zone + 1 < ZONE_FLOORS.length && share >= ZONE_FLOORS[zone + 1]) zone++;
    out[zone].seconds += s.seconds;
  }
  return out;
}

/** Time-weighted average watts and heart rate over strokes that have both. */
function averages(part: Sample[]): { watts: number; hr: number } | null {
  let seconds = 0;
  let w = 0;
  let hr = 0;
  for (const s of part) {
    if (s.watts === null || s.hr === null) continue;
    seconds += s.seconds;
    w += s.watts * s.seconds;
    hr += s.hr * s.seconds;
  }
  return seconds > 0 ? { watts: w / seconds, hr: hr / seconds } : null;
}

function variation(part: Sample[]): number {
  const minutes = new Map<number, { w: number; seconds: number }>();
  for (const s of part) {
    if (s.watts === null) continue;
    const m = minutes.get(Math.floor(s.end / 60)) ?? { w: 0, seconds: 0 };
    m.w += s.watts * s.seconds;
    m.seconds += s.seconds;
    minutes.set(Math.floor(s.end / 60), m);
  }
  // Partial minutes at the edges would skew the spread.
  const values = [...minutes.values()].filter((m) => m.seconds >= 30).map((m) => m.w / m.seconds);
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sd = Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length);
  return mean > 0 ? sd / mean : 0;
}

/**
 * Decoupling compares watts per beat in the first and second half of a steady
 * piece after the warm-up (Friel's Pw:HR). Watts, not pace: on an erg watts
 * track energy cost, while pace moves a third as much for the same change.
 */
function decoupling(all: Sample[]): Decoupling | null {
  const window = all.filter((s) => s.end > WARM_UP_SECONDS);
  if (window.length === 0) return null;
  const start = window[0].end - window[0].seconds;
  const middle = start + (window[window.length - 1].end - start) / 2;
  const first = averages(window.filter((s) => s.end <= middle));
  const second = averages(window.filter((s) => s.end > middle));
  if (!first || !second || first.watts === 0) return null;
  const firstEf = first.watts / first.hr;
  const secondEf = second.watts / second.hr;
  return {
    percent: ((firstEf - secondEf) / firstEf) * 100,
    first,
    second,
    variation: variation(window),
  };
}

export function analyzeEffort(
  raw: Concept2Stroke[],
  type: MachineType,
  opts: { maxHeartRate: number | null; intervals: boolean },
): EffortAnalysis {
  const all = samples(raw, type);
  const workSeconds = all.length ? all[all.length - 1].end : 0;
  const q = quality(all, opts.maxHeartRate);
  const usable = Boolean(q?.usable);

  const decouplingSkipped = !usable
    ? null
    : opts.intervals
      ? "intervals"
      : workSeconds - WARM_UP_SECONDS < MIN_DECOUPLING_SECONDS
        ? "too short"
        : null;

  const d = usable && !decouplingSkipped ? decoupling(all) : null;
  // Heart rate lags effort, and work/rest swings muddle it, so efficiency is for continuous pieces after the warm-up.
  const steady =
    usable && !opts.intervals && workSeconds >= MIN_EFFICIENCY_SECONDS
      ? averages(all.filter((s) => s.end > WARM_UP_SECONDS))
      : null;
  return {
    workSeconds,
    quality: q,
    zones: usable && opts.maxHeartRate ? zones(all, opts.maxHeartRate) : null,
    efficiency: steady ? steady.watts / steady.hr : null,
    decoupling: d,
    decouplingSkipped,
  };
}
