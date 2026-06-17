/**
 * Fetch every CoinGecko-listed coin and persist per-chain token lists
 * (one JSON file per supported chain) to `src/data/`.
 *
 * Approach: CoinGecko's `/coins/list?include_platform=true` returns the
 * full universe of supported coins (~17k entries at the time of writing)
 * in a single response, with a `platforms` map per coin (asset-platform
 * slug → contract address). We fetch ONCE and filter the same response
 * for each supported chain — way cheaper than calling per chain.
 *
 * Per-token output shape is intentionally minimal — `chainId`, `address`,
 * `name`, `symbol`, `coingeckoId`. Decimals and logoURI aren't on
 * `/coins/list`; fetching them would mean a per-coin call (4k+ tokens at
 * 30 req/min would take hours). Enrich downstream when needed (on-chain
 * `decimals()` multicall is the cheapest path).
 *
 *   bun run src/script/create-token-lists.ts
 */

import { resolve } from "node:path";
import Coingecko from "@coingecko/coingecko-typescript";

const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;
if (!COINGECKO_API_KEY) {
  throw new Error("COINGECKO_API_KEY is not set");
}

/**
 * Chains we write a token list for. `platform` is CoinGecko's asset-
 * platform slug (the key in each coin's `platforms` map); `slug` is what
 * we use in the output filename (`{slug}-token-list.json`) and matches
 * the `/tokens/{slug}` route slug in the controller.
 *
 * When CoinGecko adds support for a chain we want, add it here. Verify
 * the platform key by inspecting one coin's `platforms` map first —
 * naming conventions are inconsistent (Arbitrum is `arbitrum-one`, not
 * `arbitrum`).
 */
const CHAINS: Array<{
  chainId: number;
  slug: string;
  platform: string;
  name: string;
}> = [
  { chainId: 1, slug: "ethereum", platform: "ethereum", name: "Ethereum" },
  { chainId: 42161, slug: "arbitrum", platform: "arbitrum-one", name: "Arbitrum" },
  { chainId: 8453, slug: "base", platform: "base", name: "Base" },
];

const client = new Coingecko({
  demoAPIKey: COINGECKO_API_KEY,
  environment: "demo",
});

// Single call — CoinGecko returns the full universe in one response.
// `include_platform: true` adds the `platforms` map; without it we'd get
// just (id, name, symbol). `status` defaults to `"active"`.
const all = await client.coins.list.get({ include_platform: true });
console.log(`coingecko: ${all.length} total coins returned`);

// Strict 20-byte hex address. CoinGecko occasionally returns "" or " "
// for some platform entries — those get filtered out here.
const HEX_ADDRESS = /^0x[a-fA-F0-9]{40}$/;

for (const chain of CHAINS) {
  const tokens: Array<{
    chainId: number;
    address: string;
    name: string;
    symbol: string;
    coingeckoId: string;
  }> = [];

  for (const coin of all) {
    const address = coin.platforms?.[chain.platform];
    if (!address || !HEX_ADDRESS.test(address)) continue;
    if (!coin.id || !coin.name || !coin.symbol) continue;
    tokens.push({
      chainId: chain.chainId,
      address,
      name: coin.name,
      // Uppercase to match the Uniswap list's convention so the two
      // feeds merge cleanly downstream.
      symbol: coin.symbol.toUpperCase(),
      coingeckoId: coin.id,
    });
  }

  const payload = {
    name: `CoinGecko ${chain.name} Token Listing`,
    source: "coingecko",
    timestamp: new Date().toISOString(),
    tokenCount: tokens.length,
    tokens,
  };

  const outputPath = resolve(
    import.meta.dirname,
    `../data/${chain.slug}-token-list.json`
  );
  await Bun.write(outputPath, JSON.stringify(payload, null, 2));
  console.log(
    `${chain.slug.padEnd(8)}  ${tokens.length.toString().padStart(5)} tokens → ${outputPath}`
  );
}
