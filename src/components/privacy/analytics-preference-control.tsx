"use client";

import { useSyncExternalStore } from "react";

import { analyticsState, setAnalyticsEnabled, subscribeAnalyticsState } from "@/lib/observability/browser";
import { AnalyticsPreference } from "./analytics-preference";

/** The switch wired to this browser's setting. The server renders it as loading, since only the browser knows. */
export function AnalyticsPreferenceControl() {
  const state = useSyncExternalStore(subscribeAnalyticsState, analyticsState, () => "loading" as const);
  return <AnalyticsPreference state={state} onChange={setAnalyticsEnabled} />;
}
