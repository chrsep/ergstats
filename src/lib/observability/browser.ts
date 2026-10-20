import type { PostHog } from "posthog-js";

import { deploymentEnvironment, POSTHOG_HOSTS, POSTHOG_TOKEN, RELAY_PATH } from "./config";
import { scrubUrlProperties } from "./scrub";

/**
 * Browser analytics: pageviews, web vitals and uncaught errors, nothing else.
 *
 * - Cookieless: PostHog stores nothing in the browser and counts visitors with
 *   a daily-rotating server-side hash, so there is no consent banner to show.
 * - No person profiles, no identify: signed-in visitors stay as anonymous as
 *   everyone else. Server events use a separate pseudonymous id.
 * - No autocapture, heatmaps, session replay or surveys, and remote config is
 *   off, so none of them can be switched on from the PostHog UI either.
 * - Do Not Track and Global Privacy Control turn it off entirely, and so does
 *   the switch on /privacy.
 * - Events go to our own origin (see src/app/pulse), which drops cookies.
 *
 * The SDK is a separate chunk loaded in the background, so it never delays the first paint or hydration.
 */
let loading: Promise<PostHog | null> | undefined;

/**
 * Where someone's analytics choice is kept. It is the one thing analytics ever
 * writes to the browser, and only after they ask for it to be off.
 */
const OPT_OUT_KEY = "ergstats:analytics-off";

/**
 * - on: counted, the default.
 * - off: turned off on the privacy page.
 * - browser: the browser sends Do Not Track or Global Privacy Control.
 * - unavailable: analytics isn't set up on this deployment.
 */
export type AnalyticsState = "on" | "off" | "browser" | "unavailable";

const listeners = new Set<() => void>();

/** The choice for this page when local storage is blocked. */
let optedOutHere: boolean | undefined;

function optedOut(): boolean {
  if (optedOutHere !== undefined) return optedOutHere;
  try {
    return window.localStorage.getItem(OPT_OUT_KEY) === "1";
  } catch {
    return false;
  }
}

/** The same signals posthog-js checks for respect_dnt. */
function browserSaysNo(): boolean {
  const nav = window.navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };
  const win = window as Window & { doNotTrack?: string };
  const yes = (value: unknown) => value === "1" || value === "yes" || value === 1 || value === true;
  return [nav.doNotTrack, nav.msDoNotTrack, win.doNotTrack, nav.globalPrivacyControl].some(yes);
}

export function analyticsState(): AnalyticsState {
  if (!POSTHOG_TOKEN) return "unavailable";
  if (browserSaysNo()) return "browser";
  return optedOut() ? "off" : "on";
}

/** For useSyncExternalStore: fires when the choice changes here or in another tab. */
export function subscribeAnalyticsState(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function setAnalyticsEnabled(enabled: boolean): void {
  try {
    if (enabled) window.localStorage.removeItem(OPT_OUT_KEY);
    else window.localStorage.setItem(OPT_OUT_KEY, "1");
    optedOutHere = undefined;
  } catch {
    // Storage blocked: the choice lasts for this page only.
    optedOutHere = !enabled;
  }
  if (enabled) void loadAnalytics();
  for (const listener of listeners) listener();
}

export function loadAnalytics(): Promise<PostHog | null> {
  if (!POSTHOG_TOKEN || typeof window === "undefined" || optedOut()) return Promise.resolve(null);
  loading ??= import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.init(POSTHOG_TOKEN!, {
        api_host: RELAY_PATH,
        ui_host: POSTHOG_HOSTS.app,
        defaults: "2026-05-30",
        cookieless_mode: "always",
        person_profiles: "never",
        respect_dnt: true,
        advanced_disable_flags: true,
        capture_pageview: "history_change",
        capture_pageleave: true,
        capture_performance: { web_vitals: true, network_timing: false },
        capture_exceptions: true,
        autocapture: false,
        rageclick: false,
        capture_dead_clicks: false,
        capture_heatmaps: false,
        disable_session_recording: true,
        disable_surveys: true,
        disable_product_tours: true,
        disable_conversations: true,
        disable_web_experiments: true,
        mask_personal_data_properties: true,
        // Flagging localhost visits as test users needs person profiles, which are off.
        internal_or_test_user_hostname: null,
        before_send: (event) => {
          // The SDK may already be running when someone turns analytics off.
          if (!event || optedOut()) return null;
          scrubUrlProperties(event.properties);
          event.properties.environment = deploymentEnvironment();
          return event;
        },
      });
      return posthog;
    })
    .catch(() => null);
  return loading;
}

/** A product event from the browser. Keep properties free of anything that identifies a person. */
export function captureClientEvent(event: string, properties?: Record<string, string | number | boolean>): void {
  void loadAnalytics().then((posthog) => posthog?.capture(event, properties));
}

/** Errors React caught in an error boundary, which never reach window.onerror. */
export function captureClientError(error: unknown, properties?: Record<string, string | undefined>): void {
  void loadAnalytics().then((posthog) => posthog?.captureException(error, properties));
}

/** The id Next.js gives a server error, which matches the server-side report. */
export function errorDigest(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : undefined;
}
