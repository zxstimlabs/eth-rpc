/**
 * Tests for the /tokens read path (`TokensService`).
 *
 * Fully offline: seeds an in-memory SQLite DB with a known fixture and
 * exercises the query/filter/sort/pagination/projection logic directly. No
 * CoinGecko, no cron — those belong to `TokensRefresh` and are integration
 * concerns. We import the db/schema/service dynamically inside `beforeAll`
 * AFTER pointing `DATABASE_PATH` at `:memory:`, so the singleton db handle
 * binds to the throwaway database.
 */

import { beforeAll, describe, expect, test } from "bun:test";
import type { ListParams } from "../modules/tokens/service";

let TokensService: typeof import("../modules/tokens/service").TokensService;

const ZERO = "0x0000000000000000000000000000000000000000";
const USDC_ETH = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const USDC_BASE = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const ARB_ARBITRUM = "0x912ce59144191c1204e64559fe8253a0e49e6548";
const SOME_ETH = "0x1111111111111111111111111111111111111111";

/** Build ListParams with sane defaults; override per test. */
function params(over: Partial<ListParams> = {}): ListParams {
  return {
    chain: null,
    include: [],
    q: null,
    addresses: null,
    symbols: null,
    ids: null,
    category: null,
    curated: false,
    sort: "marketCap",
    order: "desc",
    page: 1,
    perPage: 100,
    priceChange: ["24h"],
    ...over,
  };
}

beforeAll(async () => {
  process.env.DATABASE_PATH = ":memory:";

  const { db } = await import("../lib/db");
  const { migrate } = await import("drizzle-orm/bun-sqlite/migrator");
  migrate(db, { migrationsFolder: "./drizzle" });

  const { coins, markets, deployments } = await import(
    "../modules/tokens/schema"
  );

  db.insert(coins)
    .values([
      { coingeckoId: "bitcoin", symbol: "BTC", name: "Bitcoin", logoURI: "btc.png", umCurated: true },
      {
        coingeckoId: "ethereum",
        symbol: "ETH",
        name: "Ethereum",
        logoURI: "eth.png",
        umCurated: true,
        description: "Smart contract platform",
        categories: ["Smart Contract Platform"],
        sentimentUp: 80,
        sentimentDown: 20,
      },
      {
        coingeckoId: "usd-coin",
        symbol: "USDC",
        name: "USD Coin",
        logoURI: "usdc.png",
        umCurated: true,
        categories: ["Stablecoins"],
      },
      { coingeckoId: "arbitrum", symbol: "ARB", name: "Arbitrum", logoURI: "arb.png", umCurated: true },
      {
        coingeckoId: "some-token",
        symbol: "SOME",
        name: "Some Token",
        logoURI: "some.png",
        umCurated: false,
        description: "A defi token",
        categories: ["DeFi"],
      },
    ])
    .run();

  // marketCap chosen so descending order == rank order (bitcoin → some-token).
  const mk = (
    coingeckoId: string,
    marketCapRank: number,
    price: number,
    marketCap: number,
    totalVolume: number,
    pc24: number
  ) => ({
    coingeckoId,
    vsCurrency: "usd",
    price,
    marketCap,
    marketCapRank,
    totalVolume,
    priceChange24h: pc24,
    priceChangePercentage24h: pc24,
    priceChangePercentage: { "1h": 0.1, "24h": pc24, "7d": 1.5 },
    sparkline7d: [1, 2, 3],
    lastUpdated: "2026-06-16T00:00:00Z",
  });
  db.insert(markets)
    .values([
      mk("bitcoin", 1, 60000, 1e12, 1e9, 2.5),
      mk("ethereum", 2, 3000, 4e11, 5e8, -1.2),
      mk("usd-coin", 4, 1, 3e10, 2e8, 0.01),
      mk("arbitrum", 50, 1.2, 1e10, 3e7, 5.0),
      mk("some-token", 100, 0.5, 5e6, 1e6, -3.0),
    ])
    .run();

  db.insert(deployments)
    .values([
      // bitcoin: intentionally no deployments (native, no contract on our chains)
      { chainId: 1, address: ZERO, coingeckoId: "ethereum", decimals: 18 },
      { chainId: 42161, address: ZERO, coingeckoId: "ethereum", decimals: 18 },
      { chainId: 8453, address: ZERO, coingeckoId: "ethereum", decimals: 18 },
      { chainId: 1, address: USDC_ETH, coingeckoId: "usd-coin", decimals: 6 },
      { chainId: 8453, address: USDC_BASE, coingeckoId: "usd-coin", decimals: 6 },
      { chainId: 42161, address: ARB_ARBITRUM, coingeckoId: "arbitrum", decimals: 18 },
      { chainId: 1, address: SOME_ETH, coingeckoId: "some-token", decimals: 18 },
    ])
    .run();

  ({ TokensService } = await import("../modules/tokens/service"));
});

