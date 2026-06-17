/**
 * Seed the tokens catalog in one shot.
 * -------------------------------------
 * Runs a market refresh (top-N coins) followed by a FULL profile sweep — all
 * coins in a single pass — so `deployments` and profile fields are populated
 * immediately after a fresh deploy, instead of trickling in over a week of
 * daily crons. Once seeded, the daily `tokens-profile-sweep` cron keeps things
 * fresh (it refreshes the most-stale slice each day).
 *
 *   bun --env-file=.env.local run src/script/seed-tokens.ts
 *   bun --env-file=.env.local run src/script/seed-tokens.ts --force   # re-sweep ALL profiles
 *
 * Cost: ~`topN` CoinGecko calls (the top-500 default ≈ 5% of the demo monthly
 * budget), ~17 min at the paced rate. Resumable: by default it only sweeps
 * coins not yet profiled, so re-running after an interruption is cheap and a
 * fully-seeded catalog re-runs as a no-op. Pass `--force` to re-fetch every
 * profile regardless. Safe to run while the server is up (SQLite WAL).
 *
 * Applies pending migrations first, so it bootstraps a brand-new DB on its own.
 */

import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { db } from "../lib/db";
import { tokensConfig } from "../config/tokens";
import { TokensRefresh } from "../modules/tokens/refresh";

const force = process.argv.includes("--force");

// Idempotent — only applies what's pending. Makes this a one-command bootstrap.
migrate(db, { migrationsFolder: "./drizzle" });

console.log(`[seed] market refresh (top ${tokensConfig.topN} by market cap)…`);
const market = await TokensRefresh.refreshMarkets();
console.log(`[seed] markets: fetched ${market.fetched}, written ${market.written}`);

const worstCaseMin = Math.ceil(
  (tokensConfig.topN * tokensConfig.refresh.profilePacingMs) / 60_000
);
console.log(
  `[seed] profile sweep — ${force ? "ALL (forced)" : "never-swept only"}, ` +
    `up to ${tokensConfig.topN} coins, ~${
      tokensConfig.refresh.profilePacingMs / 1000
    }s each (≈${worstCaseMin} min worst case)…`
);

const profiles = await TokensRefresh.sweepProfiles({
  limit: tokensConfig.topN,
  onlyNeverSwept: !force,
});

console.log(`[seed] profiles swept: ${profiles.swept}/${profiles.total}`);
console.log("[seed] done — the daily cron maintains profiles from here.");
process.exit(0);
