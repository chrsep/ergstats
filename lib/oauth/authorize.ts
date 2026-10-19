import { randomBytes } from "node:crypto";
import { SCOPE, issuer, publicOrigin, resourceUri } from "../config";
import { open, seal } from "../crypto";
import { concept2AuthorizeUrl, concept2Get, exchangeConcept2Code } from "../concept2/client";
import { ClientError, redirectUriMatches, resolveClient, type OAuthClient } from "./clients";
import {
  CSRF_COOKIE,
  errorPage,
  escapeHtml,
  htmlPage,
  normalizeResource,
  readCookie,
  redirectToClient,
  setCookie,
} from "./http";
import { isValidCodeChallenge, issueAuthorizationCode } from "./tokens";

/**
 * The authorization flow, end to end:
 *
 * 1. GET  /authorize  validates the MCP client's request and shows a consent page.
 * 2. POST /authorize  (user approved) redirects to Concept2's own sign-in and consent.
 * 3. GET  /callback   exchanges Concept2's code, then redirects back to the MCP
 *                     client with our own authorization code.
 *
 * Our consent page matters even though Concept2 shows one too: every MCP client
 * shares this server's single Concept2 app, and Concept2 may skip its prompt for
 * a user who already approved it. Without our page, any website could start the
 * flow with its own redirect_uri and silently receive a code.
 */

const PENDING_TTL_SECONDS = 15 * 60;

interface PendingAuthorization {
  stage: "consent" | "upstream";
  csrf: string;
  cid: string;
  cn: string;
  ru: string;
  st?: string;
  cc: string;
  aud: string;
  scp: string;
}

export function callbackUrl(req: Request): string {
  return `${publicOrigin(req)}/callback`;
}

/** GET /authorize */
export async function handleAuthorize(req: Request): Promise<Response> {
  const params = new URL(req.url).searchParams;
  const clientId = params.get("client_id");
  const redirectUri = params.get("redirect_uri");
  const state = params.get("state") ?? undefined;

  // Until the client and redirect URI check out, errors are shown here rather
  // than redirected, so this endpoint can't be used as an open redirector.
  let client: OAuthClient;
  try {
    client = await resolveClient(clientId);
  } catch (error) {
    return errorPage(error instanceof ClientError ? error.message : "Unknown client");
  }
  if (!redirectUri || !redirectUriMatches(redirectUri, client.redirectUris)) {
    return errorPage("The redirect_uri is not registered for this client.");
  }

  const iss = issuer(req);
  const fail = (error: string, description: string) =>
    redirectToClient(redirectUri, { error, error_description: description, state, iss });

  if (params.get("response_type") !== "code") return fail("unsupported_response_type", "Only response_type=code is supported");
  const codeChallenge = params.get("code_challenge");
  if (!isValidCodeChallenge(codeChallenge) || params.get("code_challenge_method") !== "S256") {
    return fail("invalid_request", "PKCE with code_challenge_method=S256 is required");
  }
  const expectedResource = resourceUri(req);
  const requestedResource = params.get("resource");
  if (requestedResource && normalizeResource(requestedResource) !== normalizeResource(expectedResource)) {
    return fail("invalid_target", `This server only issues tokens for ${expectedResource}`);
  }

  const csrf = randomBytes(24).toString("base64url");
  const pending: PendingAuthorization = {
    stage: "consent",
    csrf,
    cid: client.clientId,
    cn: client.clientName,
    ru: redirectUri,
    st: state,
    cc: codeChallenge,
    aud: expectedResource,
    scp: SCOPE,
  };
  const sealed = await seal("state", { ...pending }, PENDING_TTL_SECONDS);
  const redirectHost = new URL(redirectUri).host || redirectUri;

  return htmlPage(
    "Connect to ErgData MCP",
    `<h1>Connect ${escapeHtml(client.clientName)} to your Concept2 Logbook?</h1>
<p><strong>${escapeHtml(client.clientName)}</strong> wants read-only access to your Concept2 Logbook: your profile and workouts, including splits, heart rate and stroke data. It can't change or delete anything.</p>
<p>After you approve, you'll sign in with Concept2 and be sent back to <code>${escapeHtml(redirectHost)}</code>.${
      client.source === "metadata-document"
        ? ` The app identified itself as <code>${escapeHtml(new URL(client.clientId).host)}</code>.`
        : ""
    }</p>
<p>Only continue if you started this connection yourself.</p>
<form method="post" action="/authorize">
  <input type="hidden" name="request" value="${escapeHtml(sealed)}">
  <div class="actions">
    <button type="submit" name="action" value="deny">Cancel</button>
    <button type="submit" name="action" value="approve" class="primary">Continue to Concept2</button>
  </div>
</form>`,
    { headers: { "set-cookie": setCookie(CSRF_COOKIE, csrf, PENDING_TTL_SECONDS) } },
  );
}

/** POST /authorize (the consent form). */
export async function handleConsent(req: Request): Promise<Response> {
  const form = await req.formData().catch(() => undefined);
  const pending = await open<PendingAuthorization>("state", form?.get("request")?.toString());
  if (!pending || pending.stage !== "consent") {
    return errorPage("This authorization request has expired. Start connecting again from your app.");
  }
  if (readCookie(req, CSRF_COOKIE) !== pending.csrf) {
    return errorPage("This authorization request didn't start in this browser. Start connecting again from your app.");
  }
  if (form?.get("action") !== "approve") {
    return redirectToClient(pending.ru, {
      error: "access_denied",
      error_description: "The user declined",
      state: pending.st,
      iss: issuer(req),
    });
  }
  const upstreamState = await seal("state", { ...pending, stage: "upstream" }, PENDING_TTL_SECONDS);
  return new Response(null, {
    status: 302,
    headers: { location: concept2AuthorizeUrl(upstreamState, callbackUrl(req)), "cache-control": "no-store" },
  });
}

/** GET /callback (Concept2 redirects here). */
export async function handleCallback(req: Request): Promise<Response> {
  const params = new URL(req.url).searchParams;
  const pending = await open<PendingAuthorization>("state", params.get("state"));
  if (!pending || pending.stage !== "upstream") {
    return errorPage("This sign-in has expired. Start connecting again from your app.");
  }
  if (readCookie(req, CSRF_COOKIE) !== pending.csrf) {
    return errorPage("This sign-in didn't start in this browser. Start connecting again from your app.");
  }
  const iss = issuer(req);
  const clearCookie = { "set-cookie": setCookie(CSRF_COOKIE, "", 0) };

  const upstreamCode = params.get("code");
  if (params.get("error") || !upstreamCode) {
    return redirectToClient(
      pending.ru,
      { error: "access_denied", error_description: "Concept2 sign-in was cancelled", state: pending.st, iss },
      clearCookie,
    );
  }

  let code: string;
  try {
    const concept2 = await exchangeConcept2Code(upstreamCode, callbackUrl(req));
    const me = await concept2Get<{ data?: { id?: number | string } }>(concept2.accessToken, "/api/users/me");
    code = await issueAuthorizationCode({
      clientId: pending.cid,
      redirectUri: pending.ru,
      codeChallenge: pending.cc,
      resource: pending.aud,
      scope: pending.scp,
      userId: String(me.data?.id ?? "unknown"),
      concept2,
    });
  } catch (error) {
    console.error("Concept2 sign-in failed:", error instanceof Error ? error.message : error);
    return redirectToClient(
      pending.ru,
      { error: "server_error", error_description: "Couldn't complete Concept2 sign-in", state: pending.st, iss },
      clearCookie,
    );
  }
  return redirectToClient(pending.ru, { code, state: pending.st, iss }, clearCookie);
}
