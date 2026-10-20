/**
 * End-to-end test of account deletion against a running app wired to the fake
 * Concept2 and a local Postgres: sign in, create an API key, connect an OAuth
 * app (leaving one authorization code unused), then delete the account from the
 * dashboard with a sign-in too old to delete with, so it has to sign in again.
 * Afterwards every credential must be dead and no table may still mention the
 * user's id or email.
 *
 *   node scripts/fake-concept2.ts &
 *   pnpm build && pnpm start &
 *   DATABASE_URL=postgresql://localhost/ergstats node scripts/smoke-delete-account.ts
 */
import { createHash, randomBytes } from "node:crypto";

import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import pg from "pg";
import { chromium } from "playwright";

const base = process.env.APP_URL ?? "http://localhost:3000";
const shots = process.env.SCREENSHOT_DIR;
const mcpUrl = `${base}/mcp`;
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const b64url = (buf: Buffer) => buf.toString("base64url");

async function listTools(authorization: string): Promise<number> {
  const res = await fetch(mcpUrl, {
    method: "POST",
    headers: { authorization, "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
  });
  await res.body?.cancel();
  return res.status;
}

/** Every public table.column whose value contains `needle`. */
async function columnsMentioning(needle: string): Promise<string[]> {
  const { rows: columns } = await db.query<{ table_name: string; column_name: string }>(
    `select table_name, column_name from information_schema.columns
     where table_schema = 'public' and data_type in ('text', 'character varying', 'jsonb', 'json', 'ARRAY')`,
  );
  const found: string[] = [];
  for (const { table_name, column_name } of columns) {
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from "${table_name}" where position($1 in "${column_name}"::text) > 0`,
      [needle],
    );
    if (rows[0].n > 0) found.push(`${table_name}.${column_name}`);
  }
  return found;
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

// 1. Sign in and create an API key.
await page.goto(`${base}/sign-in`);
await page.getByRole("button", { name: "Sign in with Concept2" }).click();
await page.waitForURL("**/dashboard");
const { user } = (await (await page.request.get(`${base}/api/auth/get-session`)).json()) as {
  user: { id: string; email: string };
};
console.log("signed in as", user.id, user.email);

await page.getByRole("button", { name: "Create API key" }).click();
await page.getByLabel("Name").fill("Delete me");
await page.getByRole("button", { name: "Create key" }).click();
const key = (await page.getByTestId("new-api-key").textContent())?.trim();
check(key?.startsWith("erg_"), `Unexpected key: ${key}`);
await page.getByRole("button", { name: "Done" }).click();
const mcp = new Client({ name: "smoke-delete", version: "1.0.0" });
await mcp.connect(
  new StreamableHTTPClientTransport(new URL(mcpUrl), { requestInit: { headers: { authorization: `Bearer ${key}` } } }),
);
await mcp.listTools();
await mcp.close();

// 2. Register an OAuth client while signed in (so the user owns it) and connect it.
const registration = (await (
  await page.request.post(`${base}/api/auth/oauth2/register`, {
    headers: { origin: base },
    data: {
      client_name: "Smoke Delete",
      redirect_uris: ["http://127.0.0.1:53999/callback"],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    },
  })
).json()) as { client_id: string };
check(registration.client_id, "Client registration failed");

let callback: URL | undefined;
await page.route("http://127.0.0.1:53999/**", (route) => {
  callback = new URL(route.request().url());
  return route.fulfill({ status: 200, body: "ok" });
});
async function authorize(): Promise<{ code: string; verifier: string }> {
  callback = undefined;
  const verifier = b64url(randomBytes(32));
  const url = new URL(`${base}/api/auth/oauth2/authorize`);
  for (const [k, v] of Object.entries({
    response_type: "code",
    client_id: registration.client_id,
    redirect_uri: "http://127.0.0.1:53999/callback",
    scope: "logbook:read offline_access",
    state: b64url(randomBytes(16)),
    code_challenge: b64url(createHash("sha256").update(verifier).digest()),
    code_challenge_method: "S256",
    resource: mcpUrl,
  })) {
    url.searchParams.set(k, v);
  }
  // Once the app has consent, authorize redirects straight to the callback,
  // which page.route doesn't see; read that redirect without following it.
  const direct = await page.request.get(url.href, { maxRedirects: 0 });
  const location = direct.headers()["location"] ?? "";
  if (location.startsWith("http://127.0.0.1:53999/")) {
    callback = new URL(location);
  } else {
    await page.goto(url.href);
    await page.getByRole("button", { name: "Allow" }).click();
    for (let i = 0; i < 100 && !callback; i++) await new Promise((r) => setTimeout(r, 100));
  }
  // Set by the route handler above, which TypeScript can't see.
  const code = (callback as URL | undefined)?.searchParams.get("code");
  check(code, "No authorization code");
  return { code, verifier };
}

const tokenRequest = (params: Record<string, string>) =>
  fetch(`${base}/api/auth/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: registration.client_id, resource: mcpUrl, ...params }),
  });
