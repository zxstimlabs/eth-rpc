# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A privacy-preserving [Elysia](https://elysiajs.com) / [Bun](https://bun.sh) backend for a crypto frontend. It exposes a handful of public, browser-callable endpoints (`/rpc`, `/prices`, `/swapagg`, `/tokens`). The cross-cutting design goal: the upstream providers cannot distinguish customers, and the server stores no customer PII and writes no request logs. Honor that posture in any change — see "Privacy posture" below.

> Note: `README.md`'s structure section is stale — it predates the `swapagg` module, describes the old Uniswap-list `/tokens`, and still mentions a standalone `/markets` module that has since been folded into `/tokens`. Trust the code and `docs/tokens-endpoint.md` over the README. The README's "TODO — Billing endpoint" is a design doc for unbuilt work, not current behavior.

## Commands

```bash
bun install                              # install deps
bun run dev                              # watch-reload dev server on :8000
bun run test                             # full test suite
bun run build                            # compile to a standalone binary (../unitmetal-api-build)
```

- **Single test file:** `bun --env-file=.env.local test src/test/rpc.test.ts`
- **By test name:** `bun --env-file=.env.local test -t "strips headers"`
- `bun run test` passes `--env-file=.env.local` explicitly because **`bun test` deliberately ignores `.env.local`**. The dev server and one-off scripts auto-load it, but `bun test` does not — always pass `--env-file=.env.local` when running tests directly.
- `src/test/prices.test.ts` and `swapagg.test.ts` are integration tests that hit **real upstreams** (env-configured RPC / aggregator APIs); they fail if creds are missing or upstream is down.

### Environment

Copy `.env.example` → `.env.local` and fill in all keys. Each module reads its env vars **once at module load and throws if any are missing** (fail-fast at boot, not at first request). A missing key means the whole server refuses to start — this is intentional. Required: `ETHEREUM_RPC_URL`, `ARBITRUM_RPC_URL`, `BASE_RPC_URL`, `COINGECKO_API_KEY`, `KYBERSWAP_CLIENT_ID`, `UNISWAP_API_KEY`, `ZEROX_API_KEY`.

### Database (SQLite via `bun:sqlite` + Drizzle)

- One process-wide WAL-mode handle in `src/lib/db.ts`. DB file defaults to `./data.db`, override with `DATABASE_PATH`.
- **Schemas are colocated per module** at `src/modules/<feature>/schema.ts`; `drizzle.config.ts` globs `src/modules/*/schema.ts`, so a new module's schema is picked up automatically. When you add a schema file, also register it in the `db` handle's `schema` object in `src/lib/db.ts`.
- Dev iteration: `bun drizzle-kit push`. Versioned: `bun drizzle-kit generate` then `bun drizzle-kit migrate`.
- **`drizzle-kit migrate` cannot run inside the compiled binary** (it needs `better-sqlite3`/libsql). For the production binary, apply migrations via the `bun:sqlite`-based runner: `bun --env-file=.env.local run src/script/migrate.ts`.

## Architecture

### Feature-module pattern (controller + service)

Every feature lives in `src/modules/<feature>/`:
- **`index.ts` (controller)** — an Elysia instance owning a route prefix. Mounts `cors` + `rateLimit`, validates input, and delegates to the service. Route handlers are thin.
- **`service.ts` (service)** — an `abstract class` of `static` methods with **no Elysia dependency**, so business logic is unit-testable without an HTTP server.
- **`schema.ts`** (when the feature persists) — Drizzle table.

`src/index.ts` mounts each module with `.use(...)`. **Adding a feature = new folder under `modules/` + one `.use()` call.** It also `await`s `TokensRefresh.refreshMarkets()` before `.listen()` so `/tokens` isn't empty during the ~15 min before the first cron tick (failure there is logged but non-fatal).

### Shared conventions across all modules

