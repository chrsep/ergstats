import { gunzipSync } from "node:zlib";

import { POSTHOG_HOSTS, RELAY_PATH } from "./config";

/**
 * Relays browser analytics from our own origin to PostHog EU, so blockers
 * that drop third-party analytics don't skew the numbers and the browser
 * never talks to a third party.
 *
 * It is a route handler rather than a rewrite because a rewrite forwards every
 * header, the Better Auth session cookie included. Here only what PostHog needs
 * goes out: the body, its content type, the user agent and the visitor's IP.
 * PostHog hashes IP and user agent with a daily salt to count cookieless
 * visitors, then drops the IP; the project's "discard client IP data" setting
 * keeps it out of storage.
 *
 * Cookieless events never get PostHog's GeoIP lookup, so the relay adds the
 * visitor's country from Vercel's edge header instead: country only, no city.
 */

/** Paths PostHog accepts events on. Anything else (static assets, config) passes through untouched. */
const EVENT_PATH = /^\/(e|i\/v0\/e|batch|capture)\/?$/;

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

export function upstreamUrl(requestUrl: URL): URL {
  // One leading slash only: "//host/..." would make the URL below point at another host.
  const path = `/${requestUrl.pathname.slice(RELAY_PATH.length).replace(/^\/+/, "")}`;
  const host = /^\/(static|array)\//.test(path) ? POSTHOG_HOSTS.assets : POSTHOG_HOSTS.ingest;
  return new URL(`${path}${requestUrl.search}`, host);
}

/** The visitor's IP as Vercel saw it. Vercel overwrites X-Forwarded-For, so it can't be spoofed there. */
function clientIp(headers: Headers): string | undefined {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || undefined;
}

function country(headers: Headers): { code: string; name: string } | undefined {
  const code = headers.get("x-vercel-ip-country")?.toUpperCase();
  if (!code || !/^[A-Z]{2}$/.test(code)) return undefined;
  return { code, name: regionNames.of(code) ?? code };
}

type CaptureEvent = { properties?: Record<string, unknown> };

/**
 * posthog-js sends gzip, base64 form data or plain JSON depending on the
 * browser. Gzip isn't always flagged in the query string, so it's recognized by
 * its magic bytes, the way PostHog's ingestion does.
 */
function decodeEvents(body: Buffer, compression: string | null): unknown {
  if (compression === "gzip-js" || (body[0] === 0x1f && body[1] === 0x8b)) {
    return JSON.parse(gunzipSync(body).toString("utf8"));
  }
  const text = body.toString("utf8");
  if (compression === "base64" || text.startsWith("data=")) {
    const data = new URLSearchParams(text).get("data");
    return data ? JSON.parse(Buffer.from(data, "base64").toString("utf8")) : undefined;
  }
  return JSON.parse(text);
}

/** Stamps the visitor's country on each event and returns the batch as plain JSON, or undefined to send the body as is. */
export function withCountry(
  body: Buffer,
  compression: string | null,
  where: { code: string; name: string },
): string | undefined {
  let decoded: unknown;
  try {
    decoded = decodeEvents(body, compression);
  } catch {
    return undefined;
  }
  const batch = decoded as CaptureEvent[] | CaptureEvent | { batch?: CaptureEvent[] } | undefined;
  const events = Array.isArray(batch) ? batch : batch && "batch" in batch ? batch.batch : batch ? [batch as CaptureEvent] : [];
  if (!events?.length) return undefined;
  for (const event of events) {
    if (!event || typeof event !== "object") continue;
    event.properties = {
      ...event.properties,
      $geoip_disable: true,
      $geoip_country_code: where.code,
      $geoip_country_name: where.name,
    };
  }
  return JSON.stringify(decoded);
}

export async function relay(req: Request, fetchImpl: typeof fetch = fetch): Promise<Response> {
  const url = upstreamUrl(new URL(req.url));
  const headers = new Headers();
  for (const name of ["content-type", "user-agent", "accept"]) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  const ip = clientIp(req.headers);
  if (ip) headers.set("x-forwarded-for", ip);

  let body: BodyInit | undefined;
  if (req.method === "POST") {
    const raw = Buffer.from(await req.arrayBuffer());
    body = raw;
    const where = country(req.headers);
    if (where && EVENT_PATH.test(url.pathname)) {
      const json = withCountry(raw, url.searchParams.get("compression"), where);
      if (json) {
        body = json;
        url.searchParams.delete("compression");
        headers.set("content-type", "application/json");
      }
    }
  }

  let upstream: Response;
  try {
    upstream = await fetchImpl(url, {
      method: req.method,
      headers,
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return new Response(null, { status: 502, headers: { "cache-control": "no-store" } });
  }

  // fetch has already decompressed the body, so content-encoding and length no longer apply.
  const out = new Headers({ "cache-control": upstream.headers.get("cache-control") ?? "no-store" });
  const type = upstream.headers.get("content-type");
  if (type) out.set("content-type", type);
  return new Response(upstream.body, { status: upstream.status, headers: out });
}
