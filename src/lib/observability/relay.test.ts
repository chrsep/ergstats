import { gunzipSync, gzipSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { relay, upstreamUrl } from "./relay";
import { scrubUrl, scrubUrlProperties } from "./scrub";

type Sent = { url: string; init: RequestInit };

function upstream(response = new Response("{}", { headers: { "content-type": "application/json" } })) {
  const sent: Sent[] = [];
  const fetchImpl = (async (url: URL, init: RequestInit) => {
    sent.push({ url: url.toString(), init });
    return response;
  }) as unknown as typeof fetch;
  return { sent, fetchImpl };
}

const browserHeaders = {
  cookie: "__Secure-better-auth.session_token=secret",
  "user-agent": "Mozilla/5.0",
  "x-forwarded-for": "203.0.113.7, 10.0.0.1",
  "x-vercel-ip-country": "nl",
  "content-type": "text/plain",
};

function bodyOf(init: RequestInit) {
  return JSON.parse(String(init.body));
}

describe("analytics relay", () => {
  it("routes events to ingestion and SDK files to the assets host", () => {
    expect(upstreamUrl(new URL("https://www.ergstats.com/pulse/e/?ver=1")).toString()).toBe(
      "https://eu.i.posthog.com/e/?ver=1",
    );
    expect(upstreamUrl(new URL("https://www.ergstats.com/pulse/static/web-vitals.js")).toString()).toBe(
      "https://eu-assets.i.posthog.com/static/web-vitals.js",
    );
  });

  it("never relays to another host", () => {
    expect(upstreamUrl(new URL("https://www.ergstats.com/pulse//evil.example/x")).host).toBe("eu.i.posthog.com");
  });

  it("forwards only what PostHog needs: never cookies", async () => {
    const { sent, fetchImpl } = upstream();
    await relay(new Request("https://www.ergstats.com/pulse/static/x.js", { headers: browserHeaders }), fetchImpl, true);
    const headers = new Headers(sent[0].init.headers);
    expect(headers.get("cookie")).toBeNull();
    expect(headers.get("x-vercel-ip-country")).toBeNull();
    expect(headers.get("user-agent")).toBe("Mozilla/5.0");
    expect(headers.get("x-forwarded-for")).toBe("203.0.113.7");
  });

  it("stamps the visitor's country on gzipped batches and sends them as JSON", async () => {
    const { sent, fetchImpl } = upstream();
    const batch = [{ event: "$pageview", properties: { $current_url: "https://www.ergstats.com/" } }];
    await relay(
      new Request("https://www.ergstats.com/pulse/e/?compression=gzip-js&ver=1", {
        method: "POST",
        headers: browserHeaders,
        body: gzipSync(JSON.stringify(batch)),
      }),
      fetchImpl,
      true,
    );
    expect(sent[0].url).toBe("https://eu.i.posthog.com/e/?ver=1");
    expect(new Headers(sent[0].init.headers).get("content-type")).toBe("application/json");
    expect(bodyOf(sent[0].init)[0].properties).toMatchObject({
      $geoip_disable: true,
      $geoip_country_code: "NL",
      $geoip_country_name: "Netherlands",
    });
  });

  it("recognizes gzip bodies the SDK doesn't flag in the query string", async () => {
    const { sent, fetchImpl } = upstream();
    await relay(
      new Request("https://www.ergstats.com/pulse/e/", {
        method: "POST",
        headers: browserHeaders,
        body: gzipSync(JSON.stringify([{ event: "$pageview", properties: {} }])),
      }),
      fetchImpl,
      true,
    );
    expect(bodyOf(sent[0].init)[0].properties.$geoip_country_code).toBe("NL");
  });

  it("handles base64 form bodies and single events", async () => {
    const { sent, fetchImpl } = upstream();
    const data = Buffer.from(JSON.stringify({ event: "$pageleave", properties: {} })).toString("base64");
    await relay(
      new Request("https://www.ergstats.com/pulse/i/v0/e/?compression=base64", {
        method: "POST",
        headers: browserHeaders,
        body: new URLSearchParams({ data }).toString(),
      }),
      fetchImpl,
      true,
    );
    expect(bodyOf(sent[0].init).properties.$geoip_country_code).toBe("NL");
  });

  it("passes bodies it can't read through untouched", async () => {
    const { sent, fetchImpl } = upstream();
    const body = gzipSync("not json");
    await relay(
      new Request("https://www.ergstats.com/pulse/e/?compression=gzip-js", { method: "POST", headers: browserHeaders, body }),
      fetchImpl,
      true,
    );
    expect(sent[0].url).toContain("compression=gzip-js");
    expect(gunzipSync(sent[0].init.body as Buffer).toString()).toBe("not json");
  });

  it("answers 502 when PostHog can't be reached", async () => {
    const fetchImpl = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    const res = await relay(new Request("https://www.ergstats.com/pulse/e/", { method: "POST", body: "{}" }), fetchImpl, true);
    expect(res.status).toBe(502);
  });

  it("passes JSON that isn't an event through untouched", async () => {
    const { sent, fetchImpl } = upstream();
    const res = await relay(
      new Request("https://www.ergstats.com/pulse/e/", { method: "POST", headers: browserHeaders, body: "5" }),
      fetchImpl,
      true,
    );
    expect(res.status).toBe(200);
    expect(String(sent[0].init.body)).toBe("5");
  });

  it("refuses oversized bodies and doesn't inflate gzip bombs", async () => {
    const { sent, fetchImpl } = upstream();
    const big = await relay(
      new Request("https://www.ergstats.com/pulse/e/", { method: "POST", headers: browserHeaders, body: "x".repeat(1_000_001) }),
      fetchImpl,
      true,
    );
    expect(big.status).toBe(413);
    const bomb = gzipSync(Buffer.alloc(20_000_000, 0x20));
    await relay(new Request("https://www.ergstats.com/pulse/e/", { method: "POST", headers: browserHeaders, body: bomb }), fetchImpl, true);
    expect(sent).toHaveLength(1);
    expect(Buffer.compare(sent[0].init.body as Buffer, bomb)).toBe(0);
  });

  it("relays nothing while analytics is off", async () => {
    const { sent, fetchImpl } = upstream();
    const res = await relay(new Request("https://www.ergstats.com/pulse/e/", { method: "POST", body: "{}" }), fetchImpl, false);
    expect(res.status).toBe(404);
    expect(sent).toHaveLength(0);
  });
});

describe("URL scrubbing", () => {
  it("keeps campaign tags and drops everything else in the query", () => {
    expect(scrubUrl("https://www.ergstats.com/consent?client_id=abc&request_uri=x&utm_source=hn&utm_source_platform=ads#frag")).toBe(
      "https://www.ergstats.com/consent?utm_source=hn&utm_source_platform=ads",
    );
    expect(scrubUrl("/sign-in?callbackURL=/dashboard")).toBe("/sign-in");
  });

  it("scrubs every URL property, including person properties", () => {
    const props: Record<string, unknown> = {
      $current_url: "https://www.ergstats.com/sign-in?code=123",
      $referrer: "$direct",
      $set_once: { $initial_current_url: "https://www.ergstats.com/?state=s" },
      title: "kept?x=1",
    };
    scrubUrlProperties(props);
    expect(props).toEqual({
      $current_url: "https://www.ergstats.com/sign-in",
      $referrer: "$direct",
      $set_once: { $initial_current_url: "https://www.ergstats.com/" },
      title: "kept?x=1",
    });
  });
});
