import { createHash } from "node:crypto";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { open, seal } from "../crypto";
import { refreshConcept2Tokens, type Concept2Tokens } from "../concept2/client";

export const CODE_TTL_SECONDS = 120;
export const ACCESS_TTL_SECONDS = 60 * 60;
export const REFRESH_TTL_SECONDS = 90 * 24 * 60 * 60;
/** Refresh the upstream Concept2 token when it has less than this left. */
const CONCEPT2_REFRESH_MARGIN_SECONDS = 24 * 60 * 60;

export class TokenError extends Error {
  constructor(
    public readonly code: "invalid_grant" | "invalid_request" | "invalid_client",
    message: string,
  ) {
    super(message);
  }
}

const now = () => Math.floor(Date.now() / 1000);

// ---------------------------------------------------------------------------
// PKCE (S256 only, as OAuth 2.1 requires)
// ---------------------------------------------------------------------------

const VERIFIER = /^[A-Za-z0-9\-._~]{43,128}$/;
const CHALLENGE = /^[A-Za-z0-9\-_]{43}$/;

export function isValidCodeChallenge(challenge: string | null): challenge is string {
  return !!challenge && CHALLENGE.test(challenge);
}

export function verifyPkce(verifier: string | null, challenge: string): boolean {
  if (!verifier || !VERIFIER.test(verifier)) return false;
  return createHash("sha256").update(verifier).digest("base64url") === challenge;
}

// ---------------------------------------------------------------------------
// Authorization codes
// ---------------------------------------------------------------------------

export interface CodeGrant {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  resource: string;
  scope: string;
  userId: string;
  concept2: Concept2Tokens;
}

export function issueAuthorizationCode(grant: CodeGrant): Promise<string> {
  return seal(
    "code",
    {
      cid: grant.clientId,
      ru: grant.redirectUri,
      cc: grant.codeChallenge,
      aud: grant.resource,
      scp: grant.scope,
      sub: grant.userId,
      c2a: grant.concept2.accessToken,
      c2r: grant.concept2.refreshToken,
      c2e: grant.concept2.expiresAt,
    },
    CODE_TTL_SECONDS,
  );
}

interface SealedGrant {
  cid: string;
  aud: string;
  scp: string;
  sub: string;
  c2a: string;
  c2r: string;
  c2e: number;
}

// ---------------------------------------------------------------------------
// Access and refresh tokens
// ---------------------------------------------------------------------------

export interface TokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
}

async function issueTokens(grant: SealedGrant): Promise<TokenResponse> {
  // Never hand out an access token that outlives the Concept2 token inside it.
  const accessTtl = Math.max(60, Math.min(ACCESS_TTL_SECONDS, grant.c2e - now() - 60));
  const base = { cid: grant.cid, aud: grant.aud, scp: grant.scp, sub: grant.sub };
  const [accessToken, refreshToken] = await Promise.all([
    seal("access", { ...base, c2a: grant.c2a, c2e: grant.c2e }, accessTtl),
    seal("refresh", { ...base, c2a: grant.c2a, c2r: grant.c2r, c2e: grant.c2e }, REFRESH_TTL_SECONDS),
  ]);
  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: accessTtl,
    refresh_token: refreshToken,
    scope: grant.scope,
  };
}

export async function exchangeAuthorizationCode(params: {
  code: string | null;
  clientId: string | null;
  redirectUri: string | null;
  codeVerifier: string | null;
  resource: string | null;
}): Promise<TokenResponse> {
  const code = await open<SealedGrant & { ru: string; cc: string }>("code", params.code);
  if (!code) throw new TokenError("invalid_grant", "Authorization code is invalid or expired");
  if (code.cid !== params.clientId) throw new TokenError("invalid_grant", "Authorization code was issued to another client");
  if (code.ru !== params.redirectUri) throw new TokenError("invalid_grant", "redirect_uri does not match the authorization request");
  if (!verifyPkce(params.codeVerifier, code.cc)) throw new TokenError("invalid_grant", "PKCE verification failed");
  if (params.resource && params.resource !== code.aud) {
    throw new TokenError("invalid_grant", "resource does not match the authorization request");
  }
  return issueTokens(code);
}

export async function exchangeRefreshToken(params: {
  refreshToken: string | null;
  clientId: string | null;
  resource: string | null;
}): Promise<TokenResponse> {
  const grant = await open<SealedGrant>("refresh", params.refreshToken);
  if (!grant) throw new TokenError("invalid_grant", "Refresh token is invalid or expired");
  if (grant.cid !== params.clientId) throw new TokenError("invalid_grant", "Refresh token was issued to another client");
  if (params.resource && params.resource !== grant.aud) {
    throw new TokenError("invalid_grant", "resource does not match the original grant");
  }
  if (grant.c2e - now() < CONCEPT2_REFRESH_MARGIN_SECONDS) {
    let fresh: Concept2Tokens;
    try {
      fresh = await refreshConcept2Tokens(grant.c2r);
    } catch {
      throw new TokenError("invalid_grant", "Concept2 sign-in has expired; authorize again");
    }
    return issueTokens({ ...grant, c2a: fresh.accessToken, c2r: fresh.refreshToken, c2e: fresh.expiresAt });
  }
  return issueTokens(grant);
}

/** What tools receive in `authInfo.extra`. */
export interface Concept2Session {
  userId: string;
  concept2AccessToken: string;
}

/** Validates an access token for this MCP server (audience-bound, RFC 8707). */
export async function verifyAccessToken(token: string | undefined, expectedResource: string): Promise<AuthInfo | undefined> {
  const grant = await open<{ cid: string; aud: string; scp: string; sub: string; c2a: string; exp: number }>("access", token);
  if (!grant || grant.aud !== expectedResource) return undefined;
  const session: Concept2Session = { userId: grant.sub, concept2AccessToken: grant.c2a };
  return {
    token: token!,
    clientId: grant.cid,
    scopes: grant.scp.split(" ").filter(Boolean),
    expiresAt: grant.exp,
    resource: new URL(grant.aud),
    extra: { ...session },
  };
}
