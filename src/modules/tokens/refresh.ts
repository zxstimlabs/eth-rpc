/**
 * TokensRefresh
 * -------------
 * The CoinGecko-facing side of the tokens module. Two background jobs, both
 * writing SQLite; the request path never calls CoinGecko.
 *
 *   refreshMarkets()  — pulls the top-N coins by market cap (2 paged calls),
 *                       upserts the `markets` table, seeds `coins` identity,
 *                       and prunes anything that fell out of the top N. Run
 *                       every ~15 min, and once at boot before `.listen()`.
 *   sweepProfiles()   — refreshes the most-stale slice of coin profiles via
 *                       per-coin `/coins/{id}` calls (description, links,
 *                       categories, sentiment, community/developer) and
 *                       rebuilds their `deployments` from `detail_platforms`.
 *                       Run daily; spreads a full sweep over a week.
 *
 * Demo CoinGecko tier is ~10k calls/month. Cadences are sized to fit (see
 * docs/tokens-endpoint.md): market ≈ 5.8k/mo, profile ≈ 2.2k/mo.
 */

import Coingecko from "@coingecko/coingecko-typescript";
import { asc, eq, isNull, notInArray } from "drizzle-orm";
import { db } from "../../lib/db";
import {
  NATIVE_COINS,
  PLATFORM_TO_CHAIN_ID,
  tokensConfig,
  ZERO_ADDRESS,
} from "../../config/tokens";
import {
  coins,
  deployments,
  markets,
  type NewDeploymentRow,
  type NewMarketRow,
} from "./schema";

const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;

if (!COINGECKO_API_KEY) {
  throw new Error("COINGECKO_API_KEY is not set");
}

const coingecko = new Coingecko({
  demoAPIKey: COINGECKO_API_KEY,
  environment: "demo",
});

/**
 * CoinGecko's typed market item omits the per-timeframe `*_in_currency`
 * fields and `sparkline_in_7d` (they only appear when the matching query
 * params are sent). Extend locally so the mapper can read them without `any`.
 */
type CoingeckoMarket =
  Coingecko.Coins.MarketGetResponse.MarketGetResponseItem & {
    price_change_percentage_1h_in_currency?: number | null;
    price_change_percentage_24h_in_currency?: number | null;
    price_change_percentage_7d_in_currency?: number | null;
    sparkline_in_7d?: { price?: number[] } | null;
  };

type CoinDetail = Coingecko.Coins.CoinGetIDResponse;

const HEX_ADDRESS = /^0x[a-fA-F0-9]{40}$/;

// --- mappers ---------------------------------------------------------------

function toMarketRow(m: CoingeckoMarket): NewMarketRow {
  const priceChangePercentage: Record<string, number | null> = {};
  for (const tf of tokensConfig.priceChangeTimeframes) {
    const key = `price_change_percentage_${tf}_in_currency` as keyof CoingeckoMarket;
    priceChangePercentage[tf] = (m[key] as number | null | undefined) ?? null;
  }
  return {
    coingeckoId: m.id as string,
    vsCurrency: tokensConfig.vsCurrency,
    price: m.current_price ?? null,
    marketCap: m.market_cap ?? null,
    marketCapRank: m.market_cap_rank ?? null,
    fullyDilutedValuation: m.fully_diluted_valuation ?? null,
    totalVolume: m.total_volume ?? null,
    high24h: m.high_24h ?? null,
    low24h: m.low_24h ?? null,
    priceChange24h: m.price_change_24h ?? null,
    priceChangePercentage24h:
      m.price_change_percentage_24h_in_currency ??
      m.price_change_percentage_24h ??
      null,
    priceChangePercentage,
    ath: m.ath ?? null,
    athChangePercentage: m.ath_change_percentage ?? null,
    athDate: m.ath_date ?? null,
    atl: m.atl ?? null,
    atlChangePercentage: m.atl_change_percentage ?? null,
    atlDate: m.atl_date ?? null,
    circulatingSupply: m.circulating_supply ?? null,
    totalSupply: m.total_supply ?? null,
    maxSupply: m.max_supply ?? null,
    sparkline7d: m.sparkline_in_7d?.price ?? null,
    lastUpdated: m.last_updated ?? null,
    raw: m as unknown as Record<string, unknown>,
    updatedAt: new Date(),
  };
}

