import {
  continuousStrokes,
  formatDistance,
  formatPace,
  formatTenths,
  isInterval,
  localDate,
  machineLabel,
  paceUnit,
  watts,
  weekStart,
} from "./format";
import type { Concept2Result, Concept2Split, Concept2Stroke, Concept2Targets, MachineType } from "./types";

/** Concept2 sends 0 for a heart rate it didn't record; treat that as missing. */
function reading(value: number | null | undefined): number | null {
  return typeof value === "number" && value > 0 ? value : null;
}

/** One workout, compact enough to list dozens of them in a model's context. */
export interface WorkoutSummary {
  id: number;
  /** Local time Concept2 logged the workout, which is when it ended. */
  date: string;
  /** Local start time: the logged end time minus work and rest time. */
  startedAt: string | null;
  dateUtc: string | null;
  timezone: string | null;
  machine: MachineType;
  workoutType: string | null;
  distanceMeters: number;
  time: string;
  timeSeconds: number;
  pace: string | null;
  watts: number | null;
  strokeRate: number | null;
  strokeCount: number | null;
  heartRateAvg: number | null;
  heartRateMax: number | null;
  calories: number | null;
  dragFactor: number | null;
  restTime: string | null;
  restMeters: number | null;
  verified: boolean;
  ranked: boolean;
  source: string | null;
  comments: string | null;
  hasStrokeData: boolean;
}

export function summarizeWorkout(r: Concept2Result): WorkoutSummary {
  return {
    id: r.id,
    date: r.date,
    startedAt: startedAt(r),
    dateUtc: r.date_utc ?? null,
    timezone: r.timezone ?? null,
    machine: r.type,
    workoutType: r.workout_type ?? null,
    distanceMeters: r.distance,
    time: formatTenths(r.time),
    timeSeconds: r.time / 10,
    pace: formatPace(r.time, r.distance, r.type),
    watts: watts(r.time, r.distance, r.type),
    strokeRate: r.stroke_rate || null,
    strokeCount: r.stroke_count || null,
    heartRateAvg: reading(r.heart_rate?.average),
    heartRateMax: reading(r.heart_rate?.max),
    calories: r.calories_total ?? null,
    dragFactor: r.drag_factor || null,
    restTime: r.rest_time ? formatTenths(r.rest_time) : null,
    restMeters: r.rest_distance || null,
    verified: Boolean(r.verified),
    ranked: Boolean(r.ranked),
    source: r.source || null,
    comments: r.comments?.trim() || null,
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
    w.restTime ? `rest ${w.restTime}` : null,
    `id ${w.id}`,
  ];
  return parts.filter(Boolean).join(" · ");
}

/** workoutLine plus the athlete's comment, shortened, for lists. */
export function workoutListLine(w: WorkoutSummary): string {
  if (!w.comments) return workoutLine(w);
  const oneLine = w.comments.replace(/\s+/g, " ");
  return `${workoutLine(w)} · "${oneLine.length > 80 ? `${oneLine.slice(0, 79)}…` : oneLine}"`;
}

export interface HeartRateDetail {
  average: number | null;
  min: number | null;
  max: number | null;
  ending: number | null;
  /** Heart rate at the end of the rest that followed (intervals only). */
  rest: number | null;
  recovery: number | null;
}

function heartRateDetail(hr: Concept2Split["heart_rate"] | null | undefined): HeartRateDetail | null {
  if (!hr) return null;
  const detail = {
    average: reading(hr.average),
    min: reading(hr.min),
    max: reading(hr.max),
    ending: reading(hr.ending),
    rest: reading(hr.rest),
    recovery: reading(hr.recovery),
  };
  return Object.values(detail).some((v) => v !== null) ? detail : null;
}

export interface SplitDetail {
  number: number;
  /** Intervals only: what the interval was set by (time, distance, calorie or wattminute). */
  kind: string | null;
  /** MultiErg intervals only: the machine used. */
  machine: MachineType | null;
  distanceMeters: number;
  time: string;
  timeSeconds: number;
  pace: string | null;
  watts: number | null;
  strokeRate: number | null;
  calories: number | null;
  wattMinutes: number | null;
  heartRateAvg: number | null;
  heartRate: HeartRateDetail | null;
  restTime: string | null;
  restMeters: number | null;
}

