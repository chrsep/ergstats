import { describe, expect, it } from "vitest";

import { classifyToolError, oauthClientLabel, summarizeArguments, userAgentProduct } from "./mcp-events";

describe("MCP event filters", () => {
  it("keeps enums and counts, and turns dates into a range length", () => {
    expect(
      summarizeArguments({ from: "2026-01-01", to: "2026-03-31", machine: "rower", limit: 25, workout_id: 1001 }),
    ).toEqual({ machine: "rower", limit: 25, range_days: 90 });
  });

  it("drops strings that aren't enum-shaped", () => {
    expect(summarizeArguments({ machine: "rower; my name is Ada Lovelace" })).toEqual({});
  });

  it("categorizes failures", () => {
    const concept2 = (status: number) => Object.assign(new Error("x"), { name: "Concept2Error", status });
    const notConnected = (reason: string) => Object.assign(new Error("x"), { name: "NotConnectedError", reason });
    expect(classifyToolError(concept2(404))).toBe("not_found");
    expect(classifyToolError(concept2(503))).toBe("concept2_unavailable");
    expect(classifyToolError(concept2(401))).toBe("concept2_unauthorized");
    expect(classifyToolError(notConnected("refresh_failed"))).toBe("concept2_reconnect_needed");
    expect(classifyToolError(notConnected("no_account"))).toBe("no_concept2_account");
    expect(classifyToolError(new DOMException("slow", "TimeoutError"))).toBe("concept2_timeout");
    expect(classifyToolError(new TypeError("boom"))).toBe("internal");
  });

  it("labels clients coarsely", () => {
    expect(userAgentProduct("claude-code/2.1.0 (linux)")).toBe("claude-code");
    expect(userAgentProduct("Mozilla/5.0 (Macintosh)")).toBe("mozilla");
    expect(oauthClientLabel("https://claude.ai/oauth/mcp-oauth-client-metadata")).toBe("claude.ai");
    expect(oauthClientLabel("Xk3v9a")).toBe("registered");
  });
});
