import type { Concept2Result, Concept2Stroke, Concept2User } from "../types";

export const user: Concept2User = {
  id: 123,
  username: "rowerchris",
  first_name: "Chris",
  last_name: "Example",
  email: "chris@example.com",
  country: "INA",
  gender: "M",
  dob: "1990-11-02",
  weight: 8250,
  max_heart_rate: 192,
  logbook_privacy: "partners",
};

export const twoK: Concept2Result = {
  id: 1001,
  user_id: 123,
  date: "2026-10-18 07:30:00",
  timezone: "Asia/Jakarta",
  date_utc: "2026-10-18 00:30:00",
  distance: 2000,
  type: "rower",
  time: 4514, // 7:31.4
  workout_type: "FixedDistanceSplits",
  source: "ErgData iOS",
  weight_class: "H",
  stroke_rate: 30,
  heart_rate: { average: 178, max: 190, min: 120, ending: 189, recovery: 0 },
  calories_total: 140,
  wattminutes_total: 1960,
  drag_factor: 125,
  stroke_count: 226,
  stroke_data: true,
  verified: true,
  ranked: true,
  privacy: "everyone",
  comments: "Test day.\nFelt strong in the last 500.",
  metadata: {
    pm_version: 5,
    firmware_version: "211",
    serial_number: "430123456",
    erg_model_type: 0,
    client_version: "ErgData 3.4",
    device: "iPhone",
    device_os: "iOS",
    device_os_version: "26.1",
    hr_type: "BT",
  },
  workout: {
    targets: { stroke_rate: 30, pace: 1130 },
    splits: [
      {
        type: "distance",
        time: 1150,
        distance: 500,
        stroke_rate: 31,
        calories_total: 34,
        heart_rate: { average: 168, min: 120, max: 176, ending: 175 },
      },
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
      {
        type: "distance",
        time: 1075,
        distance: 500,
        stroke_rate: 32,
        rest_time: 1200,
        rest_distance: 0,
        heart_rate: { average: 170, max: 178, ending: 178, rest: 120 },
      },
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

/** Two 500m intervals: Concept2 restarts `t` and `d` at 0 for the second one. */
export const intervalStrokes: Concept2Stroke[] = [
  { t: 30, d: 90, p: 1100, spm: 34, hr: 0 },
  { t: 1075, d: 5000, p: 1080, spm: 32, hr: 170 },
  { t: 25, d: 85, p: 1150, spm: 33, hr: 150 },
  { t: 1075, d: 5000, p: 1070, spm: 32, hr: 175 },
];
