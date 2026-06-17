/**
 * Server-side defaults for the `/tokens` endpoint.
 *
 * `/tokens` serves the top-N coins by market cap (CoinGecko-sourced),
 * keyed by `coingeckoId`, with on-chain addresses nested as `deployments`.
 * See `docs/tokens-endpoint.md` for the full design.
 *
 * Everything here is applied server-side (chain mapping, refresh cadence,
 * budget guard). Nothing is accepted from the client.
 */

/** Native-token sentinel address (Uniswap convention, matches `/prices`). */
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/**
 * The chains we surface. `slug` is the public `?chain=` value; `platform`
 * is CoinGecko's asset-platform id (the key inside `detail_platforms`);
 * `chainId` is the numeric EVM id reported on every deployment.
 *
 * Naming is inconsistent upstream — Arbitrum's slug is `arbitrum-one`, not
 * `arbitrum`. Verify a coin's `detail_platforms` keys before adding a chain.
 */
export const CHAINS = [
  { slug: "ethereum", chainId: 1, platform: "ethereum" },
  { slug: "arbitrum", chainId: 42161, platform: "arbitrum-one" },
  { slug: "base", chainId: 8453, platform: "base" },
] as const;

export type ChainSlug = (typeof CHAINS)[number]["slug"];

/** CoinGecko asset-platform slug → numeric chainId, derived from `CHAINS`. */
export const PLATFORM_TO_CHAIN_ID: Record<string, number> = Object.fromEntries(
  CHAINS.map((c) => [c.platform, c.chainId])
);

/** Public chain slug → numeric chainId, derived from `CHAINS`. */
export const SLUG_TO_CHAIN_ID: Record<string, number> = Object.fromEntries(
  CHAINS.map((c) => [c.slug, c.chainId])
);

/**
 * Coins that are the native gas token on a chain (no ERC-20 contract). We
 * synthesize a zero-address deployment for these so the frontend references
 * native ETH the same way `/prices` does. CoinGecko's `detail_platforms`
 * either omits these or returns an empty address, so we inject them.
 */
export const NATIVE_COINS: Array<{
  coingeckoId: string;
  chainIds: number[];
  decimals: number;
}> = [{ coingeckoId: "ethereum", chainIds: [1, 42161, 8453], decimals: 18 }];

export const tokensConfig = {
  /** Human-readable list name surfaced on every `/tokens` response. */
  name: "UnitMetal Token List",

  /** Bumped manually when the projection shape changes. */
  version: "1.0.0",

  /** Canonical pricing currency. Multi-currency comes later via an FX layer. */
  vsCurrency: "usd",

  /** How many top coins by market cap to track and serve. */
  topN: 500,

  /**
   * Price-change timeframes requested from `/coins/markets` and exposed in
   * `market.priceChangePercentage`. The list endpoint's `priceChange` param
   * can narrow which of these are returned, but it can't request a timeframe
   * we never fetched.
   */
  priceChangeTimeframes: ["1h", "24h", "7d"] as const,

  /** `include=` blocks the read endpoint knows how to serve. */
  includeBlocks: ["description", "sparkline", "community", "developer"] as const,

  /** Sort keys the read endpoint accepts. */
  sortKeys: ["marketCap", "rank", "volume", "priceChange24h", "name"] as const,

  /** Per-client rate-limit budget. Reads hit SQLite only, so this is generous. */
  rateLimit: { max: 60, durationMs: 60_000 },

  /** Pagination. The home page paginates the top 500 at 100/page (pages 1–5). */
  defaultPerPage: 100,
  maxPerPage: 250,

  refresh: {
    /** Market refresh cron — every 15 min (2 calls/tick for 500 coins). */
    marketPattern: "*/15 * * * *",
    /** Profile sweep cron — daily; refreshes the most-stale slice each run. */
    profilePattern: "0 3 * * *",
    /**
     * Spread the full profile sweep across this many days. The daily cron
     * refreshes ~`topN / profileRefreshDays` of the most-stale coins, so
     * every coin's profile is re-fetched ~once per this many days. Keeps the
     * job short, resumable across restarts, and within the demo budget.
     */
    profileRefreshDays: 7,
    /** Paced delay between per-coin `/coins/{id}` calls (demo ≈ 30 req/min). */
    profilePacingMs: 2_000,
    // No `/key` budget guard: that endpoint is PRO-only (401 on demo), and the
    // cadences above are sized to stay within the demo monthly allowance.
  },
} as const;
