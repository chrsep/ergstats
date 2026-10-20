import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { erasePosthogPerson } from "./erase";
import { pseudonymFor } from "./pseudonym";

describe("erasePosthogPerson", () => {
  beforeEach(() => {
    vi.stubEnv("BETTER_AUTH_SECRET", "test-secret");
    vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "phx_test");
    vi.stubEnv("POSTHOG_PROJECT_ID", "312127");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("deletes the person and their events by pseudonym", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 202 }));
    expect(await erasePosthogPerson("user-1", fetchImpl, true)).toBe("queued");
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://eu.posthog.com/api/projects/312127/persons/bulk_delete/");
    expect(init.headers).toMatchObject({ Authorization: "Bearer phx_test" });
    expect(JSON.parse(String(init.body))).toEqual({ distinct_ids: [pseudonymFor("user-1")], delete_events: true });
  });

  it("does nothing without a personal API key", async () => {
    vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "");
    const fetchImpl = vi.fn();
    expect(await erasePosthogPerson("user-1", fetchImpl, true)).toBe("skipped");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does nothing while analytics is off", async () => {
    const fetchImpl = vi.fn();
    expect(await erasePosthogPerson("user-1", fetchImpl, false)).toBe("skipped");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reports a failure instead of throwing", async () => {
    expect(await erasePosthogPerson("user-1", async () => new Response(null, { status: 403 }), true)).toBe("failed");
    const offline = async (): Promise<Response> => {
      throw new Error("network down");
    };
    expect(await erasePosthogPerson("user-1", offline, true)).toBe("failed");
  });
});
