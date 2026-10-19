import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { oauthAccessToken, oauthClient, oauthConsent, oauthRefreshToken } from "@/db/schema";
import type { ConnectedAppRow } from "@/components/dashboard/types";

function hostOf(uri: string | null): string | null {
  if (!uri) return null;
  try {
    return new URL(uri).host;
  } catch {
    return null;
  }
}

/** Apps the user has approved on the consent screen, newest first. */
export async function listConnectedApps(userId: string): Promise<ConnectedAppRow[]> {
  const rows = await db
    .select({
      id: oauthConsent.id,
      clientId: oauthConsent.clientId,
      name: oauthClient.name,
      uri: oauthClient.uri,
      connectedAt: oauthConsent.createdAt,
    })
    .from(oauthConsent)
    .innerJoin(oauthClient, eq(oauthClient.clientId, oauthConsent.clientId))
    .where(eq(oauthConsent.userId, userId))
    .orderBy(desc(oauthConsent.createdAt));
  return rows.map((row) => {
    // A Client ID Metadata Document client is identified by its own HTTPS URL.
    const host = hostOf(row.uri) ?? hostOf(row.clientId);
    return { id: row.id, name: row.name || host || "Unnamed app", host, connectedAt: row.connectedAt };
  });
}

/**
 * Remove an app's access: its tokens, so it can't refresh, then its consent,
 * so /mcp rejects its live access tokens. Tokens go first so a failure partway
 * leaves the consent in place and Disconnect can simply be retried.
 */
export async function disconnectApp(userId: string, consentId: string): Promise<boolean> {
  // Neon's HTTP driver has no interactive transactions, hence the ordering above.
  const [consent] = await db
    .select({ clientId: oauthConsent.clientId })
    .from(oauthConsent)
    .where(and(eq(oauthConsent.id, consentId), eq(oauthConsent.userId, userId)))
    .limit(1);
  if (!consent) return false;
  await db
    .delete(oauthAccessToken)
    .where(and(eq(oauthAccessToken.userId, userId), eq(oauthAccessToken.clientId, consent.clientId)));
  await db
    .delete(oauthRefreshToken)
    .where(and(eq(oauthRefreshToken.userId, userId), eq(oauthRefreshToken.clientId, consent.clientId)));
  await db.delete(oauthConsent).where(eq(oauthConsent.id, consentId));
  return true;
}