Every controller follows the same shape — copy an existing one when adding a module:
- `cors({ origin: true, credentials: false })` registered **before** `rateLimit` (so CORS preflights short-circuit and don't consume rate-limit budget).
- `rateLimit` with `scoping: "scoped"` (confines the limiter to that module — without it the plugin defaults to `"global"` and throttles `/` too), `countFailedRequest: true` (4xx/5xx still spend budget), and a custom `generator` that keys on `hashClientIp(ip)` — never the raw IP.
- **`hashClientIp`** (`src/lib/client-id.ts`) = `sha256(per-process-random-salt || ip)`. The salt lives only in memory and dies with the process, so the rate-limit store holds opaque digests, not IPs. This is shared, not duplicated, on purpose.

### Directory roles

- `src/config/<feature>.ts` — server-side defaults (rate-limit budgets, fee policy, timeouts). **Fee/policy config is applied server-side and never accepted from the client.**
- `src/data/*.json` — static-ish token/market lists imported at module load (parsed once, shared process-wide). Regenerate via `src/script/*`.
- `src/script/*.ts` — one-off generators/runners (`bun run src/script/<name>.ts`): token-list builders, CoinGecko fetchers, the migration runner. Not part of the served app.
- `src/lib/` — cross-module helpers (`db.ts`, `client-id.ts`, `constants.ts`, the swap SDK).
- `src/types/` — shared response types.

### Swap aggregation (`src/lib/swap/`)

`umSwap.getSwap(chain, req)` in `src/lib/swap/um-swap.ts` is the umbrella SDK consumed by the `swapagg` module. It **fans out to KyberSwap, 0x, and Uniswap in parallel via `Promise.allSettled`** — one upstream failing/timing out never sinks the others; the aggregate `status` is `success` / `partial` / `failed`. It lives in `lib/` (not `modules/`) so non-HTTP callers can reuse it. Key facts when touching it:
- Per-aggregator timeout via `AbortSignal.timeout(swapaggConfig.timeoutMs)` (default 2s) — slow quotes are dropped, not awaited, because a stale quote is worse than a missing one.
- Each upstream's response is normalized to the shared `SwapAggRoute` shape; the untouched upstream payload is kept on `route.raw`.
- Add a chain by extending `SUPPORTED_CHAINS` in `um-swap.ts` (maps the slug to each upstream's chain id/slug). Unmapped chains throw.
- **Uniswap runs with `disablePermit2: true`** (legacy direct-approval mode). This is required for a server-side fan-out — we can't sign Permit2 EIP-712 messages for the user. An empty `swap.data` from Uniswap is treated as a failure (Permit2 path); the route is dropped and the frontend falls back to another aggregator.
- Per-aggregator SDKs are in `src/lib/swap/sdks/<name>/`. Fee policy (pinned to `UNITMETAL_TREASURY_ADDRESS`) is in `src/config/swapagg.ts`.

### Module-specific notes

- **`tokens`** — `GET /tokens` serves the top-500 coins by market cap (CoinGecko-sourced), keyed by `coingeckoId`, with on-chain addresses nested as `deployments` (so natives like BTC stay representable). Three SQLite tables joined on `coingeckoId`: `coins` (identity + profile), `markets` (volatile market data), `deployments` (per chain+address). Two `@elysia/cron` jobs in `index.ts` keep it warm — market refresh (~15 min, 2 `/coins/markets` calls) and a daily profile sweep (`/coins/{id}`, stale-first, paced for the demo CoinGecko tier). `?chain=` filters to coins deployed there and projects that chain's address. The read path (`service.ts`) never calls CoinGecko; all upstream logic is in `refresh.ts`. Full design + cadence/budget math in `docs/tokens-endpoint.md`. (Replaced the old Uniswap-list `/tokens` **and** the standalone `/markets` module.)
- **`prices`** — `GET /prices/ethereum` prices every token in the list in one viem `multicall` (`allowFailure: true` → unpriceable tokens come back `null`) against the [CheckTheChain](https://etherscan.io/address/0x0000000000cDC1F8d393415455E382c30FBc0a84) oracle. Nothing is cached server-side. **Gotcha:** native ETH is reported at the zero address but internally priced via WETH (CheckTheChain can't price `0x000…`). The service ships a minimal single-overload `checkPrice(address)` ABI because viem refuses to encode the full ABI's two indistinguishable overloads.
- **`rpc`** — `.all("/{chain}", ...)` proxies JSON-RPC byte-for-byte. `RpcService.proxy` uses a header **allowlist** (new fingerprinting headers are blocked by default) and overwrites `User-Agent` to a fixed value so the upstream can't distinguish customers.

## Privacy posture (do not regress)

- **No request logging.** The only `console.log`/`console.error` calls are the startup line and swallowed cron/cold-start errors. Don't add access logs, request/response body logging, or per-customer APM attributes.
- **No client PII persisted.** No cookies, no IPs in plaintext (rate-limit store holds salted hashes only).
- **Header allowlist, not denylist** for the RPC proxy; fixed outbound `User-Agent`.
- **Reverse-proxy caveat:** rate-limit keys on `server.requestIP()` (direct TCP peer). Behind an LB/CDN every client collapses to one bucket — the fix is to read a trusted `x-forwarded-for` in each module's `generator`, but only once the deployment actually sits behind a trusted proxy.

## Conventions

- TypeScript `strict` is on; no path aliases configured — use relative imports.
- `bunfig.toml` sets `minimumReleaseAge` (3 days) on installs, so brand-new package versions won't resolve immediately.
