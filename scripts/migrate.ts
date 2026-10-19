/**
 * Apply pending Drizzle migrations to the database in DATABASE_URL.
 * Runs before `next build` on Vercel (see the vercel-build script).
 */
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { migrate as migrateNeon } from "drizzle-orm/neon-http/migrator";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Connect the Neon integration to this Vercel project first.");
  process.exit(1);
}

const migrationsFolder = "./drizzle";
if (/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  const db = drizzlePg({ connection: url });
  await migratePg(db, { migrationsFolder });
  await db.$client.end();
} else {
  await migrateNeon(drizzleNeon({ client: neon(url) }), { migrationsFolder });
}
console.log("Database migrations applied.");
