/**
 * End-to-end test of the OAuth connect flow an MCP client such as Claude Code
 * or Cursor runs, against a running app wired to the fake Concept2:
 * discovery from the 401, dynamic client registration, PKCE authorization with
 * sign-in and consent in a browser, the token exchange, a tool call, a refresh,
 * and disconnecting the app from the dashboard.
 *
 *   node scripts/fake-concept2.ts &
 *   pnpm build && pnpm start &
 *   node scripts/smoke-oauth.ts
 */
import { createHash, randomBytes } from "node:crypto";

import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { chromium } from "playwright";

const base = process.env.APP_URL ?? "http://localhost:3000";
const shots = process.env.SCREENSHOT_DIR;
const mcpUrl = `${base}/mcp`;

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function json<T>(res: Response): Promise<T> {
  const body = await res.text();
  check(res.ok, `${res.url} answered ${res.status}: ${body}`);
  return JSON.parse(body) as T;
}

const b64url = (buf: Buffer) => buf.toString("base64url");

// 1. An unauthenticated request gets a 401 pointing at the protected resource metadata.
const challenge = await fetch(mcpUrl, {
  method: "POST",
  headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
});
check(challenge.status === 401, `Expected 401 without a token, got ${challenge.status}`);
const resourceMetadataUrl = /resource_metadata="([^"]+)"/.exec(challenge.headers.get("www-authenticate") ?? "")?.[1];
check(resourceMetadataUrl, "401 has no resource_metadata");

// 2. Discovery: protected resource metadata, then the authorization server's metadata.
const prm = await json<{ resource: string; authorization_servers: string[]; scopes_supported: string[] }>(
  await fetch(resourceMetadataUrl),
);
check(prm.resource === mcpUrl, `PRM resource is ${prm.resource}, expected ${mcpUrl}`);
const issuer = new URL(prm.authorization_servers[0]);
const as = await json<{
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint: string;
  code_challenge_methods_supported: string[];
  client_id_metadata_document_supported: boolean;
  authorization_response_iss_parameter_supported: boolean;
  token_endpoint_auth_methods_supported: string[];
}>(await fetch(`${issuer.origin}/.well-known/oauth-authorization-server${issuer.pathname}`));
check(as.issuer === issuer.href.replace(/\/$/, ""), `issuer ${as.issuer} doesn't match ${issuer.href}`);
check(as.code_challenge_methods_supported.includes("S256"), "S256 not supported");
check(as.client_id_metadata_document_supported, "CIMD not advertised");
check(as.authorization_response_iss_parameter_supported, "RFC 9207 iss not advertised");
check(as.token_endpoint_auth_methods_supported.includes("none"), "public clients not supported");
console.log("discovery ok:", as.issuer);

// 3. Dynamic client registration, as a native client with a loopback callback.
const registeredRedirect = "http://127.0.0.1:53682/callback";
const registration = await json<{ client_id: string }>(
  await fetch(as.registration_endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_name: "Smoke OAuth",
      redirect_uris: [registeredRedirect],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    }),
  }),
);
console.log("registered client:", registration.client_id);

// 4. Authorization code with PKCE. The loopback port differs from the registered one, as Claude Code's does.
const redirectUri = "http://127.0.0.1:53999/callback";
const verifier = b64url(randomBytes(32));
const state = b64url(randomBytes(16));
const authorizeUrl = new URL(as.authorization_endpoint);
for (const [key, value] of Object.entries({
  response_type: "code",
  client_id: registration.client_id,
  redirect_uri: redirectUri,
  scope: `${prm.scopes_supported.join(" ")} offline_access`,
  state,
  code_challenge: b64url(createHash("sha256").update(verifier).digest()),
  code_challenge_method: "S256",
  resource: mcpUrl,
})) {
  authorizeUrl.searchParams.set(key, value);
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
let callback: URL | undefined;
await page.route("http://127.0.0.1:53999/**", (route) => {
  callback = new URL(route.request().url());
  return route.fulfill({ status: 200, body: "You can close this window." });
});
async function waitForCallback(): Promise<URL | undefined> {
  for (let i = 0; i < 100 && !callback; i++) await new Promise((r) => setTimeout(r, 100));
  return callback;
}

await page.goto(authorizeUrl.href);
await page.waitForURL("**/sign-in?**");
if (shots) await page.screenshot({ path: `${shots}/oauth-sign-in.png` });
await page.getByRole("button", { name: "Sign in with Concept2" }).click();
await page.waitForURL("**/consent?**");
const consentUrl = new URL(page.url());
await page.getByText("Connect Smoke OAuth to ErgStats").waitFor();
await page.getByText("You’ll go back to 127.0.0.1:53999").or(page.getByText("You'll go back to 127.0.0.1:53999")).waitFor();
if (shots) await page.screenshot({ path: `${shots}/oauth-consent.png` });
await page.getByRole("button", { name: "Allow" }).click();
const redirect = await waitForCallback();

check(redirect, "Never reached the client's callback");
check(redirect.searchParams.get("state") === state, "state mismatch");
check(redirect.searchParams.get("iss") === as.issuer, `iss is ${redirect.searchParams.get("iss")}, expected ${as.issuer}`);
const code = redirect.searchParams.get("code");
check(code, "No authorization code");

// 5. Token exchange, bound to the MCP resource.
type Tokens = { access_token: string; refresh_token?: string; token_type: string; expires_in: number; scope: string };
const tokenRequest = (params: Record<string, string>) =>
  fetch(as.token_endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: registration.client_id, resource: mcpUrl, ...params }),
  });
