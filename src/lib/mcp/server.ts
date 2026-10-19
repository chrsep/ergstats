import type { AuthInfo } from "@modelcontextprotocol/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { account } from "@/db/schema";
import { appUrl } from "@/lib/app-url";
import { auth, CONCEPT2_PROVIDER_ID } from "@/lib/auth";
import { Concept2Client } from "@/lib/concept2/client";
import { createErgstatsMcpHandler, type KeyCheck } from "./handler";

class NotConnectedError extends Error {
  name = "NotConnectedError";
}

async function verifyKey(key: string): Promise<KeyCheck> {
  const result = await auth.api.verifyApiKey({ body: { key } });
  if (result.valid && result.key) {
    return {
      ok: true,
      authInfo: {
        token: key,
        clientId: result.key.id,
        scopes: [],
        extra: { userId: result.key.referenceId },
      },
    };
  }
  if (result.error?.code === "RATE_LIMITED") {
    const tryAgainIn = (result.error as { details?: { tryAgainIn?: number } }).details?.tryAgainIn;
    return {
      ok: false,
      status: 429,
      message: "Too many requests for this API key. Slow down and try again shortly.",
      retryAfterSeconds: tryAgainIn ? Math.ceil(tryAgainIn / 1000) : 60,
    };
  }
  return {
    ok: false,
    status: 401,
    message: `This API key is invalid, expired or revoked. Create a new one at ${appUrl()}/dashboard.`,
  };
}

async function getClient(authInfo: AuthInfo | undefined): Promise<Concept2Client> {
  const userId = authInfo?.extra?.userId;
  if (typeof userId !== "string") throw new NotConnectedError("Missing API key.");

  const [row] = await db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, CONCEPT2_PROVIDER_ID)))
    .limit(1);
  if (!row) {
    throw new NotConnectedError(`No Concept2 Logbook is connected. Sign in at ${appUrl()} to connect it.`);
  }

  // Refreshes the Concept2 token (and stores the rotated refresh token) when it is about to expire.
  let accessToken: string | undefined;
  try {
    ({ accessToken } = await auth.api.getAccessToken({ body: { accountId: row.id, userId } }));
  } catch (error) {
    console.error("[mcp] Concept2 token refresh failed", error);
  }
  if (!accessToken) {
    throw new NotConnectedError(`Your Concept2 connection has expired. Sign in at ${appUrl()} again to reconnect.`);
  }
  return new Concept2Client({ accessToken });
}

export const mcpHandler = createErgstatsMcpHandler({
  verifyKey,
  getClient,
  dashboardUrl: `${appUrl()}/dashboard`,
});
