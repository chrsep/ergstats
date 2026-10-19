import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";

import * as schema from "./schema";

/**
 * Neon over HTTP in production: one round trip per query and no pooled
 * connections to manage on Vercel Functions. The Neon integration on Vercel
 * sets DATABASE_URL.
 *
 * A localhost DATABASE_URL uses node-postgres instead, so local development
 * and the end-to-end test run against a plain Postgres.
 *
 * The placeholder only lets `next build` import this module without a
 * database; any query against it fails loudly.
 */
const url = process.env.DATABASE_URL ?? "postgresql://missing:missing@database-url-not-set.invalid/ergstats";

const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);

export const db = isLocal
  ? (drizzlePg({ connection: url, schema }) as unknown as ReturnType<typeof drizzleNeon<typeof schema>>)
  : drizzleNeon({ client: neon(url), schema });
