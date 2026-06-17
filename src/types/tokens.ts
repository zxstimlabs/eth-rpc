/**
 * Response shapes for the `/tokens` endpoint.
 *
 * Standalone — no server-only imports — so this file can be copy-pasted
 * verbatim into the frontend repo. Keep in sync with the runtime source of
 * truth in `src/modules/tokens/service.ts` and the design in
 * `docs/tokens-endpoint.md`.
 *
 * The catalog is keyed by `coingeckoId` (the top-500-by-market-cap set
 * includes natives like BTC/XRP with no contract on our chains). On-chain
 * addresses are nested as `deployments`.
 */

/** One on-chain deployment of a coin. Native coins use the zero address. */
export type TokenDeployment = {
  chainId: number;
  address: string;
  decimals: number;
};

/** Normalized social / resource links (flattened from CoinGecko's blob). */
export type TokenLinks = {
  homepage: string | null;
  whitepaper: string | null;
  twitter: string | null;
  telegram: string | null;
  discord: string | null;
  reddit: string | null;
  github: string[];
  explorers: string[];
};

/** Volatile market data for a coin, in `vsCurrency`. */
export type TokenMarket = {
  vsCurrency: string;
  price: number | null;
  marketCap: number | null;
  marketCapRank: number | null;
  fullyDilutedValuation: number | null;
  totalVolume: number | null;
  high24h: number | null;
  low24h: number | null;
  /** Absolute price delta over 24h, in `vsCurrency`. */
  priceChange24h: number | null;
  /** Percentage change keyed by timeframe, e.g. `{ "1h": .., "24h": .., "7d": .. }`. */
  priceChangePercentage: Record<string, number | null>;
  ath: number | null;
  athChangePercentage: number | null;
  athDate: string | null;
  atl: number | null;
  atlChangePercentage: number | null;
  atlDate: string | null;
  circulatingSupply: number | null;
  totalSupply: number | null;
  maxSupply: number | null;
  /** Only present when `include=sparkline`. 7-day price series. */
  sparkline7d?: number[];
  /** Upstream (CoinGecko) sample time, ISO-8601. */
  lastUpdated: string | null;
};

/**
 * The descriptive token record — identity + profile merged. `market` is
 * joined in by default on the list; `description`, `sparkline`, `community`,
 * and `developer` are opt-in via the `include` param (and always present on
 * the single-token detail route).
 */
export type Token = {
  coingeckoId: string;
  name: string;
  symbol: string;
  logoURI: string;
  marketCapRank: number | null;
  umCurated: boolean;

  /** Only populated when requested via `include=description` (or on detail). */
  description: string | null;
  links: TokenLinks;
  categories: string[];
  sentiment: { upPercentage: number; downPercentage: number } | null;

  /** Empty for native L1s with no contract on a supported chain. Narrowed to
   *  a single chain when the request sets `?chain=`. */
  deployments: TokenDeployment[];

  market?: TokenMarket;
  /** Only present when `include=community`. CoinGecko community stats. */
  community?: Record<string, unknown> | null;
  /** Only present when `include=developer`. CoinGecko developer stats. */
  developer?: Record<string, unknown> | null;
};

/** Full response of `GET /tokens`. */
export type TokensResponse = {
  name: string;
  /** Unix epoch ms; when the API assembled the response (per-request). */
  timestamp: number;
  version: string;
  vsCurrency: string;
  /** Echoed `?chain=` filter; `null` when querying across all chains. */
  chain: string | null;
  /** Echoed `include=` blocks that were applied. */
  include: string[];
  /** Total coins matching the filters (before pagination). */
  total: number;
  page: number;
  perPage: number;
  /** Number of tokens in this page (`tokens.length`). */
  tokenCount: number;
  tokens: Token[];
};
