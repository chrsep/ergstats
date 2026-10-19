# ErgStats MCP (work in progress)

Early, unfinished prototype of a remote MCP server (spec 2026-07-28) giving AI agents read-only access to a user's Concept2 Logbook (ErgData) workouts. It targets Next.js on Vercel with `mcp-handler` 2.x.

What's here:
- `lib/oauth/*`: a stateless OAuth 2.1 authorization server (Client ID Metadata Documents plus legacy Dynamic Client Registration, PKCE S256, RFC 8707 audience binding, RFC 9207 `iss`). Concept2 is the upstream sign-in, and Concept2 tokens are sealed inside encrypted tokens, so there's no database.
- `lib/concept2/client.ts`: a Concept2 Logbook API client (OAuth, refresh, GET helpers).
- `app/`: OAuth metadata, `/authorize`, `/callback`, `/token`, `/register` route handlers.

Not done yet: the `/mcp` endpoint and tools, formatters, tests, and deploy docs. The build moved to a broader Next.js app (BetterAuth, API keys), which can reuse the Concept2 client and pieces of this.
