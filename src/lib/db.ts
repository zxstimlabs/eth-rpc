/**
 * SQLite + Drizzle setup
 * ----------------------
 * One process-wide DB handle backed by `bun:sqlite` (built into Bun, no
 * native addon to compile) wrapped with `drizzle-orm/bun-sqlite`.
 *
 * The file path is configurable via `DATABASE_PATH` so the dev/prod
 * deployments can point at different locations; defaults to `./data.db`
 * at the process cwd for local development.
 *
 * WAL mode is enabled so concurrent reads (the `/tokens` route) don't
 * block on the cron-driven writers (market refresh / profile sweep).
 */

import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as tokensSchema from "../modules/tokens/schema";

const DATABASE_PATH = process.env.DATABASE_PATH ?? "./data.db";

const sqlite = new Database(DATABASE_PATH, { create: true });
sqlite.run("PRAGMA journal_mode = WAL;");

export const db = drizzle(sqlite, {
  schema: { ...tokensSchema },
});

export type DB = typeof db;
