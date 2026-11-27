/**
 * Shared Postgres connection (Bun's built-in client via Drizzle's `bun-sql`
 * driver — no extra Postgres package).
 *
 * `DATABASE_URL` is required and read once at module load, like every other
 * env var: a missing value means the server refuses to start.
 *
 * Postgres is touched only off the hot path (claims, key registration,
 * lease refills/returns), never once per RPC call — see lib/billing/leases.ts.
 */

import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";
import * as schema from "./schema";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

export const pg = new SQL(DATABASE_URL, {
  max: 10,
  idleTimeout: 30,
  connectionTimeout: 5,
});

export const db = drizzle({ client: pg, schema });
export type Db = typeof db;

/**
 * Apply pending migrations (./drizzle, or MIGRATIONS_DIR in the container).
 * Runs at startup before the server listens; throws if Postgres is
 * unreachable, so the process exits and Docker restarts it.
 */
export const migrateDb = async (): Promise<void> => {
  await migrate(db, { migrationsFolder: process.env.MIGRATIONS_DIR ?? "drizzle" });
};

/** True if Postgres answers within `timeoutMs`. Never throws. */
export const dbHealthy = async (timeoutMs = 500): Promise<boolean> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      pg`select 1`,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
      }),
    ]);
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
};
