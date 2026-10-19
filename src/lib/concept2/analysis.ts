import {
  formatDistance,
  formatPace,
  formatTenths,
  isInterval,
  localDate,
  machineLabel,
  watts,
  weekStart,
} from "./format";
import type { Concept2Result, Concept2Split, Concept2Stroke, MachineType } from "./types";

/** One workout, compact enough to list dozens of them in a model's context. */
export interface WorkoutSummary {
  id: number;
  date: string;
  machine: MachineType;
  workoutType: string | null;
  distanceMeters: number;
  time: string;
  timeSeconds: number;
  pace: string | null;
  watts: number | null;
  strokeRate: number | null;
  heartRateAvg: number | null;
  calories: number | null;
  hasStrokeData: boolean;
}

export function summarizeWorkout(r: Concept2Result): WorkoutSummary {
  return {
    id: r.id,
    date: r.date,
    machine: r.type,
    workoutType: r.workout_type ?? null,
    distanceMeters: r.distance,
    time: formatTenths(r.time),
    timeSeconds: r.time / 10,
    pace: formatPace(r.time, r.distance, r.type),
    watts: watts(r.time, r.distance, r.type),
    strokeRate: r.stroke_rate ?? null,
    heartRateAvg: r.heart_rate?.average ?? null,
    calories: r.calories_total ?? null,
    hasStrokeData: Boolean(r.stroke_data),
  };
}

export function workoutLine(w: WorkoutSummary): string {
  const parts = [
    w.date.slice(0, 16),
    machineLabel(w.machine),
    formatDistance(w.distanceMeters),
    w.time,
    w.pace,
    w.strokeRate ? `${w.strokeRate}spm` : null,
    w.heartRateAvg ? `${w.heartRateAvg}bpm` : null,
    `id ${w.id}`,
  ];
  return parts.filter(Boolean).join(" · ");
}

export interface SplitDetail {
  number: number;
  distanceMeters: number;
  time: string;
  pace: string | null;
  watts: number | null;
  strokeRate: number | null;
  heartRateAvg: number | null;
  restTime: string | null;
  restMeters: number | null;
}

function splitDetail(s: Concept2Split, i: number, type: MachineType): SplitDetail {
  return {
    number: i + 1,
    distanceMeters: s.distance,
    time: formatTenths(s.time),
    pace: formatPace(s.time, s.distance, type),
    watts: watts(s.time, s.distance, type),
    strokeRate: s.stroke_rate ?? null,
    heartRateAvg: s.heart_rate?.average ?? null,
    restTime: s.rest_time ? formatTenths(s.rest_time) : null,
    restMeters: s.rest_distance ?? null,
  };
}

export interface WorkoutDetail extends WorkoutSummary {
  dragFactor: number | null;
  strokeCount: number | null;
  heartRate: { min: number | null; max: number | null; ending: number | null } | null;
  restTime: string | null;
  restMeters: number | null;
  comments: string | null;
  verified: boolean;
  segmentKind: "intervals" | "splits" | null;
  segments: SplitDetail[];
}

export function workoutDetail(r: Concept2Result): WorkoutDetail {
  const intervals = r.workout?.intervals ?? [];
  const splits = r.workout?.splits ?? [];
  const segmentKind = intervals.length ? "intervals" : splits.length ? "splits" : null;
  const segments = (intervals.length ? intervals : splits).map((s, i) => splitDetail(s, i, r.type));
  return {
    ...summarizeWorkout(r),
    dragFactor: r.drag_factor ?? null,
    strokeCount: r.stroke_count ?? null,
    heartRate: r.heart_rate
      ? { min: r.heart_rate.min ?? null, max: r.heart_rate.max ?? null, ending: r.heart_rate.ending ?? null }
      : null,
    restTime: r.rest_time ? formatTenths(r.rest_time) : null,
    restMeters: r.rest_distance ?? null,
    comments: r.comments ?? null,
    verified: Boolean(r.verified),
    segmentKind,
    segments,
  };
}

export interface StrokeBucket {
  fromMeters: number;
  toMeters: number;
  fromTime: string;
  toTime: string;
  pace: string | null;
  strokeRate: number | null;
  heartRateAvg: number | null;
  strokes: number;
}

/**
 * Downsample per-stroke data into `buckets` equal slices of distance so a
 * 2k piece (~250 strokes) or a marathon (~15k strokes) costs the same context.
 */
export function bucketStrokes(strokes: Concept2Stroke[], type: MachineType, buckets: number): StrokeBucket[] {
  if (strokes.length === 0) return [];
  const totalDecimeters = strokes[strokes.length - 1].d;
  const n = Math.max(1, Math.min(buckets, strokes.length));
  const size = totalDecimeters / n;
  const groups: Concept2Stroke[][] = Array.from({ length: n }, () => []);
  for (const s of strokes) {
    // A stroke ending exactly on a boundary belongs to the segment it finishes.
    const idx = size > 0 ? Math.min(n - 1, Math.max(0, Math.ceil(s.d / size) - 1)) : 0;
    groups[idx].push(s);
  }
  const out: StrokeBucket[] = [];
  let prev: Concept2Stroke = { t: 0, d: 0, p: 0, spm: 0 };
  for (const g of groups) {
    if (g.length === 0) continue;
    const last = g[g.length - 1];
    const meters = (last.d - prev.d) / 10;
    const time = last.t - prev.t;
    const hrs = g.map((s) => s.hr).filter((hr): hr is number => typeof hr === "number" && hr > 0);
    out.push({
      fromMeters: Math.round(prev.d / 10),
      toMeters: Math.round(last.d / 10),
      fromTime: formatTenths(prev.t),
      toTime: formatTenths(last.t),
      pace: formatPace(time, meters, type),
      strokeRate: Math.round(g.reduce((sum, s) => sum + s.spm, 0) / g.length),
      heartRateAvg: hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : null,
      strokes: g.length,
    });
    prev = last;
  }
  return out;
}

