/**
 * TokensService
 * -------------
 * The read side of `/tokens`. Pure SQLite — never calls CoinGecko (that's
 * `TokensRefresh`). Joins `coins` + `markets` on `coingeckoId`, applies the
 * query filters/sort/pagination, then attaches `deployments` in a second
 * query (narrowed to one chain when `?chain=` is set).
 *
 * Has no Elysia dependency, so the controller stays a thin wrapper and this
 * is unit-testable by seeding the DB directly.
 */

import { and, asc, count, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "../../lib/db";
import { SLUG_TO_CHAIN_ID, tokensConfig } from "../../config/tokens";
import type {
  Token,
  TokenDeployment,
  TokenLinks,
  TokenMarket,
  TokensResponse,
} from "../../types/tokens";
import {
  coins,
  deployments,
  markets,
  type CoinRow,
  type MarketRow,
} from "./schema";

export type SortKey = (typeof tokensConfig.sortKeys)[number];

export type ListParams = {
  chain: string | null;
  include: string[];
  q: string | null;
  addresses: string[] | null; // lowercased
  symbols: string[] | null; // uppercased
  ids: string[] | null;
  category: string | null;
  curated: boolean;
  sort: SortKey;
  order: "asc" | "desc";
  page: number;
  perPage: number;
  priceChange: string[]; // timeframes to expose
};

const EMPTY_LINKS: TokenLinks = {
  homepage: null,
  whitepaper: null,
  twitter: null,
  telegram: null,
  discord: null,
  reddit: null,
  github: [],
  explorers: [],
};

type AssembleOpts = {
  include: string[];
  description: boolean;
  priceChange: string[];
};

const SORT_COLUMNS = {
  marketCap: markets.marketCap,
  rank: markets.marketCapRank,
  volume: markets.totalVolume,
  priceChange24h: markets.priceChangePercentage24h,
  name: coins.name,
} as const;

function toMarket(m: MarketRow, opts: AssembleOpts): TokenMarket {
  const all = m.priceChangePercentage ?? {};
  const priceChangePercentage: Record<string, number | null> = {};
  for (const tf of opts.priceChange) {
    if (tf in all) priceChangePercentage[tf] = all[tf] ?? null;
  }
  const market: TokenMarket = {
    vsCurrency: m.vsCurrency,
    price: m.price,
    marketCap: m.marketCap,
    marketCapRank: m.marketCapRank,
    fullyDilutedValuation: m.fullyDilutedValuation,
    totalVolume: m.totalVolume,
    high24h: m.high24h,
    low24h: m.low24h,
    priceChange24h: m.priceChange24h,
    priceChangePercentage,
    ath: m.ath,
    athChangePercentage: m.athChangePercentage,
    athDate: m.athDate,
    atl: m.atl,
    atlChangePercentage: m.atlChangePercentage,
    atlDate: m.atlDate,
    circulatingSupply: m.circulatingSupply,
    totalSupply: m.totalSupply,
    maxSupply: m.maxSupply,
    lastUpdated: m.lastUpdated,
  };
  if (opts.include.includes("sparkline")) {
    market.sparkline7d = m.sparkline7d ?? [];
  }
  return market;
}

function assembleToken(
  coin: CoinRow,
  market: MarketRow,
  deps: TokenDeployment[],
  opts: AssembleOpts
): Token {
  const sentiment =
    coin.sentimentUp != null || coin.sentimentDown != null
      ? {
          upPercentage: coin.sentimentUp ?? 0,
          downPercentage: coin.sentimentDown ?? 0,
        }
      : null;

  const token: Token = {
    coingeckoId: coin.coingeckoId,
    name: coin.name,
    symbol: coin.symbol,
    logoURI: coin.logoURI ?? "",
    marketCapRank: market.marketCapRank,
    umCurated: coin.umCurated,
    description: opts.description ? coin.description ?? null : null,
    links: coin.links ?? EMPTY_LINKS,
    categories: coin.categories ?? [],
    sentiment,
    deployments: deps,
    market: toMarket(market, opts),
  };
  if (opts.include.includes("community")) token.community = coin.community ?? null;
  if (opts.include.includes("developer")) token.developer = coin.developer ?? null;
  return token;
}

/** Map page rows → coingeckoId → deployments[], narrowed to `chainId` if set. */
function loadDeployments(
  coingeckoIds: string[],
  chainId: number | null
): Map<string, TokenDeployment[]> {
  const byCoin = new Map<string, TokenDeployment[]>();
  if (coingeckoIds.length === 0) return byCoin;

  const conds: SQL[] = [inArray(deployments.coingeckoId, coingeckoIds)];
  if (chainId !== null) conds.push(eq(deployments.chainId, chainId));

  const rows = db
    .select()
    .from(deployments)
    .where(and(...conds))
    .all();

  for (const d of rows) {
    const arr = byCoin.get(d.coingeckoId) ?? [];
    arr.push({ chainId: d.chainId, address: d.address, decimals: d.decimals });
    byCoin.set(d.coingeckoId, arr);
  }
  return byCoin;
}

export abstract class TokensService {
  /** Filtered, sorted, paginated coin list with deployments attached. */
  static list(params: ListParams): TokensResponse {
    const chainId =
      params.chain !== null ? SLUG_TO_CHAIN_ID[params.chain] ?? null : null;

    const where = TokensService.buildWhere(params, chainId);

    const totalRows = db
      .select({ c: count() })
      .from(coins)
      .innerJoin(markets, eq(coins.coingeckoId, markets.coingeckoId))
      .where(where)
      .all();
    const total = Number(totalRows[0]?.c ?? 0);

    const orderFn = params.order === "asc" ? asc : desc;
    const rows = db
      .select({ coin: coins, market: markets })
      .from(coins)
      .innerJoin(markets, eq(coins.coingeckoId, markets.coingeckoId))
      .where(where)
      .orderBy(orderFn(SORT_COLUMNS[params.sort]))
      .limit(params.perPage)
      .offset((params.page - 1) * params.perPage)
      .all();

    const depsByCoin = loadDeployments(
      rows.map((r) => r.coin.coingeckoId),
      chainId
    );

    const opts: AssembleOpts = {
      include: params.include,
      description: params.include.includes("description"),
      priceChange: params.priceChange,
    };
    const tokens = rows.map((r) =>
      assembleToken(r.coin, r.market, depsByCoin.get(r.coin.coingeckoId) ?? [], opts)
    );

    return {
      name: tokensConfig.name,
      timestamp: Date.now(),
      version: tokensConfig.version,
      vsCurrency: tokensConfig.vsCurrency,
      chain: params.chain,
      include: params.include,
      total,
      page: params.page,
      perPage: params.perPage,
      tokenCount: tokens.length,
      tokens,
    };
  }

  /** Single coin, full record (all blocks, every deployment). Null if absent. */
  static get(coingeckoId: string): Token | null {
    const row = db
      .select({ coin: coins, market: markets })
      .from(coins)
      .innerJoin(markets, eq(coins.coingeckoId, markets.coingeckoId))
      .where(eq(coins.coingeckoId, coingeckoId))
      .get();
    if (!row) return null;

    const deps = db
      .select()
      .from(deployments)
      .where(eq(deployments.coingeckoId, coingeckoId))
      .all()
      .map((d) => ({
        chainId: d.chainId,
        address: d.address,
        decimals: d.decimals,
      }));

    return assembleToken(row.coin, row.market, deps, {
      include: [...tokensConfig.includeBlocks],
      description: true,
      priceChange: [...tokensConfig.priceChangeTimeframes],
    });
  }

  /** Build the WHERE for `list` from the parsed params. */
  private static buildWhere(
    params: ListParams,
    chainId: number | null
  ): SQL | undefined {
    const conds: SQL[] = [];

    if (params.curated) conds.push(eq(coins.umCurated, true));

    if (params.q) {
      // Escape LIKE metacharacters; `!` is the escape char. LIKE is
      // case-insensitive for ASCII in SQLite, so no lower() needed.
      const esc = params.q.replace(/[!%_]/g, (c) => `!${c}`);
      const pattern = `%${esc}%`;
      conds.push(
        sql`(${coins.name} like ${pattern} escape '!' or ${coins.symbol} like ${pattern} escape '!')`
      );
    }

    if (params.symbols) conds.push(inArray(coins.symbol, params.symbols));
    if (params.ids) conds.push(inArray(coins.coingeckoId, params.ids));

    if (params.category) {
      conds.push(
        sql`exists (select 1 from json_each(${coins.categories}) where json_each.value = ${params.category})`
      );
    }

    // Address / chain filters resolve to "coins that have a matching
    // deployment", expressed as a subquery on `deployments`.
    const depConds: SQL[] = [];
    if (chainId !== null) depConds.push(eq(deployments.chainId, chainId));
    if (params.addresses) depConds.push(inArray(deployments.address, params.addresses));
    if (depConds.length > 0) {
      conds.push(
        inArray(
          coins.coingeckoId,
          db
            .select({ id: deployments.coingeckoId })
            .from(deployments)
            .where(and(...depConds))
        )
      );
    }

    return conds.length > 0 ? and(...conds) : undefined;
  }
}
