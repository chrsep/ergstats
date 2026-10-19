/**
 * Shapes returned by the Concept2 Logbook API.
 * Docs: https://log.concept2.com/developers/documentation/
 *
 * Times are in tenths of a second, distances in meters (stroke data uses decimeters).
 */

export type MachineType =
  | "rower"
  | "skierg"
  | "bike"
  | "dynamic"
  | "slides"
  | "paddle"
  | "water"
  | "snow"
  | "rollerski"
  | "multierg";

export interface Concept2HeartRate {
  average?: number;
  min?: number;
  max?: number;
  ending?: number;
  recovery?: number;
  rest?: number;
}

export interface Concept2Split {
  type?: string;
  time: number;
  distance: number;
  calories_total?: number;
  stroke_rate?: number;
  heart_rate?: Concept2HeartRate;
  rest_time?: number;
  rest_distance?: number;
}

export interface Concept2Result {
  id: number;
  user_id: number;
  /** Local date and time, e.g. "2026-10-18 07:30:00". */
  date: string;
  timezone?: string | null;
  date_utc?: string | null;
  distance: number;
  type: MachineType;
  time: number;
  time_formatted?: string;
  workout_type?: string;
  source?: string;
  weight_class?: "H" | "L";
  verified?: boolean;
  ranked?: boolean;
  comments?: string | null;
  stroke_data?: boolean;
  calories_total?: number;
  drag_factor?: number;
  stroke_count?: number;
  stroke_rate?: number;
  heart_rate?: Concept2HeartRate | null;
  rest_distance?: number;
  rest_time?: number;
  workout?: {
    splits?: Concept2Split[];
    intervals?: Concept2Split[];
  } | null;
}

export interface Concept2User {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  gender?: string;
  dob?: string;
  email?: string;
  country?: string;
  profile_image?: string;
  max_heart_rate?: number | null;
  weight?: number | null;
  logbook_privacy?: string;
}

export interface Concept2Stroke {
  /** Elapsed time, tenths of a second. */
  t: number;
  /** Elapsed distance, decimeters. */
  d: number;
  /** Pace, tenths of a second per 500m (per 1000m on the BikeErg). */
  p: number;
  spm: number;
  hr?: number;
}

export interface Concept2Pagination {
  total: number;
  count: number;
  per_page: number;
  current_page: number;
  total_pages: number;
}

export interface Concept2List<T> {
  data: T[];
  meta?: { pagination?: Concept2Pagination };
}