function splitDetail(s: Concept2Split, i: number, type: MachineType, isInterval: boolean): SplitDetail {
  const machine = s.machine ?? type;
  return {
    number: i + 1,
    kind: isInterval ? (s.type ?? null) : null,
    machine: s.machine ?? null,
    distanceMeters: s.distance,
    time: formatTenths(s.time),
    timeSeconds: s.time / 10,
    pace: formatPace(s.time, s.distance, machine),
    watts: watts(s.time, s.distance, machine),
    strokeRate: s.stroke_rate || null,
    calories: s.calories_total ?? null,
    wattMinutes: s.wattminutes_total ?? null,
    heartRateAvg: reading(s.heart_rate?.average),
    heartRate: heartRateDetail(s.heart_rate),
    restTime: s.rest_time ? formatTenths(s.rest_time) : null,
    restMeters: s.rest_distance || null,
  };
}

export interface TargetsDetail {
  strokeRate: number | null;
  heartRateZone: number | null;
  pace: string | null;
  watts: number | null;
  calories: number | null;
}

function targetsDetail(t: Concept2Targets | null | undefined, type: MachineType): TargetsDetail | null {
  if (!t) return null;
  const detail = {
    strokeRate: t.stroke_rate || null,
    heartRateZone: t.heart_rate_zone || null,
    pace: t.pace ? `${formatTenths(t.pace)}/${paceUnit(type) === 1000 ? "1k" : "500m"}` : null,
    watts: t.watts || null,
    calories: t.calories || null,
  };
  return Object.values(detail).some((v) => v !== null) ? detail : null;
}

const LOCAL_TIMESTAMP = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/;

/** Milliseconds for a "YYYY-MM-DD HH:MM:SS" timestamp read as UTC. */
function parseAsUtc(timestamp: string | null | undefined): number | null {
  const m = LOCAL_TIMESTAMP.exec(timestamp ?? "");
  if (!m) return null;
  const ms = Date.parse(`${m[1]}T${m[2]}Z`);
  return Number.isNaN(ms) ? null : ms;
}

/** An instant as "YYYY-MM-DD HH:MM:SS" wall-clock time in an IANA timezone. */
function formatInZone(ms: number, timeZone: string): string | null {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(ms));
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value;
    return `${part("year")}-${part("month")}-${part("day")} ${part("hour")}:${part("minute")}:${part("second")}`;
  } catch {
    return null; // Unknown timezone name.
  }
}

/**
 * Concept2 logs a workout at the time it ended. Subtract work and rest time
 * to get when it started, in the same local time. With a UTC time and a
 * timezone this is exact across daylight-saving changes; without them the
 * local clock is treated as continuous.
 */
export function startedAt(
  r: Pick<Concept2Result, "date" | "date_utc" | "timezone" | "time" | "rest_time">,
): string | null {
  const duration = Math.round((r.time + (r.rest_time ?? 0)) * 100);
  const endUtc = parseAsUtc(r.date_utc);
  if (endUtc !== null && r.timezone) {
    const local = formatInZone(endUtc - duration, r.timezone);
    if (local) return local;
  }
  const endLocal = parseAsUtc(r.date);
  if (endLocal === null) return null;
  return new Date(endLocal - duration).toISOString().replace("T", " ").slice(0, 19);
}

export interface WorkoutDetail extends WorkoutSummary {
  weightClass: "H" | "L" | null;
  privacy: string | null;
  wattMinutes: number | null;
  heartRate: HeartRateDetail | null;
  targets: TargetsDetail | null;
  segmentKind: "intervals" | "splits" | null;
  segments: SplitDetail[];
}

export function workoutDetail(r: Concept2Result): WorkoutDetail {
  const intervals = r.workout?.intervals ?? [];
  const splits = r.workout?.splits ?? [];
  const segmentKind = intervals.length ? "intervals" : splits.length ? "splits" : null;
  const segments = (intervals.length ? intervals : splits).map((s, i) =>
    splitDetail(s, i, r.type, segmentKind === "intervals"),
  );
  return {
    ...summarizeWorkout(r),
    weightClass: r.weight_class ?? null,
    privacy: r.privacy ?? null,
    wattMinutes: r.wattminutes_total ?? null,
    heartRate: heartRateDetail(r.heart_rate),
    targets: targetsDetail(r.workout?.targets, r.type),
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
  watts: number | null;
  strokeRate: number | null;
  metersPerStroke: number | null;
  heartRateAvg: number | null;
  strokes: number;
}

/**
 * Downsample per-stroke data into `buckets` equal slices of distance so a
 * 2k piece (~250 strokes) or a marathon (~15k strokes) costs the same context.
 */
export function bucketStrokes(raw: Concept2Stroke[], type: MachineType, buckets: number): StrokeBucket[] {
  if (raw.length === 0) return [];
  const strokes = continuousStrokes(raw);
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
      watts: watts(time, meters, type),
      strokeRate: Math.round(g.reduce((sum, s) => sum + s.spm, 0) / g.length),
      metersPerStroke: meters > 0 ? Math.round((meters / g.length) * 100) / 100 : null,
      heartRateAvg: hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : null,
      strokes: g.length,
    });
    prev = last;
  }
  return out;
}

