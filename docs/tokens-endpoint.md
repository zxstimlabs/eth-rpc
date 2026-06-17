# Tokens endpoint — design spec

Status: **approved, not yet implemented.** This is the agreed design for a
rebuilt `/tokens` endpoint. Code has not been written.

## Goal

One endpoint, `/tokens`, that serves the **top 500 coins by market cap**
(CoinGecko-sourced) with everything a frontend needs: identity, on-chain
deployments, market data, and profile (description / links / categories).
It powers two surfaces from one catalog:

- **Home page** — the top-500 market-cap leaderboard, paginated 100×5.
- **App (swap / token picker)** — the supported "quality token" set, filtered
  to a chain so the frontend gets the contract address + decimals it needs to
  swap.

The data sourcing keeps the same posture as the rest of the app: CoinGecko is
touched **only by background jobs**, never on the request path; `/tokens` reads
from SQLite. Open CORS, salted-hash client identity in the rate limiter, no
request logging.

## What this replaces

All of the following are **removed** and superseded by `/tokens`:

- The current `/tokens/{chain}` routes that serve the Uniswap Labs token list.
- The `markets` module's **`GET /markets`** endpoint.
- The `markets` module's **5-minute refresh cron**.

The per-coin market **storage** (the existing `markets` table) is **kept and
reused** — it becomes one of the tables behind `/tokens`. The data files
`src/data/*-token-list.json` and the Uniswap list are no longer needed to build
the curated 500 (CoinGecko alone covers it — see Sourcing).

## Data model

Top-500-by-market-cap is a **coin leaderboard**: it includes assets with no
contract on our chains (BTC, XRP, BNB, TRX, …). So the catalog is keyed by
**`coingeckoId`**, not by `(chainId, address)`. On-chain addresses are a nested
**`deployments[]`** list (empty for native L1s).

Per the agreed split, the **descriptive record (identity + profile) is merged**
into one table; **market data stays separate** (volatile, refreshed far more
often). Three tables, all joined on `coingeckoId`:

| Table | PK | Holds | Refreshed |
|---|---|---|---|
| `coins` | `coingeckoId` | identity + profile: `symbol`, `name`, `logoURI`, `umCurated`, `description`, `links`, `categories`, `sentiment`, `community`, `developer` | daily sweep (stale-first) |
| `markets` | `coingeckoId` | volatile market: `price`, `marketCapRank`, `marketCap`, `fullyDilutedValuation`, `totalVolume`, `high24h`/`low24h`, `priceChange*`, `ath*`/`atl*`, `*Supply`, `lastUpdated`, `raw` | every ~15–20 min |
| `deployments` | `(chainId, address)` | `coingeckoId`, `decimals` (index on `coingeckoId`, `chainId`) | daily sweep (from `detail_platforms`) |

Notes:
- `markets` is the **existing table**, reused. Descriptive columns currently on
  it (`symbol`, `name`, `image`) move to `coins`; it keeps only volatile market
  fields. `coinId` → `coingeckoId` (same value, clearer name).
