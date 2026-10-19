import { CONCEPT2_SCOPES, concept2Config } from "../config";

/** Concept2 Logbook API client. Docs: https://log.concept2.com/developers/documentation/ */

export interface Concept2Tokens {
  accessToken: string;
  refreshToken: string;
  /** Seconds since epoch. */
  expiresAt: number;
}

export class Concept2Error extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function concept2AuthorizeUrl(state: string, redirectUri: string): string {
  const { clientId, baseUrl } = concept2Config();
  const url = new URL(`${baseUrl}/oauth/authorize`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", CONCEPT2_SCOPES);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

async function tokenRequest(params: Record<string, string>): Promise<Concept2Tokens> {
  const { clientId, clientSecret, baseUrl } = concept2Config();
  const res = await fetch(`${baseUrl}/oauth/access_token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: CONCEPT2_SCOPES,
      ...params,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    throw new Concept2Error(res.status, `Concept2 token request failed with HTTP ${res.status}`);
  }
  const body = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!body.access_token || !body.refresh_token) {
    throw new Concept2Error(502, "Concept2 token response was missing tokens");
  }
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: Math.floor(Date.now() / 1000) + (body.expires_in ?? 604800),
  };
}

export function exchangeConcept2Code(code: string, redirectUri: string): Promise<Concept2Tokens> {
  return tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
}

/** Concept2 rotates refresh tokens: the old one stops working once this succeeds. */
export function refreshConcept2Tokens(refreshToken: string): Promise<Concept2Tokens> {
  return tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
}

export type Query = Record<string, string | number | undefined>;

/** GET a Logbook API path (e.g. `/api/users/me`) and return the parsed JSON body. */
export async function concept2Get<T = unknown>(accessToken: string, path: string, query: Query = {}): Promise<T> {
  const { baseUrl } = concept2Config();
  const url = new URL(`${baseUrl}${path}`);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }
  const res = await fetch(url, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: "application/vnd.c2logbook.v1+json",
    },
    signal: AbortSignal.timeout(20000),
  });
  if (res.status === 401) {
    throw new Concept2Error(401, "Concept2 rejected the stored credentials. Reconnect this server to sign in to Concept2 again.");
  }
  if (res.status === 404) throw new Concept2Error(404, "Not found in your Concept2 Logbook.");
  if (!res.ok) throw new Concept2Error(res.status, `Concept2 API request failed with HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** Public endpoints (challenges) need no token. */
export async function concept2GetPublic<T = unknown>(path: string, query: Query = {}): Promise<T> {
  const { baseUrl } = concept2Config();
  const url = new URL(`${baseUrl}${path}`);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }
  const res = await fetch(url, {
    headers: { accept: "application/vnd.c2logbook.v1+json" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Concept2Error(res.status, `Concept2 API request failed with HTTP ${res.status}`);
  return (await res.json()) as T;
}