const tokens = await json<Tokens>(
  await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri, code_verifier: verifier }),
);
check(tokens.refresh_token, "No refresh token despite offline_access");
const claims = JSON.parse(Buffer.from(tokens.access_token.split(".")[1], "base64url").toString());
check(claims.aud === mcpUrl || (Array.isArray(claims.aud) && claims.aud.includes(mcpUrl)), `aud is ${claims.aud}`);
console.log("token ok: aud", claims.aud, "scope", tokens.scope, "expires_in", tokens.expires_in);

// 6. The MCP server accepts the token.
async function callPersonalBests(accessToken: string) {
  const client = new Client({ name: "smoke-oauth", version: "1.0.0" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(mcpUrl), {
      requestInit: { headers: { authorization: `Bearer ${accessToken}` } },
    }),
  );
  const result = await client.callTool({ name: "get_personal_bests", arguments: {} });
  await client.close();
  const text = (result.content as { type: string; text: string }[])[0]?.text ?? "";
  check(!result.isError && text.includes("RowErg 2k: 7:31.4"), `get_personal_bests failed: ${text}`);
}
await callPersonalBests(tokens.access_token);
console.log("tool call ok");

// 7. Refresh rotates the refresh token and the new access token works.
const refreshed = await json<Tokens>(
  await tokenRequest({ grant_type: "refresh_token", refresh_token: tokens.refresh_token }),
);
check(refreshed.refresh_token && refreshed.refresh_token !== tokens.refresh_token, "Refresh token didn't rotate");
await callPersonalBests(refreshed.access_token);
const badRefresh = await tokenRequest({ grant_type: "refresh_token", refresh_token: "not-a-token" });
check(badRefresh.status === 400 && (await badRefresh.json()).error === "invalid_grant", "Bad refresh token isn't invalid_grant");
console.log("refresh ok");

// 8. Disconnecting on the dashboard cuts access immediately, including the live access token.
await page.goto(`${base}/dashboard`);
await page.getByText("Smoke OAuth").first().waitFor();
if (shots) await page.screenshot({ path: `${shots}/oauth-dashboard.png`, fullPage: true });
await page.getByRole("button", { name: "Disconnect" }).first().click();
await page.getByRole("alertdialog").getByRole("button", { name: "Disconnect" }).click();
await page.getByText("Disconnected Smoke OAuth").waitFor();

const revoked = await fetch(mcpUrl, {
  method: "POST",
  headers: {
    authorization: `Bearer ${refreshed.access_token}`,
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
});
check(revoked.status === 401, `Expected 401 after disconnecting, got ${revoked.status}`);
const afterDisconnect = await tokenRequest({ grant_type: "refresh_token", refresh_token: refreshed.refresh_token! });
check(afterDisconnect.status === 400, `Refresh after disconnecting answered ${afterDisconnect.status}`);
console.log("disconnect ok");

// 9. A consent URL whose signed parameters were edited doesn't render.
const tampered = new URL(consentUrl);
tampered.searchParams.set("redirect_uri", "https://evil.example/callback");
await page.goto(tampered.href);
await page.getByText("This connection request isn’t valid").or(page.getByText("This connection request isn't valid")).waitFor();
console.log("tampered consent rejected");

// 10. Connecting the same app again doesn't bring its old access token back.
callback = undefined;
await page.goto(authorizeUrl.href);
await page.waitForURL("**/consent?**");
await page.getByRole("button", { name: "Allow" }).click();
check((await waitForCallback())?.searchParams.get("code"), "Reconnecting didn't return a code");
const stale = await fetch(mcpUrl, {
  method: "POST",
  headers: {
    authorization: `Bearer ${refreshed.access_token}`,
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
});
check(stale.status === 401, `Old access token works again after reconnecting (${stale.status})`);
console.log("reconnect ok");

await browser.close();
console.log("OAuth smoke test passed.");