// --- list: envelope + default behavior ------------------------------------

describe("TokensService.list", () => {
  test("returns all coins with the documented envelope", () => {
    const res = TokensService.list(params());
    expect(res.total).toBe(5);
    expect(res.tokenCount).toBe(5);
    expect(res.tokens).toHaveLength(5);
    expect(res.vsCurrency).toBe("usd");
    expect(res.chain).toBeNull();
    expect(typeof res.timestamp).toBe("number");
  });

  test("default sort is market cap descending", () => {
    const res = TokensService.list(params());
    expect(res.tokens.map((t) => t.coingeckoId)).toEqual([
      "bitcoin",
      "ethereum",
      "usd-coin",
      "arbitrum",
      "some-token",
    ]);
  });

  test("market data is included by default", () => {
    const res = TokensService.list(params());
    const btc = res.tokens.find((t) => t.coingeckoId === "bitcoin");
    expect(btc?.market?.price).toBe(60000);
    expect(btc?.market?.vsCurrency).toBe("usd");
  });

  test("description is omitted unless requested", () => {
    const dflt = TokensService.list(params());
    expect(dflt.tokens.find((t) => t.coingeckoId === "ethereum")?.description).toBeNull();

    const withDesc = TokensService.list(params({ include: ["description"] }));
    expect(
      withDesc.tokens.find((t) => t.coingeckoId === "ethereum")?.description
    ).toBe("Smart contract platform");
  });

  test("sparkline is opt-in via include", () => {
    expect(
      TokensService.list(params()).tokens[0]?.market?.sparkline7d
    ).toBeUndefined();
    expect(
      TokensService.list(params({ include: ["sparkline"] })).tokens[0]?.market
        ?.sparkline7d
    ).toEqual([1, 2, 3]);
  });

  test("priceChangePercentage only exposes requested timeframes", () => {
    const res = TokensService.list(params({ priceChange: ["1h", "7d"] }));
    const pcp = res.tokens[0]?.market?.priceChangePercentage ?? {};
    expect(Object.keys(pcp).sort()).toEqual(["1h", "7d"]);
  });

  test("sentiment is assembled when present, null otherwise", () => {
    const res = TokensService.list(params());
    expect(res.tokens.find((t) => t.coingeckoId === "ethereum")?.sentiment).toEqual({
      upPercentage: 80,
      downPercentage: 20,
    });
    expect(res.tokens.find((t) => t.coingeckoId === "bitcoin")?.sentiment).toBeNull();
  });
});

// --- chain filter + projection --------------------------------------------

