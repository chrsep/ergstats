# ErgStats

ErgStats is a hosted [MCP](https://modelcontextprotocol.io) server for the Concept2 Logbook. Add `https://www.ergstats.com/mcp` to Claude, ChatGPT, Claude Code, Cursor or any MCP client, sign in with Concept2, and ask about your splits, PBs and training load.

Not affiliated with or endorsed by Concept2.

## How it works

1. **Add the server.** Paste `https://www.ergstats.com/mcp` into the client: a custom connector in Claude or ChatGPT, `claude mcp add --transport http ergstats https://www.ergstats.com/mcp` in Claude Code, or the `url` in Cursor or VS Code.
2. **Sign in with Concept2.** The client opens ErgStats in a browser. BetterAuth runs the Concept2 OAuth flow (scopes `user:read,results:read`, read-only), then a consent screen asks you to allow the app. The Concept2 tokens are stored encrypted in Postgres and refreshed automatically before they expire.
3. **Ask.** The client gets its own access token for ErgStats and calls the tools. Disconnect any app from the dashboard.

API keys (`erg_` prefix, 120 requests per minute per key) still work for clients and scripts that can't sign in: send `Authorization: Bearer erg_...`.

### OAuth for MCP clients

ErgStats is its own OAuth 2.1 authorization server, like Sentry's and Linear's MCP servers, built on Better Auth's [`@better-auth/mcp`](https://www.better-auth.com/docs/plugins/mcp) and `@better-auth/cimd` plugins. It follows the MCP 2026-07-28 authorization spec and what [Claude](https://claude.com/docs/connectors/building/authentication) and [ChatGPT](https://developers.openai.com/apps-sdk/build/auth) document for connectors:

- `/mcp` answers a request without a valid token with `401` and `WWW-Authenticate: Bearer resource_metadata=".../.well-known/oauth-protected-resource/mcp", scope="logbook:read"`.
- Protected resource metadata (RFC 9728) names the issuer `https://www.ergstats.com/api/auth`; its metadata is at `/.well-known/oauth-authorization-server/api/auth` (RFC 8414) and `/api/auth/.well-known/openid-configuration`.
- Clients identify themselves with a Client ID Metadata Document (Claude, Claude Code and ChatGPT do), or fall back to dynamic client registration (RFC 7591). Loopback redirects match on any port, as native clients need.
- Authorization code with PKCE (S256) only, `iss` on every authorization response (RFC 9207), and access tokens bound to the `/mcp` URL through the `resource` parameter (RFC 8707). Access tokens are JWTs that `/mcp` verifies against `/api/auth/jwks`; refresh tokens rotate.
- Each tool declares `securitySchemes` (`oauth2`, `logbook:read`) in `_meta` for ChatGPT.
- Disconnecting an app deletes its consent, which `/mcp` checks on every request, and its tokens.
- Sign-in, token, consent and client-registration endpoints are rate limited per client IP, with the counters in the `rate_limit` table so the limits hold across Vercel Functions.

`scripts/smoke-oauth.ts` runs the whole flow a client goes through, from the first 401 to a tool call, a refresh and a disconnect.

## Deleting an account

People delete their account from the bottom of the dashboard, after typing "delete" to confirm. Better Auth only deletes with a sign-in from the last day, so an older one signs in with Concept2 again and comes back to the open dialog. `purgeUserData` in `src/lib/account-deletion.ts` removes connected-app consents and tokens, API keys, OAuth clients the person registered and pending authorization codes; Better Auth then removes their sessions, the Concept2 link with its encrypted tokens, and the user. Concept2 has no way to revoke a token, so deleting the only copy is what ends Logbook access. Anything new that stores data per person must be erased in `purgeUserData` too. `scripts/smoke-delete-account.ts` checks afterwards that no column in the database still mentions the user.

What deletion can't reach: Neon's point-in-time restore history and Vercel's runtime logs keep data until their retention windows pass, and `rate_limit` rows are keyed by IP address and path, so they can't be tied to a person.

## MCP tools

All tools are read-only (`readOnlyHint`) and cover the athlete's training only. Each returns one compact text result: a few lines of prose, with lists, splits, segments and strokes as CSV under one header row. There is no `structuredContent` or `outputSchema`, because Claude Code and Codex hand the model only `structuredContent` when a result has it and ChatGPT hands it both, so a second copy only costs tokens. Concept2 failures come back as readable tool errors. `src/lib/mcp/token-budget.test.ts` holds each tool to a size budget on a realistic year of training.

| Tool | What it returns |
| --- | --- |
| `get_training_summary` | Sessions, meters and time for a date range, per machine (with average pace) and per week or month, plus the longest workout. Defaults to the last 12 weeks. |
| `get_personal_bests` | Best result per standard event (100m to marathon, 1/4/30/60 min) and machine. |
| `list_workouts` | Workouts newest first, filterable by date and machine, 20 per page (up to 100): date, machine, meters, time, pace, stroke rate, heart rate, rest, id and comment. |
| `get_workout` | One result: start and end time, totals (watts, calories, strokes, drag factor), heart rate, rest, monitor targets, comments, and its splits or intervals with pace, watts, rate, heart rate and rest. |
| `get_workout_strokes` | Stroke data averaged into equal-distance segments, or every stroke (`format: "strokes"`, 100 per page, up to 250). |
| `get_profile` | Name, gender, age, weight and max heart rate. |

The server runs on [`mcp-handler`](https://www.npmjs.com/package/mcp-handler) 2.3 and the MCP TypeScript SDK v2: MCP spec **2026-07-28** (stateless Streamable HTTP), with the 2025-era fallback for older clients.

## Stack

- Next.js 16 (App Router, Cache Components), React 19, TypeScript
- shadcn/ui (base-nova, Base UI) and Tailwind CSS 4
- Storybook 10 with interaction and accessibility tests run through Vitest
- BetterAuth 1.7 (generic OAuth for Concept2, MCP OAuth provider with CIMD, API key plugin)
- Drizzle ORM on Neon Postgres
- Deployed on Vercel

## Code map

```
src/app/                 Pages (/, /sign-in, /consent, /dashboard), /api/auth/*, /.well-known/*, /mcp
src/components/          App components, each with a .stories.tsx
src/components/ui/       shadcn components (generated, edit sparingly)
src/lib/concept2/        Logbook API client, formatting and analysis
src/lib/mcp/             Tool definitions, schemas, scopes, the /mcp handler, client setup snippets
src/lib/oauth/           Connected apps: list and disconnect
src/lib/auth.ts          BetterAuth config
src/db/                  Drizzle schema (generated by `pnpm auth:schema`) and client
drizzle/                 SQL migrations
scripts/                 migrate, fake Concept2 server, end-to-end smoke test
```

## Local development

You need Node 22+, pnpm and a Postgres database. A local Postgres works (a `localhost` `DATABASE_URL` switches the app to node-postgres); Neon works too.

```sh
pnpm install
cp .env.example .env.local   # fill in the values
pnpm db:migrate
pnpm dev
```

You don't need real Concept2 credentials to work on the app. `scripts/fake-concept2.ts` stands in for log.concept2.com, approving sign-in instantly and serving sample workouts:

```sh
node scripts/fake-concept2.ts   # http://localhost:4010
# in .env.local:
# CONCEPT2_BASE_URL=http://localhost:4010
# CONCEPT2_CLIENT_ID=fake-client
# CONCEPT2_CLIENT_SECRET=fake-secret
```

### Checks

```sh
pnpm lint
pnpm typecheck
pnpm test               # unit tests and MCP end-to-end tests through the MCP client SDK
pnpm test:storybook     # every story rendered in Chromium, with play functions and axe checks
pnpm storybook          # component workshop on http://localhost:6006
node scripts/smoke.ts         # against a running app + fake Concept2: sign in, create a key, call MCP
node scripts/smoke-oauth.ts   # the OAuth connect flow an MCP client runs, then refresh and disconnect
DATABASE_URL=... node scripts/smoke-delete-account.ts   # delete an account, then check nothing about it is left
```

Set `CHROMIUM_PATH` to use an already-installed Chromium for the browser tests.

### Database changes

The auth tables come from BetterAuth. After changing `src/lib/auth.ts` plugins, regenerate the schema and a migration:

```sh
pnpm auth:schema   # if the `auth` CLI isn't installed: pnpm dlx auth@1.7.11 generate --config src/lib/auth.ts --output src/db/schema.ts
pnpm db:generate
```

Migrations run automatically before each Vercel build (`vercel-build`).

### Security notes

- Every response carries `X-Frame-Options: DENY`, a `Content-Security-Policy` with `frame-ancestors 'none'`, `X-Content-Type-Options`, `Referrer-Policy` and `Permissions-Policy` (see `next.config.ts`). Vercel adds `Strict-Transport-Security`.
- Concept2 tokens are encrypted at rest and never leave the server: the Better Auth endpoints that would return them to the browser (`/get-access-token`, `/refresh-token`) and the session-JWT endpoint (`/token`) are disabled.
- API keys are stored as SHA-256 hashes; OAuth access tokens are JWTs checked for issuer, audience (`/mcp`), expiry, scope and a live consent.
- To report a vulnerability, open a private security advisory on the GitHub repository.

## Deployment

Production runs on Vercel with the Neon integration. The Neon database is in `aws-ap-southeast-1`, so `vercel.json` pins functions to `sin1` to keep database round trips short.

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Set by the Neon integration |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | `https://www.ergstats.com` |
| `CONCEPT2_CLIENT_ID` / `CONCEPT2_CLIENT_SECRET` | From the Concept2 app registration |

Register the Concept2 app at <https://log.concept2.com/developers/keys> with the redirect URI `https://www.ergstats.com/api/auth/callback/concept2`. Read-only apps can use the production Logbook straight away.
