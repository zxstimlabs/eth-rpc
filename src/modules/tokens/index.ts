/**
 * Tokens Module (controller)
 * --------------------------
 * Exposes the public `/tokens` surface: a filterable, paginated list of the
 * top coins by market cap (CoinGecko-sourced) and a single-token detail
 * route. See `docs/tokens-endpoint.md`.
 *
 *   GET /tokens          — list; `?chain=` filters + projects to one chain,
 *                          omit it for the cross-chain leaderboard.
 *   GET /tokens/:id      — one coin by coingeckoId, full record.
 *
 * Two `@elysia/cron` jobs keep SQLite warm (market refresh every ~15 min,
 * profile sweep daily); the request path only reads SQLite. Same privacy
 * posture as the other modules: open CORS, salted-hash client identity, no
 * request logging.
 */

import { Elysia, t } from "elysia";
import { cron } from "@elysia/cron";
import { cors } from "@elysiajs/cors";
import { rateLimit } from "elysia-rate-limit";
import { hashClientIp } from "../../lib/client-id";
import { CHAINS, tokensConfig } from "../../config/tokens";
import { TokensService, type ListParams, type SortKey } from "./service";
import { TokensRefresh } from "./refresh";

const HEX_ADDRESS = /^0x[a-fA-F0-9]{40}$/;

/** Rank/name read best ascending; everything else (cap, volume, %) descending. */
function defaultOrder(sort: SortKey): "asc" | "desc" {
  return sort === "rank" || sort === "name" ? "asc" : "desc";
}

/** Split a csv query value; returns null when absent, dropping blanks. */
function parseCsv(value: string | undefined): string[] | null {
  if (!value) return null;
  const parts = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : null;
}

/** Keep only values present in an allowlist. */
function allow(values: string[] | null, allowed: readonly string[]): string[] {
  return (values ?? []).filter((v) => allowed.includes(v));
}

// --- Query validation ------------------------------------------------------
//
// Tightly-typed where it's cheap (enums, numeric bounds); csv blobs are
// validated as bounded strings here and split/allowlisted in the handler.

const ListQuery = t.Object({
  chain: t.Optional(t.Union(CHAINS.map((c) => t.Literal(c.slug)))),
  include: t.Optional(t.String({ maxLength: 128 })),
  q: t.Optional(t.String({ maxLength: 64 })),
  addresses: t.Optional(t.String({ maxLength: 4096 })),
  symbols: t.Optional(t.String({ maxLength: 1024 })),
  ids: t.Optional(t.String({ maxLength: 4096 })),
  category: t.Optional(t.String({ maxLength: 64 })),
  curated: t.Optional(t.Boolean()),
  sort: t.Optional(t.Union(tokensConfig.sortKeys.map((k) => t.Literal(k)))),
  order: t.Optional(t.Union([t.Literal("asc"), t.Literal("desc")])),
  page: t.Optional(t.Numeric({ minimum: 1 })),
  perPage: t.Optional(t.Numeric({ minimum: 1, maximum: tokensConfig.maxPerPage })),
  priceChange: t.Optional(t.String({ maxLength: 64 })),
  // Accepted for forward-compat; only `usd` is honored today.
  vs: t.Optional(t.String({ maxLength: 16 })),
});

// --- Controller ------------------------------------------------------------

export const tokens = new Elysia({ prefix: "/tokens" })
  .use(cors({ origin: true, credentials: false }))
  .use(
    rateLimit({
      max: tokensConfig.rateLimit.max,
      duration: tokensConfig.rateLimit.durationMs,
      scoping: "scoped",
      countFailedRequest: true,
      generator: (request, server) => {
        const ip = server?.requestIP(request)?.address;
        return ip ? hashClientIp(ip) : "";
      },
    })
  )
  .use(
    cron({
      name: "tokens-market-refresh",
      pattern: tokensConfig.refresh.marketPattern,
      run: async () => {
        try {
          await TokensRefresh.refreshMarkets();
        } catch (err) {
          console.error("[tokens] market refresh failed:", err);
        }
      },
    })
  )
  .use(
    cron({
      name: "tokens-profile-sweep",
      pattern: tokensConfig.refresh.profilePattern,
      run: async () => {
        try {
          await TokensRefresh.sweepProfiles();
        } catch (err) {
          console.error("[tokens] profile sweep failed:", err);
        }
      },
    })
  )
  // GET /tokens — filterable, paginated list. Market data is joined in by
  // default; `description`/`sparkline`/`community`/`developer` are opt-in via
  // `include`. Reads SQLite only.
  .get(
    "/",
    ({ query }) => {
      const sort: SortKey = query.sort ?? "marketCap";
      // Keep only well-formed addresses; an empty result means "no constraint".
      const validAddresses = (parseCsv(query.addresses) ?? [])
        .map((a) => a.toLowerCase())
        .filter((a) => HEX_ADDRESS.test(a));
      const symbols = (parseCsv(query.symbols) ?? []).map((s) =>
        s.toUpperCase()
      );
      const ids = parseCsv(query.ids) ?? [];
      const priceChange = allow(
        parseCsv(query.priceChange),
        tokensConfig.priceChangeTimeframes
      );

      const params: ListParams = {
        chain: query.chain ?? null,
        include: allow(parseCsv(query.include), tokensConfig.includeBlocks),
        q: query.q ?? null,
        addresses: validAddresses.length > 0 ? validAddresses : null,
        symbols: symbols.length > 0 ? symbols : null,
        ids: ids.length > 0 ? ids : null,
        category: query.category ?? null,
        curated: query.curated ?? false,
        sort,
        order: query.order ?? defaultOrder(sort),
        page: query.page ? Math.floor(query.page) : 1,
        perPage: query.perPage
          ? Math.floor(query.perPage)
          : tokensConfig.defaultPerPage,
        priceChange: priceChange.length > 0 ? priceChange : ["24h"],
      };

      return TokensService.list(params);
    },
    { query: ListQuery }
  )
  // GET /tokens/list/:chain — the fixed, curated token list for one chain
  // (identity + decimals), served straight from src/data/tokens.ts. This is
  // the static "supported tokens" set the frontend pairs with RPC balances
  // and `/tokens` prices; it never touches the catalog DB. Returns a Uniswap
  // token-list envelope (name/timestamp/version/tags) wrapping the
  // `UmCuratedToken[]` under `tokens`.
  .get("/list/:chain", ({ params }) => TokensService.curatedList(params.chain), {
    params: t.Object({
      chain: t.Union(CHAINS.map((c) => t.Literal(c.slug))),
    }),
  })
  // GET /tokens/:id — single coin by coingeckoId, full record.
  .get(
    "/:id",
    ({ params, set }) => {
      const token = TokensService.get(params.id);
      if (!token) {
        set.status = 404;
        return { error: `token "${params.id}" not found` };
      }
      return token;
    },
    {
      params: t.Object({
        // CoinGecko ids are lowercase alphanumeric + hyphens.
        id: t.String({ pattern: "^[a-z0-9][a-z0-9-]{0,79}$" }),
      }),
    }
  );
