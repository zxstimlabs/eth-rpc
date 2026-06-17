/**
 * Shape of one entry in the curated, fixed token lists (`src/data/tokens.ts`).
 *
 * Standalone — no server-only imports — so it can be copy-pasted into the
 * frontend alongside the data. Each entry is a supported token with its
 * identity fixed beforehand: read balances via RPC using `address`/`decimals`,
 * then fetch prices from `/tokens`. Tokens absent from the list have no price.
 */
export type UmCuratedToken = {
  chainId: number;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI: string;
  coingeckoId: string;
};