export interface PeriodTotals {
  period: string;
  sessions: number;
  meters: number;
  time: string;
  timeSeconds: number;
}

export interface MachineTotals {
  machine: MachineType;
  sessions: number;
  meters: number;
  time: string;
  averagePace: string | null;
}

export interface TrainingSummary {
  from: string | null;
  to: string | null;
  sessions: number;
  meters: number;
  time: string;
  timeSeconds: number;
  byMachine: MachineTotals[];
  byPeriod: PeriodTotals[];
  longestWorkout: WorkoutSummary | null;
  truncated: boolean;
}

export function trainingSummary(
  results: Concept2Result[],
  opts: { from?: string; to?: string; groupBy: "week" | "month"; truncated?: boolean },
): TrainingSummary {
  const byMachine = new Map<MachineType, { sessions: number; meters: number; time: number }>();
  const byPeriod = new Map<string, { sessions: number; meters: number; time: number }>();
  let meters = 0;
  let time = 0;
  let longest: Concept2Result | null = null;

  for (const r of results) {
    meters += r.distance;
    time += r.time;
    if (!longest || r.distance > longest.distance) longest = r;

    const m = byMachine.get(r.type) ?? { sessions: 0, meters: 0, time: 0 };
    m.sessions += 1;
    m.meters += r.distance;
    m.time += r.time;
    byMachine.set(r.type, m);

    const date = localDate(r);
    const key = opts.groupBy === "week" ? weekStart(date) : date.slice(0, 7);
    const p = byPeriod.get(key) ?? { sessions: 0, meters: 0, time: 0 };
    p.sessions += 1;
    p.meters += r.distance;
    p.time += r.time;
    byPeriod.set(key, p);
  }

  return {
    from: opts.from ?? null,
    to: opts.to ?? null,
    sessions: results.length,
    meters,
    time: formatTenths(time),
    timeSeconds: time / 10,
    byMachine: [...byMachine.entries()]
      .sort((a, b) => b[1].meters - a[1].meters)
      .map(([machine, v]) => ({
        machine,
        sessions: v.sessions,
        meters: v.meters,
        time: formatTenths(v.time),
        averagePace: formatPace(v.time, v.meters, machine),
      })),
    byPeriod: [...byPeriod.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([period, v]) => ({
        period,
        sessions: v.sessions,
        meters: v.meters,
        time: formatTenths(v.time),
        timeSeconds: v.time / 10,
      })),
    longestWorkout: longest ? summarizeWorkout(longest) : null,
    truncated: Boolean(opts.truncated),
  };
}

/** The standard ranked events Concept2 tracks. */
export const DISTANCE_EVENTS = [100, 500, 1000, 2000, 5000, 6000, 10000, 21097, 42195] as const;
/** Time events, in tenths of a second: 1, 4, 30 and 60 minutes. */
export const TIME_EVENTS = [600, 2400, 18000, 36000] as const;

export interface PersonalBest {
  event: string;
  machine: MachineType;
  time: string;
  distanceMeters: number;
  pace: string | null;
  watts: number | null;
  date: string;
  workoutId: number;
}

function eventName(kind: "distance" | "time", value: number): string {
  if (kind === "time") return `${value / 600} min`;
  if (value === 21097) return "Half marathon";
  if (value === 42195) return "Marathon";
  return value >= 1000 ? `${value / 1000}k` : `${value}m`;
}

/**
 * Best result per standard event and machine. Like Concept2's rankings this
 * only counts single pieces of exactly that distance or time, not intervals
 * or a 2k split inside a longer row.
 */
export function personalBests(results: Concept2Result[]): PersonalBest[] {
  const best = new Map<string, Concept2Result>();
  for (const r of results) {
    if (isInterval(r)) continue;
    const distanceEvent = (DISTANCE_EVENTS as readonly number[]).includes(r.distance);
    const timeEvent = (TIME_EVENTS as readonly number[]).includes(r.time);
    if (distanceEvent) {
      const key = `${r.type}:d:${r.distance}`;
      const current = best.get(key);
      if (!current || r.time < current.time) best.set(key, r);
    }
    if (timeEvent) {
      const key = `${r.type}:t:${r.time}`;
      const current = best.get(key);
      if (!current || r.distance > current.distance) best.set(key, r);
    }
  }

  const order = (key: string) => {
    const [, kind, value] = key.split(":");
    return (kind === "d" ? 0 : 1e9) + Number(value);
  };

  return [...best.entries()]
    .sort((a, b) => a[1].type.localeCompare(b[1].type) || order(a[0]) - order(b[0]))
    .map(([key, r]) => {
      const [, kind, value] = key.split(":");
      return {
        event: eventName(kind === "d" ? "distance" : "time", Number(value)),
        machine: r.type,
        time: formatTenths(r.time),
        distanceMeters: r.distance,
        pace: formatPace(r.time, r.distance, r.type),
        watts: watts(r.time, r.distance, r.type),
        date: localDate(r),
        workoutId: r.id,
      };
    });
}
