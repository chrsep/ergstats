import { requireMcpAuth } from "@better-auth/mcp";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { and, count, eq, gt } from "drizzle-orm";

import { db } from "@/db";
import { agentFeedback } from "@/db/app-schema";
import { account, oauthConsent } from "@/db/schema";
import { appUrl, mcpUrl, resourceMetadataUrl } from "@/lib/app-url";
import { auth, CONCEPT2_PROVIDER_ID } from "@/lib/auth";
import { Concept2Client } from "@/lib/concept2/client";
import { createMcpTelemetry } from "@/lib/observability/mcp";
import { API_KEY_PREFIX, type AuthorizedHandler, createErgstatsMcpHandler, type KeyCheck, type QuotaCheck } from "./handler";
import { MCP_SCOPE } from "./scopes";
import type { AgentFeedback } from "./tools";
import { consumeUserQuota } from "./user-quota";

class NotConnectedError extends Error {
  name = "NotConnectedError";
  constructor(
    message: string,
    /** For analytics: no Concept2 account linked, or its token could not be refreshed. */
    readonly reason: "no_account" | "refresh_failed",
  ) {
    super(message);
  }
}

const telemetry = createMcpTelemetry();

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
  if (typeof userId !== "string") throw new NotConnectedError("Missing credentials.", "no_account");

  const [row] = await db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, CONCEPT2_PROVIDER_ID)))
    .limit(1);
  if (!row) {
    throw new NotConnectedError(`No Concept2 Logbook is connected. Sign in at ${appUrl()} to connect it.`, "no_account");
  }

  // Refreshes the Concept2 token (and stores the rotated refresh token) when it is about to expire.
  let accessToken: string | undefined;
  try {
    ({ accessToken } = await auth.api.getAccessToken({ body: { accountId: row.id, userId } }));
  } catch (error) {
    console.error("[mcp] Concept2 token refresh failed", error);
  }
  if (!accessToken) {
    throw new NotConnectedError(
      `Your Concept2 connection has expired. Sign in at ${appUrl()} again to reconnect.`,
      "refresh_failed",
    );
  }
  return new Concept2Client({ accessToken, fetch: telemetry?.fetch });
}

/** OAuth callers get the same budget as an API key: 120 requests a minute, per user. */
function consumeQuota(authInfo: AuthInfo): Promise<QuotaCheck> {
  const userId = authInfo.extra?.userId;
  if (typeof userId !== "string") throw new Error("Missing credentials.");
  return consumeUserQuota(userId);
}

/** Reports one account may send a day, so a looping agent can't flood the table. */
const FEEDBACK_PER_DAY = 20;

/** Which app is calling: the host of its Client ID Metadata Document, "registered" for dynamic registration, or "api_key". */
function clientLabel(authInfo: AuthInfo): string | null {
  if (authInfo.token.startsWith(API_KEY_PREFIX)) return "api_key";
  if (!authInfo.clientId) return null;
  if (!authInfo.clientId.startsWith("https://")) return "registered";
  try {
    return new URL(authInfo.clientId).host;
  } catch {
    return "registered";
  }
}

async function saveFeedback(authInfo: AuthInfo | undefined, feedback: AgentFeedback): Promise<boolean> {
  const userId = authInfo?.extra?.userId;
  if (!authInfo || typeof userId !== "string") throw new Error("Missing credentials.");

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [{ sent }] = await db
    .select({ sent: count() })
    .from(agentFeedback)
    .where(and(eq(agentFeedback.userId, userId), gt(agentFeedback.createdAt, since)));
  if (sent >= FEEDBACK_PER_DAY) return false;

  await db.insert(agentFeedback).values({
    userId,
    type: feedback.type,
    summary: feedback.summary,
    tool: feedback.tool ?? null,
    client: clientLabel(authInfo),
  });
  return true;
}

export const mcpHandler = createErgstatsMcpHandler({
  verifyKey,
  withOAuth,
  consumeQuota,
  getClient,
  saveFeedback,
  dashboardUrl: `${appUrl()}/dashboard`,
  resourceMetadataUrl: resourceMetadataUrl(),
  telemetry,
  onToolError: telemetry?.toolFailed,
});
