import { requireMcpAuth } from "@better-auth/mcp";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { account, oauthConsent } from "@/db/schema";
import { appUrl, mcpUrl, resourceMetadataUrl } from "@/lib/app-url";
import { auth, CONCEPT2_PROVIDER_ID } from "@/lib/auth";
import { Concept2Client } from "@/lib/concept2/client";
import { type AuthorizedHandler, createErgstatsMcpHandler, type KeyCheck } from "./handler";
import { MCP_SCOPE } from "./scopes";

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

/**
 * OAuth access tokens are JWTs signed by our own authorization server and bound
 * to the /mcp URL. Without a valid one, the 401 points the client at the
 * protected resource metadata, which starts the sign-in flow.
 */
function withOAuth(req: Request, next: AuthorizedHandler): Promise<Response> {
  return requireMcpAuth(
    auth,
    async (request, claims) => {
      const userId = claims.sub;
      const clientId = typeof claims.azp === "string" ? claims.azp : undefined;
      // Disconnecting an app on the dashboard deletes its consent; stop its
      // still-unexpired access tokens right away instead of when they expire,
      // and keep them dead if the app is connected again.
      if (!userId || !clientId || typeof claims.iat !== "number" || !(await hasConsentSince(userId, clientId, claims.iat))) {
        return Response.json(
          { jsonrpc: "2.0", id: null, error: { code: -32001, message: "This connection was removed. Connect ErgStats again." } },
          {
            status: 401,
            headers: {
              "cache-control": "no-store",
              "www-authenticate": `Bearer resource_metadata="${resourceMetadataUrl()}", scope="${MCP_SCOPE}", error="invalid_token"`,
            },
          },
        );
      }
      return next(request, {
        token: request.headers.get("authorization")?.split(" ")[1] ?? "",
        clientId,
        scopes: typeof claims.scope === "string" ? claims.scope.split(" ") : [],
        expiresAt: claims.exp,
        resource: new URL(mcpUrl()),
        extra: { userId },
      });
    },
    { resource: mcpUrl(), requiredScopes: [MCP_SCOPE] },
  )(req);
}

/** Whether the user's consent for this app was granted no later than the token was issued (`iat`, in seconds). */
async function hasConsentSince(userId: string, clientId: string, issuedAt: number): Promise<boolean> {
  const [row] = await db
    .select({ createdAt: oauthConsent.createdAt })
    .from(oauthConsent)
    .where(and(eq(oauthConsent.userId, userId), eq(oauthConsent.clientId, clientId)))
    .limit(1);
  // iat is truncated to whole seconds, so compare at that precision.
  return Boolean(row) && issuedAt >= Math.floor(row.createdAt.getTime() / 1000);
}

async function getClient(authInfo: AuthInfo | undefined): Promise<Concept2Client> {
  const userId = authInfo?.extra?.userId;
  if (typeof userId !== "string") throw new NotConnectedError("Missing credentials.");

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
  withOAuth,
  getClient,
  dashboardUrl: `${appUrl()}/dashboard`,
  resourceMetadataUrl: resourceMetadataUrl(),
});
