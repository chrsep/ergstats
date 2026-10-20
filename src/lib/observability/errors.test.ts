import { gunzipSync } from "node:zlib";

import { DrizzleQueryError } from "drizzle-orm";
import { PostHog } from "posthog-node";
import { describe, expect, it, vi } from "vitest";

import { reportableError } from "./errors";
import { captureError } from "./server";

vi.stubEnv("BETTER_AUTH_SECRET", "test-secret");

const SQL = 'insert into "agent_feedback" ("user_id", "type", "summary") values ($1, $2, $3)';
// Built at runtime: error tracking attaches the source lines around each
// frame, and the test's own source must not be where these strings turn up.
const USER_ID = ["user", "7f3a"].join("-");
const SUMMARY = ["Wanted heart rate zones", "for my March pieces"].join(" ");

/** The error Drizzle throws when Neon rejects a query: the SQL and its parameters in the message, the driver's error as the cause. */
function queryError(): DrizzleQueryError {
  const driver = new Error('null value in column "type" violates not-null constraint');
  driver.name = "NeonDbError";
  return new DrizzleQueryError(SQL, [USER_ID, "missing_capability", SUMMARY], driver);
}

describe("reportableError", () => {
  it("keeps a failed query's SQL and driver error, and drops its parameters", () => {
    const original = queryError();
    expect(original.message).toContain(SUMMARY);
    expect(original.stack).toContain(USER_ID);

    const reported = reportableError(original) as Error;
    expect(reported.name).toBe("DrizzleQueryError");
    expect(reported.message).toBe(`Failed query: ${SQL}`);
    expect(reported.stack).toContain("errors.test.ts");
    expect(reported.stack).not.toContain(SUMMARY);
    expect(reported.stack).not.toContain(USER_ID);
    const cause = reported.cause as Error;
    expect(cause.name).toBe("NeonDbError");
    expect(cause.message).toContain("not-null constraint");
  });

  it("scrubs a query error that another error wraps as its cause", () => {
    const wrapped = new Error("Could not save feedback", { cause: queryError() });
    const reported = reportableError(wrapped) as Error;
    expect(reported.message).toBe("Could not save feedback");
    expect(reported.stack).toBe(wrapped.stack);
    expect((reported.cause as Error).message).toBe(`Failed query: ${SQL}`);
  });

  it("leaves every other error as it is", () => {
    const error = new TypeError("boom", { cause: new Error("inner") });
    expect(reportableError(error)).toBe(error);
    expect(reportableError("a string")).toBe("a string");
    expect(reportableError(undefined)).toBeUndefined();
  });
});

/** Request bodies come as JSON, possibly gzipped, in a string, a Blob or bytes. */
async function decode(body: unknown): Promise<string> {
  if (body === undefined || body === null) return "";
  const bytes =
    typeof body === "string"
      ? Buffer.from(body)
      : body instanceof Blob
        ? Buffer.from(await body.arrayBuffer())
        : Buffer.from(body as Uint8Array);
  return (bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes).toString("utf8");
}

describe("captureError", () => {
  it("sends error tracking the query, never the parameters", async () => {
    const sent: string[] = [];
    const posthog = new PostHog("phc_test", {
      host: "https://eu.i.posthog.com",
      flushAt: 1000,
      disableGeoip: true,
      fetch: async (_url, options) => {
        sent.push(await decode(options.body));
        return { status: 200, text: async () => "{}", json: async () => ({}) };
      },
    });

    captureError(posthog, queryError(), { source: "mcp_tool" }, USER_ID);
    await new Promise((resolve) => setTimeout(resolve, 10));
    await posthog.flush();

    const json = sent.join("\n");
    expect(json).toContain("$exception");
    expect(json).toContain("Failed query: insert into");
    expect(json).toContain("NeonDbError");
    expect(json).not.toContain(SUMMARY);
    expect(json).not.toContain(USER_ID);
  });
});
