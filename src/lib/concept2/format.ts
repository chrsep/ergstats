import type { Concept2Result, MachineType } from "./types";

/** Format tenths of a second as h:mm:ss.t or m:ss.t, the way a PM5 shows it. */
export function formatTenths(tenths: number): string {
  if (!Number.isFinite(tenths) || tenths < 0) return "–";
  const rounded = Math.round(tenths);
  const t = rounded % 10;
  const totalSeconds = Math.floor(rounded / 10);
  const s = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const m = totalMinutes % 60;
  const h = Math.floor(totalMinutes / 60);
  const ss = String(s).padStart(2, "0");
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${ss}.${t}`;
  return `${m}:${ss}.${t}`;
}

/** The BikeErg reports pace per 1000m; every other machine per 500m. */
export function paceUnit(type: MachineType): 500 | 1000 {
  return type === "bike" ? 1000 : 500;
}

/** Pace in tenths of a second per 500m (or 1000m on the bike). */
export function paceTenths(timeTenths: number, distance: number, type: MachineType): number | null {
  if (!distance || !timeTenths) return null;
  return (timeTenths / distance) * paceUnit(type);
}

export function formatPace(timeTenths: number, distance: number, type: MachineType): string | null {
  const pace = paceTenths(timeTenths, distance, type);
  return pace === null ? null : `${formatTenths(pace)}/${paceUnit(type) === 1000 ? "1k" : "500m"}`;
}

/**
 * Concept2's pace-to-watts formula: 2.80 / (seconds per meter)^3. The BikeErg
 * flywheel is geared so the same formula reads an eighth as much.
 */
export function watts(timeTenths: number, distance: number, type: MachineType): number | null {
  if (!distance || !timeTenths) return null;
  const secondsPerMeter = timeTenths / 10 / distance;
  const value = 2.8 / secondsPerMeter ** 3;
  return Math.round(type === "bike" ? value / 8 : value);
}

/**
 * Stroke `t` and `d` are running totals that restart at 0 each interval.
 * Rebase them so they keep counting up across the whole workout.
 */
export function continuousStrokes<T extends { t: number; d: number }>(strokes: T[]): T[] {
  let tOffset = 0;
  let dOffset = 0;
  let prev = { t: 0, d: 0 };
  return strokes.map((s) => {
    if (s.d < prev.d || s.t < prev.t) {
      tOffset += prev.t;
      dOffset += prev.d;
    }
    prev = s;
    return { ...s, t: s.t + tOffset, d: s.d + dOffset };
  });
}

export function formatDistance(meters: number): string {
  return `${meters.toLocaleString("en-US")}m`;
}

export const MACHINE_LABELS: Record<MachineType, string> = {
  rower: "RowErg",
  skierg: "SkiErg",
  bike: "BikeErg",
  dynamic: "Dynamic RowErg",
  slides: "RowErg on Slides",
  paddle: "Paddle adapter",
  water: "On-water",
  snow: "On-snow",
  rollerski: "Rollerski",
  multierg: "MultiErg",
};

export function machineLabel(type: MachineType): string {
  return MACHINE_LABELS[type] ?? type;
}

/** The date part of Concept2's local timestamp ("2026-10-18 07:30:00" → "2026-10-18"). */
export function localDate(result: Pick<Concept2Result, "date">): string {
  return result.date.slice(0, 10);
}

/** Monday of the ISO week containing `date` (YYYY-MM-DD), as YYYY-MM-DD. */
export function weekStart(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

export function isInterval(result: Pick<Concept2Result, "workout_type">): boolean {
  return /interval/i.test(result.workout_type ?? "");
}
