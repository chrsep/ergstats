import type { Concept2Result, Concept2Split, Concept2Stroke } from "../types";

/**
 * A realistic year of training for token-budget tests: about five sessions a
 * week of steady rows, intervals, 2k tests, SkiErg and BikeErg, with splits and
 * heart rate the way ErgData logs them. Deterministic, so sizes are comparable
 * between runs.
 */

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const rand = rng(42);
const jitter = (base: number, spread: number) => Math.round(base + (rand() * 2 - 1) * spread);

function hr(avg: number) {
  return { average: avg, min: avg - jitter(25, 5), max: avg + jitter(8, 3), ending: avg + jitter(5, 3) };
}

function splitsByTime(totalTenths: number, splitTenths: number, pace500: number): Concept2Split[] {
  const out: Concept2Split[] = [];
  for (let t = 0; t < totalTenths; t += splitTenths) {
    const time = Math.min(splitTenths, totalTenths - t);
    const pace = jitter(pace500, 15);
    out.push({
      time,
      distance: Math.round((time / pace) * 500),
      stroke_rate: jitter(21, 1),
      calories_total: jitter(40, 4),
      wattminutes_total: jitter(240, 20),
      heart_rate: hr(jitter(145, 6)),
    });
  }
  return out;
}

function splitsByDistance(total: number, split: number, pace500: number): Concept2Split[] {
  const out: Concept2Split[] = [];
  for (let d = 0; d < total; d += split) {
    const distance = Math.min(split, total - d);
    out.push({
      type: "distance",
      time: Math.round((distance / 500) * jitter(pace500, 12)),
      distance,
      stroke_rate: jitter(24, 2),
      calories_total: jitter(60, 6),
      wattminutes_total: jitter(400, 30),
      heart_rate: hr(jitter(160, 8)),
    });
  }
  return out;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

function base(id: number, date: string): Omit<Concept2Result, "distance" | "type" | "time"> {
  return {
    id,
    user_id: 123,
    date,
    timezone: "Asia/Jakarta",
    // Jakarta is UTC+7.
    date_utc: new Date(Date.parse(`${date.replace(" ", "T")}Z`) - 7 * 3_600_000).toISOString().replace("T", " ").slice(0, 19),
    source: "ErgData iOS",
    weight_class: "H",
    verified: true,
    ranked: false,
    privacy: "partners",
    stroke_data: true,
    drag_factor: jitter(120, 6),
  };
}

function workout(id: number, date: string, kind: number): Concept2Result {
  const b = base(id, date);
  switch (kind) {
    case 0: {
      // 10k steady, 2k splits.
      const splits = splitsByDistance(10000, 2000, 1250);
      const time = sum(splits.map((s) => s.time));
      return { ...b, type: "rower", workout_type: "FixedDistanceSplits", distance: 10000, time, stroke_rate: 20, stroke_count: 1000, heart_rate: hr(148), calories_total: 620, workout: { splits } };
    }
    case 1: {
      // 30 minutes steady, 5 minute splits.
      const splits = splitsByTime(18000, 3000, 1260);
      const distance = sum(splits.map((s) => s.distance));
      return { ...b, type: "rower", workout_type: "FixedTimeSplits", distance, time: 18000, stroke_rate: 21, stroke_count: 630, heart_rate: hr(144), calories_total: 390, workout: { splits } };
    }
    case 2: {
      // 8 x 500m / 1:30r.
      const intervals: Concept2Split[] = Array.from({ length: 8 }, () => ({
        type: "distance",
        time: jitter(1080, 15),
        distance: 500,
        stroke_rate: jitter(31, 1),
        calories_total: jitter(35, 3),
        rest_time: 900,
        rest_distance: jitter(40, 10),
        heart_rate: { ...hr(jitter(170, 5)), rest: jitter(130, 6) },
      }));
      return {
        ...b,
        type: "rower",
        workout_type: "FixedDistanceInterval",
        distance: 4000,
        time: sum(intervals.map((s) => s.time)),
        rest_time: 7200,
        rest_distance: sum(intervals.map((s) => s.rest_distance ?? 0)),
        stroke_rate: 31,
        stroke_count: 420,
        heart_rate: hr(165),
        calories_total: 290,
        workout: { targets: { pace: 1080, stroke_rate: 30 }, intervals },
        comments: rand() < 0.3 ? "Held the target pace on all but the last one." : undefined,
      };
    }
    case 3: {
      // SkiErg 20 minutes.
      const splits = splitsByTime(12000, 2400, 1300);
      return { ...b, type: "skierg", workout_type: "FixedTimeSplits", distance: sum(splits.map((s) => s.distance)), time: 12000, stroke_rate: 36, stroke_count: 720, heart_rate: hr(150), calories_total: 260, workout: { splits } };
    }
    case 4: {
      // BikeErg 45 minutes (pace per 1000m).
      const splits = splitsByTime(27000, 3000, 1100);
      return { ...b, type: "bike", workout_type: "FixedTimeSplits", distance: sum(splits.map((s) => s.distance)) * 2, time: 27000, stroke_rate: 85, stroke_count: 3800, heart_rate: hr(138), calories_total: 520, workout: { splits } };
    }
    default: {
      // 2k test, 500m splits.
      const splits = splitsByDistance(2000, 500, 1140);
      return {
        ...b,
        ranked: true,
        type: "rower",
        workout_type: "FixedDistanceSplits",
        distance: 2000,
        time: sum(splits.map((s) => s.time)),
        stroke_rate: 30,
        stroke_count: 230,
        heart_rate: hr(178),
        calories_total: 140,
        workout: { targets: { pace: 1130, stroke_rate: 30 }, splits },
        comments: "2k test. Went out a bit hard, held on in the last 500.",
      };
    }
  }
}

/** Newest first, like the Logbook API: a year ending 2026-10-19. */
export const logbook: Concept2Result[] = (() => {
  const out: Concept2Result[] = [];
  const end = Date.UTC(2026, 9, 19);
  let id = 200000;
  for (let day = 0; day < 365; day++) {
    if (day % 7 === 2 || day % 7 === 5) continue; // two rest days a week
    const date = new Date(end - day * 86_400_000).toISOString().slice(0, 10);
    const kind = day % 42 === 0 ? 5 : [0, 1, 2, 3, 4, 1][day % 6];
    out.push(workout(id--, `${date} 06:${String(jitter(30, 25)).padStart(2, "0")}:00`, kind));
  }
  return out;
})();

/** Per-stroke data for a steady hour: about 1,300 strokes at 20spm. */
export function steadyHourStrokes(): Concept2Stroke[] {
  const r = rng(7);
  const out: Concept2Stroke[] = [];
  let t = 0;
  let d = 0;
  while (t < 36000) {
    const spm = 20 + Math.round(r() * 2);
    const p = 1250 + Math.round((r() * 2 - 1) * 30);
    t += Math.round(600 / spm);
    d += Math.round((50000 / p) * (600 / spm) / 10);
    out.push({ t, d, p, spm, hr: 140 + Math.round(r() * 12) });
  }
  return out;
}