const first = await authorize();
const tokens = (await (
  await tokenRequest({
    grant_type: "authorization_code",
    code: first.code,
    redirect_uri: "http://127.0.0.1:53999/callback",
    code_verifier: first.verifier,
  })
).json()) as { access_token: string; refresh_token: string };
check(tokens.refresh_token, "No refresh token");
check((await listTools(`Bearer ${tokens.access_token}`)) === 200, "OAuth access token doesn't work before deleting");
// An authorization code the app never redeems: it names the user until it expires.
const unused = await authorize();
console.log("api key, oauth app and a pending code set up");

// The data the deletion has to find, so the final check isn't vacuous.
const before = await columnsMentioning(user.id);
for (const column of [
  "session.user_id",
  "account.user_id",
  "apikey.reference_id",
  "oauth_client.user_id",
  "oauth_consent.user_id",
  "oauth_refresh_token.user_id",
  "verification.value",
]) {
  check(before.includes(column), `Expected ${column} to mention the user before deleting; found ${before.join(", ")}`);
}

// 3. Make the sign-in older than a day, so deleting asks to sign in again.
await db.query(`update "session" set created_at = now() - interval '2 days' where user_id = $1`, [user.id]);

await page.goto(`${base}/dashboard`);
await page.getByRole("button", { name: "Delete account" }).click();
const dialog = page.getByRole("alertdialog");
const submit = dialog.getByRole("button", { name: "Delete account" });
check(await submit.isDisabled(), "Delete is enabled before typing the confirmation");
await dialog.getByLabel(/to confirm/).fill("delete");
if (shots) await page.screenshot({ path: `${shots}/delete-account.png` });
await submit.click();
await dialog.getByRole("button", { name: "Sign in again" }).click();
await page.waitForURL("**/dashboard?delete=confirm**");
console.log("stale sign-in asked to sign in again");

// 4. Back from signing in, the dialog is open again; this time it deletes.
await dialog.getByLabel(/to confirm/).fill("delete");
await dialog.getByRole("button", { name: "Delete account" }).click();
await page.waitForURL(`${base}/`);
await page.getByText("Your ErgStats account was deleted").waitFor();
console.log("deleted from the dashboard");

// 5. Every credential is dead.
check((await listTools(`Bearer ${key}`)) === 401, "API key still works");
check((await listTools(`Bearer ${tokens.access_token}`)) === 401, "OAuth access token still works");
const refresh = await tokenRequest({ grant_type: "refresh_token", refresh_token: tokens.refresh_token });
check(refresh.status === 400, `Refresh answered ${refresh.status}`);
const redeem = await tokenRequest({
  grant_type: "authorization_code",
  code: unused.code,
  redirect_uri: "http://127.0.0.1:53999/callback",
  code_verifier: unused.verifier,
});
check(redeem.status === 400, `Unused authorization code answered ${redeem.status}`);
check((await (await page.request.get(`${base}/api/auth/get-session`)).json()) === null, "Browser is still signed in");
await page.goto(`${base}/dashboard`);
await page.waitForURL("**/sign-in");
console.log("credentials revoked");

// 6. Nothing in the database mentions the user any more.
for (const needle of [user.id, user.email]) {
  const left = await columnsMentioning(needle);
  check(left.length === 0, `Still mentioning ${needle}: ${left.join(", ")}`);
}
const { rows: accounts } = await db.query(`select 1 from "account" where provider_id = 'concept2' and account_id = '123'`);
check(accounts.length === 0, "The Concept2 account link survived");
console.log("no trace left in the database");

await db.end();
await browser.close();
console.log("Account deletion smoke test passed.");
