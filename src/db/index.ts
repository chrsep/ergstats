import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

/**
 * Neon over HTTP: one round trip per query, no pooled connections to manage
 * on Vercel Functions. The Neon integration on Vercel sets DATABASE_URL.
 *
 * The placeholder only lets `next build` import this module without a
 * database; any query against it fails loudly.
 */
const url = process.env.DATABASE_URL ?? "postgresql://missing:missing@database-url-not-set.invalid/ergstats";

export const db = drizzle({ client: neon(url), schema });
