/**
 * Apply pending Drizzle migrations to the Neon database in DATABASE_URL.
 * Runs before `next build` on Vercel (see the vercel-build script).
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Connect the Neon integration to this Vercel project first.");
  process.exit(1);
}

await migrate(drizzle({ client: neon(url) }), { migrationsFolder: "./drizzle" });
console.log("Database migrations applied.");