/**
 * Flatten CoinGecko's `links` blob into the frontend-friendly `TokenLinks`.
 *
 * Defensive on purpose: the SDK types several of these as `Array<string>`, but
 * the live API is inconsistent — e.g. `whitepaper` comes back as a bare string.
 * So we accept `unknown` and normalize string-or-array rather than trusting the
 * declared shape (a `.find()` on a string would otherwise crash the sweep).
 */
function normalizeLinks(links: CoinDetail["links"]) {
  const asArray = (v: unknown): string[] =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string" && x.length > 0)
      : [];
  const firstUrl = (v: unknown): string | null => {
    if (typeof v === "string") return v.length > 0 ? v : null;
    if (Array.isArray(v))
      return (
        v.find((x): x is string => typeof x === "string" && x.length > 0) ?? null
      );
    return null;
  };
  const handle = (v?: string | null) => (v && v.length > 0 ? v : null);

  const twitter = handle(links?.twitter_screen_name);
  const telegram = handle(links?.telegram_channel_identifier);
  const chats = asArray(links?.chat_url);

  return {
    homepage: firstUrl(links?.homepage),
    whitepaper: firstUrl(links?.whitepaper),
    twitter: twitter ? `https://x.com/${twitter}` : null,
    telegram: telegram ? `https://t.me/${telegram}` : null,
    discord: chats.find((u) => u.includes("discord")) ?? null,
    reddit: handle(links?.subreddit_url),
    github: asArray(links?.repos_url?.github),
    explorers: asArray(links?.blockchain_site),
  };
}

/**
 * Build the deployment rows for one coin: synthetic native zero-address
 * entries first (CoinGecko doesn't list natives), then `detail_platforms`
 * mapped through the platform→chainId table. Addresses are lowercased and
 * deduped per chain.
 */
