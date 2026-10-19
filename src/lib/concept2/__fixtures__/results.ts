import type { Concept2Result, Concept2Stroke, Concept2User } from "../types";

export const user: Concept2User = {
  id: 123,
  username: "rowerchris",
  first_name: "Chris",
  last_name: "Example",
  email: "chris@example.com",
  country: "IDN",
  max_heart_rate: 192,
};

export const twoK: Concept2Result = {
  id: 1001,
  user_id: 123,
  date: "2026-10-18 07:30:00",
  distance: 2000,
  type: "rower",
  time: 4514, // 7:31.4
  workout_type: "FixedDistanceSplits",
  stroke_rate: 30,
  heart_rate: { average: 178, max: 190, min: 120, ending: 189 },
  calories_total: 140,
  drag_factor: 125,
  stroke_count: 226,
  stroke_data: true,
  verified: true,
  workout: {
    splits: [
      { type: "distance", time: 1150, distance: 500, stroke_rate: 31, heart_rate: { average: 168 } },
      { type: "distance", time: 1140, distance: 500, stroke_rate: 29, heart_rate: { average: 177 } },
      { type: "distance", time: 1130, distance: 500, stroke_rate: 29, heart_rate: { average: 182 } },
      { type: "distance", time: 1094, distance: 500, stroke_rate: 33, heart_rate: { average: 187 } },
    ],
  },
};

export const slowTwoK: Concept2Result = {
  ...twoK,
  id: 1000,
  date: "2026-09-02 18:00:00",
  time: 4620,
  stroke_data: false,
  workout: null,
};

export const steadyState: Concept2Result = {
  id: 1002,
  user_id: 123,
  date: "2026-10-14 06:00:00",
  distance: 10000,
  type: "rower",
  time: 24600,
  workout_type: "FixedDistanceSplits",
  stroke_rate: 20,
  heart_rate: { average: 145 },
};

export const thirtyMinSki: Concept2Result = {
  id: 1003,
  user_id: 123,
  date: "2026-10-16 12:00:00",
  distance: 6900,
  type: "skierg",
  time: 18000,
  workout_type: "FixedTimeSplits",
  stroke_rate: 36,
};

export const intervals: Concept2Result = {
  id: 1004,
  user_id: 123,
  date: "2026-10-12 07:00:00",
  distance: 2000,
  type: "rower",
  time: 4300,
  workout_type: "FixedDistanceInterval",
  rest_time: 3600,
  workout: {
    intervals: [
      { type: "distance", time: 1075, distance: 500, stroke_rate: 32, rest_time: 1200 },
      { type: "distance", time: 1075, distance: 500, stroke_rate: 32, rest_time: 1200 },
      { type: "distance", time: 1075, distance: 500, stroke_rate: 32, rest_time: 1200 },
      { type: "distance", time: 1075, distance: 500, stroke_rate: 32, rest_time: 0 },
    ],
  },
};

export const allResults = [twoK, thirtyMinSki, steadyState, intervals, slowTwoK];

/** Strokes for the 2k: 10m per stroke, steady 1:52.9/500m. */
export const twoKStrokes: Concept2Stroke[] = Array.from({ length: 200 }, (_, i) => ({
  t: Math.round(((i + 1) * 4514) / 200),
  d: (i + 1) * 100,
  p: 1129,
  spm: i < 20 ? 34 : 30,
  hr: 150 + Math.floor(i / 5),
}));
