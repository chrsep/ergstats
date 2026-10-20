import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { agentFeedback } from "@/db/app-schema";
import { apikey, oauthAccessToken, oauthClient, oauthConsent, oauthRefreshToken, verification } from "@/db/schema";
import { erasePosthogPerson } from "@/lib/observability/erase";

/**
 * Everything ErgStats keeps about a person that Better Auth's own user deletion
 * leaves behind. Better Auth then deletes their sessions, their Concept2 account
 * link (with the encrypted Concept2 tokens) and the user row itself.
 *
 * Concept2 has no endpoint to revoke a token, so deleting our only copy is how
 * the Logbook access ends. Workouts are never stored here: every tool call
 * reads them live from Concept2.
 *
 * Consents go first: /mcp checks one on every request, so deleting them cuts
 * off connected apps at once, even with access tokens that haven't expired.
 * Neon's HTTP driver has no interactive transactions; if a step fails the user
 * still exists and deleting again picks up where this stopped.
 *
 * Anything added later that stores data per person (analytics, synced
 * workouts...) must be erased here too.
 */
export async function purgeUserData(userId: string): Promise<void> {
  await db.delete(oauthConsent).where(eq(oauthConsent.userId, userId));
  await db.delete(oauthAccessToken).where(eq(oauthAccessToken.userId, userId));
  await db.delete(oauthRefreshToken).where(eq(oauthRefreshToken.userId, userId));
  // API keys reference their owner without a foreign key, so nothing cascades to them.
  await db.delete(apikey).where(eq(apikey.referenceId, userId));
  // Clients registered while signed in belong to that person. Shared clients
  // (Claude's and ChatGPT's metadata documents, anonymous registrations) have no owner.
  await db.delete(oauthClient).where(eq(oauthClient.userId, userId));
  // Pending authorization codes and similar short-lived records name the user
  // inside a JSON value. User ids are long random strings, so a substring match is exact enough.
  await db.delete(verification).where(sql`position(${userId} in ${verification.value}) > 0`);
  // The foreign key cascades too; deleting here keeps this list complete.
  await db.delete(agentFeedback).where(eq(agentFeedback.userId, userId));
  // Their PostHog profile and server-side events. Best effort: it never blocks the deletion.
  await erasePosthogPerson(userId);
}
