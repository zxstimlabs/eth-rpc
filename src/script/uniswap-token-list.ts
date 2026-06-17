/**
 * Fetch Uniswap's official token list and persist it to disk.
 *
 * The list at https://tokens.uniswap.org/ follows the standard Token List
 * schema (https://tokenlists.org): a top-level `{ name, version, tokens }`
 * object where `tokens` is an array of `{ chainId, address, name, symbol,
 * decimals, logoURI, ... }`. The `/tokens` endpoint reads the saved file
 * at request time, so re-run this script whenever you want fresh metadata.
 *
 *   bun run src/script/uniswap-token-list.ts
 */

import { resolve } from "node:path";

const SOURCE_URL = "https://tokens.uniswap.org/";
const OUTPUT_PATH = resolve(
  import.meta.dirname,
  "../data/uniswap-token-list.json"
);

const res = await fetch(SOURCE_URL, {
  headers: { Accept: "application/json" },
});
if (!res.ok) {
  throw new Error(
    `Failed to fetch ${SOURCE_URL}: HTTP ${res.status} ${res.statusText}`
  );
}

// Parse — confirms upstream returned valid JSON before we overwrite the
// existing file. Defensive: a future Uniswap outage could return an HTML
// error page with a 200; this catches that.
const list = (await res.json()) as {
  name?: string;
  version?: { major: number; minor: number; patch: number };
  tokens?: unknown[];
};
if (!Array.isArray(list.tokens)) {
  throw new Error(
    `Unexpected response shape from ${SOURCE_URL}: missing \`tokens\` array`
  );
}

// Re-serialize with stable 2-space indent so diffs across runs are readable.
await Bun.write(OUTPUT_PATH, JSON.stringify(list, null, 2));

const version = list.version
  ? `${list.version.major}.${list.version.minor}.${list.version.patch}`
  : "unknown";
console.log(
  `Saved ${list.tokens.length} tokens from "${list.name ?? "Uniswap"}" v${version} → ${OUTPUT_PATH}`
);