export interface StrokeRow {
  /** Stroke number, from 1. */
  n: number;
  /** Interval number, from 1 (always 1 for a single piece). */
  interval: number;
  /** Elapsed work time, counting across intervals. */
  time: string;
  timeSeconds: number;
  /** Elapsed work distance, counting across intervals. */
  meters: number;
  /** The monitor's pace for this stroke. */
  pace: string | null;
  paceSeconds: number | null;
  watts: number | null;
  strokeRate: number;
  metersPerStroke: number;
  heartRate: number | null;
}

/** Per-stroke rows in real units, with interval resets undone. */
export function strokeRows(raw: Concept2Stroke[], type: MachineType): StrokeRow[] {
  const continuous = continuousStrokes(raw);
  const unit = paceUnit(type);
  let interval = 1;
  return continuous.map((s, i) => {
    if (i > 0 && (raw[i].d < raw[i - 1].d || raw[i].t < raw[i - 1].t)) interval += 1;
    const prevD = i > 0 ? continuous[i - 1].d : 0;
    return {
      n: i + 1,
      interval,
      time: formatTenths(s.t),
      timeSeconds: s.t / 10,
      meters: s.d / 10,
      pace: s.p > 0 ? `${formatTenths(s.p)}/${unit === 1000 ? "1k" : "500m"}` : null,
      paceSeconds: s.p > 0 ? s.p / 10 : null,
      watts: s.p > 0 ? watts(s.p, unit, type) : null,
      strokeRate: s.spm,
      metersPerStroke: Math.round(s.d - prevD) / 10,
      heartRate: reading(s.hr),
    };
  });
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
  /** Every week or month in the range, including empty ones, so gaps show. */
  byPeriod: PeriodTotals[];
  longestWorkout: WorkoutSummary | null;
  /** Consistency over the calendar weeks (Monday start) the range touches. Null without a from and to. */
  weekly: { weeks: number; weeksWithTwoPlus: number; sessionsPerWeek: number; secondsPerWeek: number } | null;
  /** The most days between two consecutive workout days. Null with fewer than two workout days. */
  longestGap: { days: number; from: string; to: string } | null;
  /** Days from the last workout to the end of the range. Null without a to. */
  daysSinceLast: number | null;
  truncated: boolean;
}

const DAY_MS = 86_400_000;

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** Week (Monday) or month keys from `from` to `to`, inclusive. */
function periodKeys(from: string, to: string, groupBy: "week" | "month"): string[] {
  const keys: string[] = [];
  if (groupBy === "week") {
    for (let k = weekStart(from); k <= to; k = addDays(k, 7)) keys.push(k);
  } else {
    const end = to.slice(0, 7);
    for (let k = from.slice(0, 7); k <= end; ) {
      keys.push(k);
      const [y, m] = k.split("-").map(Number);
      k = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
    }
  }
  return keys;
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

  const range = opts.from && opts.to && opts.from <= opts.to ? { from: opts.from, to: opts.to } : null;
  if (range) {
    for (const key of periodKeys(range.from, range.to, opts.groupBy)) {
      if (!byPeriod.has(key)) byPeriod.set(key, { sessions: 0, meters: 0, time: 0 });
    }
  }

  let weekly: TrainingSummary["weekly"] = null;
  if (range) {
    const weeks = periodKeys(range.from, range.to, "week");
    const perWeek = new Map<string, number>();
    for (const r of results) {
      const week = weekStart(localDate(r));
      perWeek.set(week, (perWeek.get(week) ?? 0) + 1);
    }
    // Averages over the range's length, so a partial first or last week doesn't count as a whole one.
    const rangeWeeks = (daysBetween(range.from, range.to) + 1) / 7;
    weekly = {
      weeks: weeks.length,
      weeksWithTwoPlus: weeks.filter((w) => (perWeek.get(w) ?? 0) >= 2).length,
      sessionsPerWeek: results.length / rangeWeeks,
      secondsPerWeek: time / 10 / rangeWeeks,
    };
  }

  const days = [...new Set(results.map(localDate))].sort();
  let longestGap: TrainingSummary["longestGap"] = null;
  for (let i = 1; i < days.length; i++) {
    const gap = daysBetween(days[i - 1], days[i]);
    if (!longestGap || gap > longestGap.days) longestGap = { days: gap, from: days[i - 1], to: days[i] };
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
    weekly,
    longestGap,
    daysSinceLast: opts.to && days.length ? daysBetween(days[days.length - 1], opts.to) : null,
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
