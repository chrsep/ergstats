/**
 * PostHog settings shared by the browser and the server. Everything is off
 * until NEXT_PUBLIC_POSTHOG_TOKEN is set, so local dev, tests and forks send nothing.
 */

/** The project token (`phc_...`). It is public by design: it can only write events. */
export const POSTHOG_TOKEN = process.env.NEXT_PUBLIC_POSTHOG_TOKEN || undefined;

/**
 * The token for server-side events, traces and logs. Those also need
 * BETTER_AUTH_SECRET, which keys the pseudonymous ids, so without it nothing is sent.
 */
export function serverToken(): string | undefined {
  return process.env.BETTER_AUTH_SECRET ? POSTHOG_TOKEN : undefined;
}

/** EU Cloud (Frankfurt) unless the project lives in US Cloud. */
const region = process.env.NEXT_PUBLIC_POSTHOG_REGION === "us" ? "us" : "eu";

/** Where the data lives, for the privacy page. */
export const POSTHOG_REGION_NAME = region === "us" ? "the US" : "the EU (Frankfurt)";

export const POSTHOG_HOSTS = {
  ingest: `https://${region}.i.posthog.com`,
  assets: `https://${region}-assets.i.posthog.com`,
  app: `https://${region}.posthog.com`,
};

/**
 * Same-origin path the browser sends events to; src/app/pulse relays them to
 * PostHog. Deliberately not "/analytics" or "/posthog", which blocklists match.
 */
export const RELAY_PATH = "/pulse";

/** production, preview or development: every event carries it so previews never pollute the dashboards. */
export function deploymentEnvironment(): string {
  return process.env.VERCEL_ENV || process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV || "development";
}

/** The deployed commit, so errors and slow calls can be tied to a release. */
export function release(): string | undefined {
  return process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || undefined;
}
