/**
 * A stand-in for log.concept2.com, for local development and the end-to-end
 * test: OAuth that approves instantly, plus the Logbook endpoints ErgStats
 * calls, serving the test fixtures.
 *
 *   node scripts/fake-concept2.ts            # listens on :4010
 *   CONCEPT2_BASE_URL=http://localhost:4010 pnpm dev
 */
import { createServer } from "node:http";

import { allResults, twoKStrokes, user } from "../src/lib/concept2/__fixtures__/results.ts";

const port = Number(process.env.PORT ?? 4010);
const ACCESS_TOKEN = "fake-access-token";

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${port}`);
  const send = (status: number, body: unknown) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };
  console.log(req.method, url.pathname + url.search);

  if (url.pathname === "/oauth/authorize") {
    const redirect = new URL(url.searchParams.get("redirect_uri") ?? "");
    // Concept2 takes comma-separated scopes.
    if (url.searchParams.get("scope") !== "user:read,results:read") {
      redirect.searchParams.set("error", "invalid_scope");
    } else {
      redirect.searchParams.set("code", "fake-code");
    }
    redirect.searchParams.set("state", url.searchParams.get("state") ?? "");
    res.writeHead(302, { location: redirect.toString() });
    return res.end();
  }

  if (url.pathname === "/oauth/access_token" && req.method === "POST") {
    let body = "";
    for await (const chunk of req) body += chunk;
    const params = new URLSearchParams(body);
    if (!params.get("client_secret")) return send(401, { error: "invalid_client" });
    return send(200, {
      access_token: ACCESS_TOKEN,
      refresh_token: `refresh-${Date.now()}`,
      expires_in: 604800,
      token_type: "Bearer",
      scope: "user:read,results:read",
    });
  }

  // Challenges are public, like on log.concept2.com. The fixture is a future
  // challenge, so only the upcoming and season lists include it.
  if (url.pathname.startsWith("/api/challenges")) {
    const holiday = {
      key: "holiday",
      name: "Holiday Challenge",
      start: "2026-11-26",
      end: "2026-12-24",
      activity: "Row/Ski/Ride",
      category: "Individual",
      short_description: "Row, ski or ride 100,000 meters.",
      link: "https://www.concept2.com/holiday-challenge",
    };
    const listsHoliday = /^\/api\/challenges\/(upcoming|season)(\/|$)/.test(url.pathname);
    return send(200, { data: listsHoliday ? [holiday] : [] });
  }

  if (req.headers.authorization !== `Bearer ${ACCESS_TOKEN}`) return send(401, { message: "Unauthenticated." });

  if (url.pathname === "/api/users/me") return send(200, { data: user });
  if (url.pathname === "/api/users/me/results") {
    const type = url.searchParams.get("type");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const data = allResults.filter(
      (r) => (!type || r.type === type) && (!from || r.date.slice(0, 10) >= from) && (!to || r.date.slice(0, 10) <= to),
    );
    return send(200, {
      data,
      meta: { pagination: { total: data.length, count: data.length, per_page: 250, current_page: 1, total_pages: 1 } },
    });
  }
  const strokes = url.pathname.match(/^\/api\/users\/me\/results\/(\d+)\/strokes$/);
  if (strokes) return send(200, { data: Number(strokes[1]) === allResults[0].id ? twoKStrokes : [] });
  const one = url.pathname.match(/^\/api\/users\/me\/results\/(\d+)$/);
  if (one) {
    const result = allResults.find((r) => r.id === Number(one[1]));
    return result ? send(200, { data: result }) : send(404, { message: "Not found" });
  }
  return send(404, { message: "Not found" });
});

server.listen(port, () => console.log(`Fake Concept2 listening on http://localhost:${port}`));