- `marketCapRank` lives in `markets` (it's volatile) and drives the default sort.
- `deployments` being relational (not a JSON column on `coins`) is deliberate:
  `?chain=ethereum` filtering is then a clean `JOIN … WHERE chainId = 1`.
- Native coins (e.g. `ethereum` on chain 1) get a synthetic deployment
  `{ chainId: 1, address: 0x000…0, decimals: 18 }` from a small static
  native-coin map, matching the `/prices` zero-address convention.

## CoinGecko sourcing & refresh jobs

Demo tier: **~10,000 calls/month (~333/day)**. Two cron jobs, both under the
tokens module, both writing SQLite:

**1. Market refresh — every ~15–20 min (2 calls/tick).**
`GET /coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1..2&price_change_percentage=1h,24h,7d`
- Returns the current top 500 with `id`, `image`, `symbol`, `name`, rank, and
  the full market block in **2 calls**. This call *defines* the top-500 set.
- Upserts `markets`. Seeds `coins` with basic identity (`coingeckoId`, `symbol`,
  `name`, `logoURI`) for any new entrant so it's serveable before the profile
  sweep enriches it.
- Coins that drop out of the top 500 are pruned (or flagged) so the catalog
  stays bounded at ~500.

**2. Profile sweep — daily, most-stale batch (`ceil(topN / profileRefreshDays)` ≈ 72 coins/day).**
`GET /coins/{id}` per coin, ordered oldest-`profileUpdatedAt`-first (NULL sorts
first, so never-swept coins go first), so a full pass completes about once per
`profileRefreshDays` (7) and resumes cleanly after a restart →
- Upserts `coins`: `description.en`, `links` (normalized — see below),
  `categories`, `sentiment_votes_up/down_percentage`, `community`/`developer`.
- Upserts `deployments` from **`detail_platforms`** — this carries both the
  contract `address` *and* `decimal_place` per chain, so decimals come free.
  Asset-platform slugs map to chainIds: `ethereum`→1, `arbitrum-one`→42161,
  `base`→8453. (If `decimal_place` is ever missing, fall back to an on-chain
  `decimals()` multicall.)
- Native coins (e.g. ETH) get a synthetic zero-address deployment injected —
  CoinGecko doesn't list natives.

**First-run seeding.** A fresh DB would otherwise take ~7 days of daily batches
to fully populate `deployments`/profiles. `bun --env-file=.env.local run
src/script/seed-tokens.ts` does a market refresh + a FULL profile sweep (all
`topN`, ~17 min) in one pass so a new deploy is complete immediately. It sweeps
only never-profiled coins by default (cheap to re-run / resumable after an
interrupt); `--force` re-fetches everything. The daily cron maintains it after.

Budget: ~5.8k/mo (market @ 15 min) + ~2.2k/mo (profile @ ~72/day) ≈ **8k of 10k**.
There is **no `/key` budget guard** — that endpoint is PRO-only (401 on the demo
tier) — so the cadences themselves are the only budget mechanism. **Cold start**:
`src/index.ts` awaits one market refresh before `.listen()`, so `/tokens` isn't
empty on boot; deployments/profiles arrive via the seed script or the daily cron.

`links` normalization (CoinGecko's blob → flat, frontend-friendly):
`homepage[0]` → `homepage`, `twitter_screen_name` → full `twitter` URL,
`telegram_channel_identifier` → `telegram` URL, `subreddit_url` → `reddit`,
`repos_url.github` → `github[]`, `blockchain_site` → `explorers[]`,
`whitepaper` passthrough, `chat_url` → `discord` when it's a discord link.
Normalization is defensive (string-or-array): the SDK types some fields as
`Array<string>`, but the live API returns e.g. `whitepaper` as a bare string,
so each field is coerced rather than trusted (a `.find()` on a string would
otherwise crash the sweep).

## Wire schema

```ts
// Keyed by coingeckoId. Identity + profile merged; market is separate/optional.
type Token = {
  coingeckoId: string;
  name: string;
  symbol: string;
  logoURI: string;
  marketCapRank: number | null;
  umCurated: boolean;

  // profile (merged in; `description` is opt-in on the list — see params)
  description: string | null;
  links: {
    homepage: string | null;
    whitepaper: string | null;
    twitter: string | null;
    telegram: string | null;
    discord: string | null;
    reddit: string | null;
    github: string[];
    explorers: string[];
  };
  categories: string[];
  sentiment: { upPercentage: number; downPercentage: number } | null;

  // where it's swappable; empty for native L1s with no contract on our chains.
  // When ?chain is set, this is filtered to that one chain.
  deployments: Array<{ chainId: number; address: string; decimals: number }>;

  // market — default-on for the list; omit with include filtering if not wanted
  market?: TokenMarket;
};

type TokenMarket = {
  vsCurrency: string;                 // "usd"
  price: number | null;
  marketCap: number | null;
  marketCapRank: number | null;
  fullyDilutedValuation: number | null;
  totalVolume: number | null;
  high24h: number | null;
  low24h: number | null;
  priceChange24h: number | null;
  priceChangePercentage: Record<string, number | null>; // "1h","24h","7d",…
  ath: number | null;
  athChangePercentage: number | null;
  athDate: string | null;
  atl: number | null;
  atlChangePercentage: number | null;
  atlDate: string | null;
  circulatingSupply: number | null;
  totalSupply: number | null;
  maxSupply: number | null;
  sparkline7d?: number[];             // only when include=sparkline
  lastUpdated: string | null;         // upstream sample time
};

type TokensResponse = {
  name: string;
  timestamp: number;                  // ms; when the API assembled the response
  version: string;
  vsCurrency: string;
  chain: string | null;               // echoed filter (null = all chains)
  include: string[];
  total: number;                      // total matching (≤ 500)
  page: number;
  perPage: number;
  tokenCount: number;                 // in this page
  tokens: Token[];
};
```

## Endpoints & query params

### `GET /tokens` (list — the workhorse)

| Param | Values | Default | Notes |
|---|---|---|---|
| `chain` | `ethereum` \| `arbitrum` \| `base` | — (all chains) | Filters to coins deployed there **and** projects that chain's `address`+`decimals` into `deployments`. Omit for the leaderboard. |
| `include` | csv: `description,sparkline,community,developer` | — | `market` is included by default; these are the extra/heavy blocks. |
| `q` | string | — | Search `name`/`symbol`. |
| `addresses` | csv of EVM addresses | — | Filter to a set (chain-scoped if `chain` set, else any chain). |
| `symbols` | csv | — | |
| `ids` | csv of coingeckoIds | — | |
| `category` | string | — | Filter on `categories`. |
| `curated` | bool | — | Only `umCurated`. |
| `sort` | `marketCap` \| `rank` \| `volume` \| `priceChange24h` \| `name` | `marketCap` | |
| `order` | `asc` \| `desc` | `desc` | |
| `page` | int ≥ 1 | 1 | Home page uses 1..5. |
| `perPage` | int 1–250 | 100 | |
| `priceChange` | csv: `1h,24h,7d,…` | `24h` | Which `priceChangePercentage` timeframes to include. |
| `vs` | currency | `usd` | Accepted; only `usd` honored for now (see Future). |

### `GET /tokens/{coingeckoId}` (detail)

Single coin, **full record** including `description` and all deployments across
chains. For an address-based lookup, use `GET /tokens?chain=…&addresses=0x…`
(returns a one-element list).

## Behavior details

- **Chain projection.** With `?chain=X`, only coins with a deployment on X are
  returned and `deployments` is narrowed to that chain. Without `chain`, all 500
  are returned with every deployment listed.
- **Validation.** Strict, anchored allowlists like the swapagg module: EVM
  address regex, chain enum, bounded `perPage`, enum `sort`/`order`. Unknown
  chain → empty result (consistent with "any chain is callable"), not a 500.
- **Privacy / caching.** Reads from SQLite only; no upstream on the request
  path. Same rate-limit + salted-IP-hash generator as the other modules.
- **Freshness.** `timestamp` is per-response; `market.lastUpdated` reflects the
  CoinGecko sample time carried through the refresh.

## Future (explicitly out of scope now)

- **Multi-currency.** Store USD canonical; add an FX layer that converts at read
  time against cron-cached FX rates (`vs` becomes truly multi-currency). No
  per-currency storage.
- **Long-tail tokens.** Coins outside the top 500, or DEX-only tokens with no
  `coingeckoId`, could be served via the onchain/GeckoTerminal endpoints
  (`/onchain/networks/{network}/tokens/{address}`) as a fallback tier.
- **More sources.** Any new source attaches by `coingeckoId` (or by
  `(chainId,address)` for the deployment table) and merges at read time.
