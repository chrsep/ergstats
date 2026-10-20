import { POSTHOG_HOSTS, serverToken } from "./config";
import { pseudonymFor } from "./pseudonym";

const TIMEOUT_MS = 5_000;

export type EraseResult = "queued" | "skipped" | "failed";

/**
 * Deletes a person's PostHog profile and queues deletion of their events, for
 * account deletion. Needs a personal API key with the person:write scope
 * (POSTHOG_PERSONAL_API_KEY) and the project id (POSTHOG_PROJECT_ID); without
 * them this does nothing.
 *
 * It never throws: PostHog being down must not stop someone deleting their
 * account. What it misses stays under a pseudonym that only BETTER_AUTH_SECRET
 * plus the deleted user id could link back to the person. Browser analytics is cookieless and
 * never identified, so there is nothing of theirs to delete there.
 */
export async function erasePosthogPerson(
  userId: string,
  fetchImpl: typeof fetch = fetch,
  // Without the server token no event was ever sent under this person's pseudonym.
  enabled = Boolean(serverToken()),
): Promise<EraseResult> {
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;
  if (!enabled || !apiKey || !projectId) return "skipped";
  try {
    const res = await fetchImpl(`${POSTHOG_HOSTS.app}/api/projects/${encodeURIComponent(projectId)}/persons/bulk_delete/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ distinct_ids: [pseudonymFor(userId)], delete_events: true }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok) return "queued";
    console.error("[account] PostHog person deletion failed", res.status);
  } catch (error) {
    console.error("[account] PostHog person deletion failed", error);
  }
  return "failed";
}
