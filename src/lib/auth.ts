import { apiKey } from "@better-auth/api-key";
import { cimd } from "@better-auth/cimd";
import { fetchClientMetadataResource } from "@better-auth/cimd/node";
import { mcp } from "@better-auth/mcp";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { genericOAuth, jwt } from "better-auth/plugins";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { purgeUserData } from "@/lib/account-deletion";
import { appUrl, mcpUrl } from "@/lib/app-url";
import { CONCEPT2_SCOPES, concept2BaseUrl, Concept2Client } from "@/lib/concept2/client";
import { MCP_SCOPE } from "@/lib/mcp/scopes";
import { captureServerEvent } from "@/lib/observability/server";

export const CONCEPT2_PROVIDER_ID = "concept2";

const base = concept2BaseUrl();

/** Where an OAuth redirect goes, as a coarse app label: claude.ai, chatgpt.com, or loopback for local clients like Claude Code. */
function redirectHost(url: unknown): string | undefined {
  if (typeof url !== "string") return undefined;
  try {
    const { hostname, protocol } = new URL(url);
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]") return "loopback";
    return protocol === "https:" ? hostname : protocol.replace(/:$/, "");
  } catch {
    return undefined;
  }
}

/**
 * Product events for the sign-up and connection funnel. They carry the
 * pseudonymous id only (see src/lib/observability), never an email or name.
 */
const productEvents = createAuthMiddleware(async (ctx) => {
  // The sign-in callback answers with a redirect, which Better Auth returns as an error.
  if (ctx.path.startsWith("/callback/") && ctx.context.newSession) {
    captureServerEvent("user_signed_in", { provider: CONCEPT2_PROVIDER_ID }, ctx.context.newSession.user.id);
    return;
  }
  const returned: unknown = ctx.context.returned;
  if (returned instanceof Error) return;
  const userId = ctx.context.session?.user.id;
  const body = (ctx.body ?? {}) as Record<string, unknown>;
  switch (ctx.path) {
    case "/oauth2/consent":
      captureServerEvent(
        body.accept === false ? "mcp_app_denied" : "mcp_app_connected",
        { app: redirectHost((returned as { url?: unknown } | null)?.url) },
        userId,
      );
      break;
    case "/api-key/create":
      captureServerEvent("api_key_created", {}, userId);
      break;
    case "/api-key/delete":
      captureServerEvent("api_key_deleted", {}, userId);
      break;
  }
});

export const auth = betterAuth({
  appName: "ErgStats",
  baseURL: appUrl(),
  // Better Auth's warnings and errors, messages only: the extra arguments can
  // hold request details and user records.
  logger: {
    level: "warn",
    log: (level, message) => {
      if (level === "error") console.error(`[auth] ${message}`);
      else if (level === "warn") console.warn(`[auth] ${message}`);
    },
  },
  hooks: { after: productEvents },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          captureServerEvent("user_signed_up", { provider: CONCEPT2_PROVIDER_ID }, user.id);
        },
      },
    },
  },
  database: drizzleAdapter(db, { provider: "pg", schema }),
  // Better Auth rate-limits /api/auth/* (sign-in, token exchange, client
  // registration...) per client IP, but counts in memory by default. Vercel
  // Functions don't share memory and are recycled constantly, so that counter
  // never trips; the `rateLimit` table makes the limits real.
  rateLimit: {
    storage: "database",
    // Public, static documents that other servers fetch from shared egress
    // IPs: MCP clients read the discovery metadata, and /mcp verifies access
    // tokens against its own /jwks. Vercel's DDoS protection covers these.
    customRules: { "/jwks": false, "/.well-known/**": false },
  },
  // Endpoints nothing in the app calls: /token mints session JWTs, and the
  // other two would hand a browser the raw Concept2 tokens, which only the
  // server needs (the MCP server reads them through auth.api, which stays open).
  disabledPaths: ["/token", "/get-access-token", "/refresh-token"],
  session: {
    // Skip the database on most session reads.
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  account: {
    // Concept2 access and refresh tokens are encrypted at rest with BETTER_AUTH_SECRET.
    encryptOAuthTokens: true,
  },
  user: {
    // People can delete their account from the dashboard. Better Auth requires
    // a sign-in from the last day (session.freshAge) and removes the user,
    // sessions and Concept2 link; purgeUserData removes everything else first.
    deleteUser: {
      enabled: true,
      beforeDelete: (user) => purgeUserData(user.id),
    },
  },
  plugins: [
    // Concept2 is the only way in: signing in also grants read access to the Logbook.
    genericOAuth({
      config: [
        {
          providerId: CONCEPT2_PROVIDER_ID,
          name: "Concept2",
          clientId: process.env.CONCEPT2_CLIENT_ID ?? "",
          clientSecret: process.env.CONCEPT2_CLIENT_SECRET ?? "",
          authorizationUrl: `${base}/oauth/authorize`,
          tokenUrl: `${base}/oauth/access_token`,
          // Concept2 wants comma-separated scopes; BetterAuth joins with spaces, so pass one string.
          scopes: [CONCEPT2_SCOPES],
          refreshTokenParams: { scope: CONCEPT2_SCOPES },
          pkce: false,
          // Concept2 access tokens last 7 days.
          accessTokenExpiresIn: 7 * 24 * 60 * 60,
          overrideUserInfo: true,
          async getUserInfo(tokens) {
            if (!tokens.accessToken) return null;
            const me = await new Concept2Client({ accessToken: tokens.accessToken, baseUrl: base }).getMe();
            const name = [me.first_name, me.last_name].filter(Boolean).join(" ") || me.username;
            return {
              id: String(me.id),
              name,
              // Concept2 always returns an email for the signed-in user; the
              // fallback keeps sign-in working if a profile ever lacks one.
              email: me.email || `concept2-${me.id}@users.ergstats.com`,
              emailVerified: false,
              image: me.profile_image || undefined,
            };
          },
        },
      ],
    }),
    apiKey({
      defaultPrefix: "erg_",
      // Generous enough for an agent working through a training history.
      rateLimit: { enabled: true, timeWindow: 60_000, maxRequests: 120 },
    }),
    // Signs the OAuth access tokens MCP clients get, and serves the JWKS /mcp verifies them against.
    jwt({ disableSettingJwtHeader: true }),
    // ErgStats is its own OAuth 2.1 authorization server for MCP clients (Claude, ChatGPT, Cursor...),
    // the way Sentry's and Linear's MCP servers are. People approve access with their Concept2 sign-in.
    mcp({
      resource: mcpUrl(),
      loginPage: "/sign-in",
      consentPage: "/consent",
      scopes: ["openid", "profile", "email", "offline_access", MCP_SCOPE],
      // Dynamic client registration is the fallback for clients without Client ID Metadata Documents.
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
      // Native clients (Cursor, older Claude Code) register loopback callbacks without application_type.
      clientRegistrationDefaultApplicationType: "infer",
      // Claude's and ChatGPT's backends exchange and refresh tokens for every
      // ErgStats user from a handful of egress IPs, so the token endpoint gets
      // more room than the plugin's 20/min default. The other limits stay.
      rateLimit: { token: { window: 60, max: 300 } },
    }),
    // Claude and ChatGPT identify themselves with a Client ID Metadata Document URL instead of registering.
    cimd({ fetchClientMetadataResource, metadataProfile: "mcp-2026-07-28" }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
