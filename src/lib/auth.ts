import { apiKey } from "@better-auth/api-key";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { genericOAuth } from "better-auth/plugins";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { appUrl } from "@/lib/app-url";
import { CONCEPT2_SCOPES, concept2BaseUrl, Concept2Client } from "@/lib/concept2/client";

export const CONCEPT2_PROVIDER_ID = "concept2";

const base = concept2BaseUrl();

export const auth = betterAuth({
  appName: "ErgStats",
  baseURL: appUrl(),
  database: drizzleAdapter(db, { provider: "pg", schema }),
  session: {
    // Skip the database on most session reads.
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  account: {
    // Concept2 access and refresh tokens are encrypted at rest with BETTER_AUTH_SECRET.
    encryptOAuthTokens: true,
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
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
