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
  /** Intervals only: what the interval was set by. */
  type?: "time" | "distance" | "calorie" | "wattminute" | string;
  /** Work time for this split or interval, tenths of a second (not cumulative). */
  time: number;
  distance: number;
  calories_total?: number;
  wattminutes_total?: number;
  stroke_rate?: number;
  heart_rate?: Concept2HeartRate;
  rest_time?: number;
  rest_distance?: number;
  /** MultiErg intervals only: the machine used for this interval. */
  machine?: MachineType;
}

/** What the athlete set the monitor to aim for. Only one of pace, watts and calories is set. */
export interface Concept2Targets {
  stroke_rate?: number;
  /** 1 to 5; 0 means no zone was set. */
  heart_rate_zone?: number;
  /** Tenths of a second per 500m (per 1000m on the BikeErg). */
  pace?: number;
  watts?: number;
  calories?: number;
}

/** Device details, returned when a result is fetched with `include=metadata`. */
export interface Concept2Metadata {
  client_version?: string | null;
  pm_version?: string | number | null;
  firmware_version?: string | number | null;
  serial_number?: string | number | null;
  device?: string | null;
  device_os?: string | null;
  device_os_version?: string | null;
  /** 0 = Model D/E, RowErg or Dynamic; 1 = Model C/B; 2 = Model A. */
  erg_model_type?: number | null;
  /** Heart rate monitor connection: BT, ANT or Apple. */
  hr_type?: string | null;
  other?: string | null;
}

export type Concept2Privacy = "private" | "partners" | "logged_in" | "everyone";

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
  privacy?: Concept2Privacy | null;
  stroke_data?: boolean;
  calories_total?: number;
  wattminutes_total?: number;
  drag_factor?: number;
  stroke_count?: number;
  stroke_rate?: number;
  heart_rate?: Concept2HeartRate | null;
  rest_distance?: number;
  rest_time?: number;
  workout?: {
    splits?: Concept2Split[];
    intervals?: Concept2Split[];
    targets?: Concept2Targets | null;
  } | null;
  metadata?: Concept2Metadata | null;
}

export interface Concept2User {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  gender?: string;
  /** YYYY-MM-DD. */
  dob?: string | null;
  email?: string;
  country?: string;
  profile_image?: string;
  max_heart_rate?: number | null;
  /** Hundredths of a kilo (Concept2 says "decigrams"): 7500 is 75kg. */
  weight?: number | null;
  logbook_privacy?: Concept2Privacy;
  age_restricted?: boolean;
  email_permission?: boolean;
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

/** A Concept2 challenge or event (public, not tied to the athlete). */
export interface Concept2Challenge {
  key?: string;
  name: string;
  season?: number | string;
  year?: number | string;
  start: string;
  end: string;
  activity?: string;
  category?: string;
  description?: string;
  short_description?: string;
  link?: string;
  image?: string;
}
