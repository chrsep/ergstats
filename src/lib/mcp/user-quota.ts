import { sql } from "drizzle-orm";

import { db } from "@/db";
import { mcpRequestQuota } from "@/db/app-schema";
import type { QuotaCheck } from "./handler";

/**
 * How much a user may ask of /mcp with OAuth tokens: 120 requests a minute,
 * the budget an API key gets from Better Auth's apikey plugin. The window is
 * fixed: it opens with the first request and the count resets a minute later.
 * One tool call can fan out to dozens of Concept2 requests, so without this
 * a looping agent could burn through the athlete's Concept2 API quota.
 */
export const USER_QUOTA = { max: 120, windowMs: 60_000 } as const;

/**
 * Counts one request for the user in a single statement, so two requests
 * arriving together cannot both read the old count and both get through.
 * Returns the row as it is after counting.
 */
export function countRequest(userId: string, now: number) {
  const expired = sql`${mcpRequestQuota.windowStart} <= ${now - USER_QUOTA.windowMs}`;
  return db
    .insert(mcpRequestQuota)
    .values({ userId, windowStart: now, count: 1 })
    .onConflictDoUpdate({
      target: mcpRequestQuota.userId,
      set: {
        windowStart: sql`case when ${expired} then ${now} else ${mcpRequestQuota.windowStart} end`,
        count: sql`case when ${expired} then 1 else ${mcpRequestQuota.count} + 1 end`,
      },
    })
    .returning({ windowStart: mcpRequestQuota.windowStart, count: mcpRequestQuota.count });
}

/** The verdict for a window with `count` requests so far, the one just made included. */
export function decide(row: { windowStart: number; count: number }, now: number): QuotaCheck {
  if (row.count <= USER_QUOTA.max) return { ok: true };
  return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((row.windowStart + USER_QUOTA.windowMs - now) / 1000)) };
}

export async function consumeUserQuota(userId: string, now = Date.now()): Promise<QuotaCheck> {
  const [row] = await countRequest(userId, now);
  return decide(row, now);
}
