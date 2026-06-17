/**
 * Drizzle schema for the `/tokens` catalog.
 *
 * Three tables, all joined on `coingeckoId` (see docs/tokens-endpoint.md):
 *
 *   coins        — identity + profile (per coin). Slow-changing. Identity is
 *                  seeded by the market refresh; profile by the daily sweep.
 *   markets      — volatile market data (per coin). Refreshed every ~15 min.
 *   deployments  — on-chain addresses (per chain+address). Refreshed daily
 *                  from CoinGecko `detail_platforms` + synthetic natives.
 *
 * The identity/profile vs market split is deliberate: market data churns on a
 * 15-minute cadence while the descriptive record barely changes, so they live
 * in separate tables with separate refresh jobs.
 */

import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import type { TokenLinks } from "../../types/tokens";

const updatedAt = () =>
  integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`);

/** Identity + profile, keyed by CoinGecko coin id. */
export const coins = sqliteTable("coins", {
  coingeckoId: text("coingecko_id").primaryKey(),

  // identity (seeded by the market refresh)
  symbol: text("symbol").notNull(),
  name: text("name").notNull(),
  logoURI: text("logo_uri"),
  umCurated: integer("um_curated", { mode: "boolean" }).notNull().default(true),

  // profile (filled by the daily sweep; null until first swept)
  description: text("description"),
  links: text("links", { mode: "json" }).$type<TokenLinks | null>(),
  categories: text("categories", { mode: "json" }).$type<string[] | null>(),
  sentimentUp: real("sentiment_up"),
  sentimentDown: real("sentiment_down"),
  community: text("community", { mode: "json" }).$type<Record<
    string,
    unknown
  > | null>(),
  developer: text("developer", { mode: "json" }).$type<Record<
    string,
    unknown
  > | null>(),

  /** When the profile was last swept (null = never). Drives the stale-first sweep. */
  profileUpdatedAt: integer("profile_updated_at", { mode: "timestamp_ms" }),
  updatedAt: updatedAt(),
});

/** Volatile market data, keyed by CoinGecko coin id. */
export const markets = sqliteTable("markets", {
  coingeckoId: text("coingecko_id").primaryKey(),
  vsCurrency: text("vs_currency").notNull().default("usd"),

  price: real("price"),
  marketCap: real("market_cap"),
  marketCapRank: integer("market_cap_rank"),
  fullyDilutedValuation: real("fully_diluted_valuation"),
  totalVolume: real("total_volume"),
  high24h: real("high_24h"),
  low24h: real("low_24h"),
  priceChange24h: real("price_change_24h"),
  /** Dedicated column (sortable) for the default 24h %; mirrors the JSON map. */
  priceChangePercentage24h: real("price_change_percentage_24h"),
  /** Per-timeframe % map, e.g. `{ "1h": .., "24h": .., "7d": .. }`. */
  priceChangePercentage: text("price_change_percentage", {
    mode: "json",
  }).$type<Record<string, number | null> | null>(),
  ath: real("ath"),
  athChangePercentage: real("ath_change_percentage"),
  athDate: text("ath_date"),
  atl: real("atl"),
  atlChangePercentage: real("atl_change_percentage"),
  atlDate: text("atl_date"),
  circulatingSupply: real("circulating_supply"),
  totalSupply: real("total_supply"),
  maxSupply: real("max_supply"),
  sparkline7d: text("sparkline_7d", { mode: "json" }).$type<number[] | null>(),
  /** Upstream sample time (ISO-8601). */
  lastUpdated: text("last_updated"),
  /** Full upstream row, for fields we didn't flatten. */
  raw: text("raw", { mode: "json" }).$type<Record<string, unknown> | null>(),
  updatedAt: updatedAt(),
});

/** On-chain deployments, keyed by (chainId, address). */
export const deployments = sqliteTable(
  "deployments",
  {
    chainId: integer("chain_id").notNull(),
    address: text("address").notNull(),
    coingeckoId: text("coingecko_id").notNull(),
    decimals: integer("decimals").notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.chainId, t.address] }),
    index("deployments_coingecko_id_idx").on(t.coingeckoId),
    index("deployments_chain_id_idx").on(t.chainId),
  ]
);

export type CoinRow = typeof coins.$inferSelect;
export type NewCoinRow = typeof coins.$inferInsert;
export type MarketRow = typeof markets.$inferSelect;
export type NewMarketRow = typeof markets.$inferInsert;
export type DeploymentRow = typeof deployments.$inferSelect;
export type NewDeploymentRow = typeof deployments.$inferInsert;
