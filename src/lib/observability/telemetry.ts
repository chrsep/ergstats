import { after } from "next/server";

import { flushLogs } from "./logger";
import { posthogServer } from "./server";

/**
 * Sends whatever this request queued (events, exceptions, spans, logs).
 * Vercel freezes a function once its response is done, so anything left in a
 * queue would wait for the next request on that instance, or be lost.
 */
export async function flushTelemetry(): Promise<void> {
  // Let captures that are still building their payload (the MCP SDK's run a tick behind) join the batch.
  await new Promise((resolve) => setTimeout(resolve, 0));
  await Promise.all([posthogServer()?.flush().catch(() => {}), flushLogs()]);
}

/** Wraps a route handler so its telemetry is flushed after the response, without delaying it. */
export function withTelemetry<Args extends unknown[]>(
  handler: (req: Request, ...args: Args) => Promise<Response>,
): (req: Request, ...args: Args) => Promise<Response> {
  return (req, ...args) => {
    after(flushTelemetry);
    return handler(req, ...args);
  };
}