function deploymentsForCoin(
  coingeckoId: string,
  coin: CoinDetail
): NewDeploymentRow[] {
  const out: NewDeploymentRow[] = [];
  const seen = new Set<string>();
  const push = (chainId: number, address: string, decimals: number) => {
    const addr = address.toLowerCase();
    const key = `${chainId}:${addr}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ chainId, address: addr, coingeckoId, decimals });
  };

  for (const nc of NATIVE_COINS) {
    if (nc.coingeckoId !== coingeckoId) continue;
    for (const chainId of nc.chainIds) push(chainId, ZERO_ADDRESS, nc.decimals);
  }

  for (const [platform, info] of Object.entries(coin.detail_platforms ?? {})) {
    const chainId = PLATFORM_TO_CHAIN_ID[platform];
    if (!chainId) continue;
    const address = info?.contract_address;
    if (!address || !HEX_ADDRESS.test(address)) continue;
    const decimals = info?.decimal_place;
    if (decimals == null || decimals < 0) continue;
    push(chainId, address, decimals);
  }

  return out;
}

// --- jobs ------------------------------------------------------------------

export abstract class TokensRefresh {
  /**
   * Pull the top-N coins by market cap and upsert market + identity rows.
   * The paged `/coins/markets` call both *defines* the top-N set and carries
   * the market block, so this is the only call needed for the frequent path.
   */
  static async refreshMarkets(): Promise<{ fetched: number; written: number }> {
    const timeframes = tokensConfig.priceChangeTimeframes.join(",");
    const pages = Math.ceil(tokensConfig.topN / 250);

    const items: CoingeckoMarket[] = [];
    for (let page = 1; page <= pages; page++) {
      const batch = (await coingecko.coins.markets.get({
        vs_currency: tokensConfig.vsCurrency,
        order: "market_cap_desc",
        per_page: 250,
        page,
        price_change_percentage: timeframes,
        sparkline: true,
      })) as CoingeckoMarket[];
      items.push(...batch);
      if (batch.length < 250) break;
    }

    const top = items.slice(0, tokensConfig.topN).filter((m) => m.id);
    if (top.length === 0) return { fetched: items.length, written: 0 };
    const topIds = top.map((m) => m.id as string);

    db.transaction((tx) => {
      for (const m of top) {
        const id = m.id as string;
        const marketRow = toMarketRow(m);
        const { coingeckoId: _omit, ...marketSet } = marketRow;
        tx.insert(markets)
          .values(marketRow)
          .onConflictDoUpdate({ target: markets.coingeckoId, set: marketSet })
          .run();

        const symbol = (m.symbol ?? "").toUpperCase();
        const name = m.name ?? id;
        const logoURI = m.image ?? null;
        tx.insert(coins)
          .values({ coingeckoId: id, symbol, name, logoURI })
          .onConflictDoUpdate({
            target: coins.coingeckoId,
            // Identity only — never clobber profile fields here.
            set: { symbol, name, logoURI, updatedAt: new Date() },
          })
          .run();
      }

      // Prune coins that fell out of the top N (and their market/deployment rows).
      tx.delete(markets).where(notInArray(markets.coingeckoId, topIds)).run();
      tx.delete(coins).where(notInArray(coins.coingeckoId, topIds)).run();
      tx.delete(deployments)
        .where(notInArray(deployments.coingeckoId, topIds))
        .run();
    });

    return { fetched: items.length, written: top.length };
  }

  /**
   * Refresh coin profiles (description, links, categories, sentiment,
   * community/developer) and rebuild their `deployments`.
   *
   * By default refreshes the most-stale daily batch (`topN /
   * profileRefreshDays`), ordered oldest-first (never-swept rows sort first
   * since NULL is lowest in SQLite), so a full sweep completes about once per
   * `profileRefreshDays` and naturally resumes after a restart.
   *
   *   - `limit` overrides the batch size. The seed script passes `topN` to
   *     sweep the whole catalog in one pass.
   *   - `onlyNeverSwept` restricts to coins with no profile yet
   *     (`profileUpdatedAt IS NULL`), which makes seeding cheap to re-run:
   *     an interrupted seed resumes without re-fetching what it already has.
   */
  static async sweepProfiles(opts?: {
    limit?: number;
    onlyNeverSwept?: boolean;
  }): Promise<{ swept: number; total: number }> {
    const limit =
      opts?.limit ??
      Math.ceil(tokensConfig.topN / tokensConfig.refresh.profileRefreshDays);
    const rows = db
      .select({ id: coins.coingeckoId })
      .from(coins)
      .where(opts?.onlyNeverSwept ? isNull(coins.profileUpdatedAt) : undefined)
      .orderBy(asc(coins.profileUpdatedAt))
      .limit(limit)
      .all();

    let swept = 0;
    for (const { id } of rows) {
      try {
        const coin = (await coingecko.coins.getID(id, {
          localization: false,
          tickers: false,
          market_data: false,
          community_data: true,
          developer_data: true,
          sparkline: false,
        })) as CoinDetail;

        const deps = deploymentsForCoin(id, coin);
        db.transaction((tx) => {
          tx.update(coins)
            .set({
              description: coin.description?.en?.trim() || null,
              links: normalizeLinks(coin.links),
              categories: (coin.categories ?? []).filter(
                (c): c is string => !!c
              ),
              sentimentUp: coin.sentiment_votes_up_percentage ?? null,
              sentimentDown: coin.sentiment_votes_down_percentage ?? null,
              community:
                (coin.community_data as Record<string, unknown>) ?? null,
              developer:
                (coin.developer_data as Record<string, unknown>) ?? null,
              profileUpdatedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(coins.coingeckoId, id))
            .run();

          tx.delete(deployments)
            .where(eq(deployments.coingeckoId, id))
            .run();
          if (deps.length > 0) tx.insert(deployments).values(deps).run();
        });
        swept++;
      } catch (err) {
        // Don't advance past the batch on one bad coin — it'll be retried
        // next run since its profileUpdatedAt stays old/null.
        console.error(`[tokens] profile sweep failed for ${id}:`, err);
      }
      await Bun.sleep(tokensConfig.refresh.profilePacingMs);
    }

    return { swept, total: rows.length };
  }
}
