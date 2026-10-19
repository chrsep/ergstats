import { PostHog } from "posthog-node";

import { deploymentEnvironment, POSTHOG_HOSTS, POSTHOG_TOKEN, release } from "./config";
import { pseudonymFor } from "./pseudonym";

/**
 * The server-side PostHog client: product events, MCP tool calls, exceptions
 * and traces. Events carry a pseudonymous id (see pseudonym.ts) and never an
 * email, a name or workout data.
 *
 * GeoIP is off for every server event: PostHog would see the IP of the Vercel
 * function, not the person, and put everyone in Singapore.
 */
let client: PostHog | null | undefined;

export function posthogServer(): PostHog | null {
  if (client !== undefined) return client;
  // Without the secret there is no way to pseudonymize people, so nothing is sent.
  client = POSTHOG_TOKEN && process.env.BETTER_AUTH_SECRET
    ? new PostHog(POSTHOG_TOKEN, {
        host: POSTHOG_HOSTS.ingest,
        disableGeoip: true,
        // Next.js reports uncaught errors to src/instrumentation.ts, which sends them with context.
        enableExceptionAutocapture: false,
        // Functions flush at the end of each request (see telemetry.ts), so batching is all that's needed here.
        flushAt: 50,
        traces: { serviceName: "ergstats", serviceVersion: release(), environment: deploymentEnvironment() },
        before_send: (event) => {
          event.properties = { ...event.properties, environment: deploymentEnvironment(), $geoip_disable: true };
          return event;
        },
      })
    : null;
  return client;
}

export type EventProperties = Record<string, string | number | boolean | null | undefined>;

/**
 * Who an event is about: the pseudonym of a signed-in user, or a throwaway id
 * that never creates a person when there is nobody to attribute it to.
 */
function subject(userId: string | undefined): { distinctId: string; personless: boolean } {
  return userId ? { distinctId: pseudonymFor(userId), personless: false } : { distinctId: crypto.randomUUID(), personless: true };
}

export function captureServerEvent(event: string, properties: EventProperties = {}, userId?: string): void {
  captureEvent(posthogServer(), event, properties, userId);
}

export function captureServerError(error: unknown, properties: EventProperties = {}, userId?: string): void {
  captureError(posthogServer(), error, properties, userId);
}

export function captureEvent(ph: PostHog | null, event: string, properties: EventProperties, userId?: string): void {
  if (!ph) return;
  const { distinctId, personless } = subject(userId);
  ph.capture({
    distinctId,
    event,
    properties: { ...properties, ...(personless ? { $process_person_profile: false } : {}) },
  });
}

export function captureError(ph: PostHog | null, error: unknown, properties: EventProperties, userId?: string): void {
  if (!ph) return;
  const { distinctId, personless } = subject(userId);
  ph.captureException(error, distinctId, {
    ...properties,
    release: release(),
    ...(personless ? { $process_person_profile: false } : {}),
  });
}
