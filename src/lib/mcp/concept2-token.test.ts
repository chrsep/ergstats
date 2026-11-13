import { describe, expect, it, vi } from "vitest";

import { getTokenWithRetry } from "./concept2-token";

const noWait = () => Promise.resolve();

describe("getTokenWithRetry", () => {
  it("returns the first token without waiting", async () => {
    const wait = vi.fn(noWait);
    const fetchToken = vi.fn().mockResolvedValue("token-1");

    await expect(getTokenWithRetry(fetchToken, { wait })).resolves.toBe("token-1");
    expect(fetchToken).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });

  it("picks up the token another request refreshed after losing the race", async () => {
    const onError = vi.fn();
    const wait = vi.fn(noWait);
    const fetchToken = vi.fn().mockRejectedValueOnce(new Error("invalid_grant")).mockResolvedValueOnce("rotated");

    await expect(getTokenWithRetry(fetchToken, { wait, onError, delaysMs: [500, 1000] })).resolves.toBe("rotated");
    expect(wait).toHaveBeenCalledWith(500);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("treats an empty token like a failure", async () => {
    const fetchToken = vi.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce("token-2");

    await expect(getTokenWithRetry(fetchToken, { wait: noWait })).resolves.toBe("token-2");
  });

  it("gives up after the last retry", async () => {
    const wait = vi.fn(noWait);
    const fetchToken = vi.fn().mockRejectedValue(new Error("invalid_grant"));

    await expect(getTokenWithRetry(fetchToken, { wait, delaysMs: [500, 1000] })).resolves.toBeUndefined();
    expect(fetchToken).toHaveBeenCalledTimes(3);
    expect(wait.mock.calls).toEqual([[500], [1000]]);
  });
});
