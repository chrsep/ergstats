import { createHmac } from "node:crypto";

/**
 * The id PostHog knows a person by: a keyed hash of their ErgStats user id, so
 * events can be counted per person without PostHog holding anything that
 * names them. Only this server, holding BETTER_AUTH_SECRET, can link the two;
 * that is also how a GDPR erasure request finds a person's events (recompute
 * the id, then delete that person in PostHog).
 */
export function pseudonymFor(userId: string): string {
  const key = process.env.BETTER_AUTH_SECRET ?? "";
  const digest = createHmac("sha256", key).update(`posthog:${userId}`).digest("base64url");
  return `u_${digest.slice(0, 22)}`;
}
