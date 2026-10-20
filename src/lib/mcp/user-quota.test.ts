import { describe, expect, it } from "vitest";

import { countRequest, decide, USER_QUOTA } from "./user-quota";

const NOW = Date.parse("2026-10-20T20:00:00Z");

describe("user quota", () => {
  it("allows a request while the window has budget left", () => {
    expect(decide({ windowStart: NOW - 30_000, count: 1 }, NOW)).toEqual({ ok: true });
    expect(decide({ windowStart: NOW - 30_000, count: USER_QUOTA.max }, NOW)).toEqual({ ok: true });
  });

  it("refuses the request past the budget, saying when the window ends", () => {
    expect(decide({ windowStart: NOW - 30_000, count: USER_QUOTA.max + 1 }, NOW)).toEqual({ ok: false, retryAfterSeconds: 30 });
    expect(decide({ windowStart: NOW - 59_900, count: USER_QUOTA.max + 40 }, NOW)).toEqual({ ok: false, retryAfterSeconds: 1 });
  });

  it("counts in one statement: insert the first request, otherwise reset an expired window or add to a live one", () => {
    const { sql, params } = countRequest("u1", NOW).toSQL();
    expect(sql).toMatch(/^insert into "mcp_request_quota" \("user_id", "window_start", "count"\) values \(\$1, \$2, \$3\) on conflict \("user_id"\) do update set/);
    expect(sql).toContain('"window_start" = case when "mcp_request_quota"."window_start" <= $4 then $5 else "mcp_request_quota"."window_start" end');
    expect(sql).toContain('"count" = case when "mcp_request_quota"."window_start" <= $6 then 1 else "mcp_request_quota"."count" + 1 end');
    expect(sql).toContain('returning "window_start", "count"');
    expect(params).toEqual(["u1", NOW, 1, NOW - USER_QUOTA.windowMs, NOW, NOW - USER_QUOTA.windowMs]);
  });
});