describe("TokensService.list — chain filter", () => {
  test("?chain=ethereum returns only coins deployed on chain 1", () => {
    const res = TokensService.list(params({ chain: "ethereum" }));
    expect(res.tokens.map((t) => t.coingeckoId).sort()).toEqual([
      "ethereum",
      "some-token",
      "usd-coin",
    ]);
    expect(res.chain).toBe("ethereum");
  });

  test("?chain projects deployments to that one chain", () => {
    const res = TokensService.list(params({ chain: "ethereum" }));
    for (const t of res.tokens) {
      expect(t.deployments.length).toBeGreaterThan(0);
      for (const d of t.deployments) expect(d.chainId).toBe(1);
    }
  });

  test("?chain=base narrows the set", () => {
    const res = TokensService.list(params({ chain: "base" }));
    expect(res.tokens.map((t) => t.coingeckoId).sort()).toEqual([
      "ethereum",
      "usd-coin",
    ]);
  });

  test("without chain, all deployments are listed", () => {
    const res = TokensService.list(params());
    const eth = res.tokens.find((t) => t.coingeckoId === "ethereum");
    expect(eth?.deployments.map((d) => d.chainId).sort((a, b) => a - b)).toEqual([
      1, 8453, 42161,
    ]);
  });

  test("coins with no deployment are excluded by a chain filter", () => {
    const res = TokensService.list(params({ chain: "ethereum" }));
    expect(res.tokens.some((t) => t.coingeckoId === "bitcoin")).toBe(false);
  });
});

// --- other filters ---------------------------------------------------------

describe("TokensService.list — filters", () => {
  test("curated=true drops non-curated coins", () => {
    const res = TokensService.list(params({ curated: true }));
    expect(res.total).toBe(4);
    expect(res.tokens.some((t) => t.coingeckoId === "some-token")).toBe(false);
  });

  test("q searches name and symbol (case-insensitive)", () => {
    // "bitco" rather than "bit" — the latter also matches ar(bit)rum.
    expect(
      TokensService.list(params({ q: "bitco" })).tokens.map((t) => t.coingeckoId)
    ).toEqual(["bitcoin"]);
    expect(
      TokensService.list(params({ q: "usdc" })).tokens.map((t) => t.coingeckoId)
    ).toEqual(["usd-coin"]);
  });

  test("symbols filter", () => {
    expect(
      TokensService.list(params({ symbols: ["USDC"] })).tokens.map((t) => t.coingeckoId)
    ).toEqual(["usd-coin"]);
  });

  test("ids filter", () => {
    expect(
      TokensService.list(params({ ids: ["arbitrum"] })).tokens.map((t) => t.coingeckoId)
    ).toEqual(["arbitrum"]);
  });

  test("category filter", () => {
    expect(
      TokensService.list(params({ category: "DeFi" })).tokens.map((t) => t.coingeckoId)
    ).toEqual(["some-token"]);
  });

  test("addresses filter (any chain)", () => {
    expect(
      TokensService.list(params({ addresses: [USDC_ETH] })).tokens.map((t) => t.coingeckoId)
    ).toEqual(["usd-coin"]);
  });

  test("sort=name asc", () => {
    const res = TokensService.list(params({ sort: "name", order: "asc" }));
    expect(res.tokens[0]?.name).toBe("Arbitrum");
  });
});

// --- pagination ------------------------------------------------------------

describe("TokensService.list — pagination", () => {
  test("perPage caps the page while total reflects the full set", () => {
    const p1 = TokensService.list(params({ perPage: 2, page: 1 }));
    expect(p1.total).toBe(5);
    expect(p1.tokenCount).toBe(2);
    expect(p1.tokens.map((t) => t.coingeckoId)).toEqual(["bitcoin", "ethereum"]);

    const p3 = TokensService.list(params({ perPage: 2, page: 3 }));
    expect(p3.tokenCount).toBe(1);
    expect(p3.tokens.map((t) => t.coingeckoId)).toEqual(["some-token"]);
  });
});

// --- detail ----------------------------------------------------------------

describe("TokensService.get", () => {
  test("returns the full record incl. description and all deployments", () => {
    const eth = TokensService.get("ethereum");
    expect(eth?.description).toBe("Smart contract platform");
    expect(eth?.deployments).toHaveLength(3);
    expect(eth?.market?.price).toBe(3000);
  });

  test("returns null for an unknown id", () => {
    expect(TokensService.get("not-a-coin")).toBeNull();
  });
});
