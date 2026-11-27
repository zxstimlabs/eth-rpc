# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A privacy-preserving [Elysia](https://elysiajs.com) / [Bun](https://bun.sh) JSON-RPC proxy for a crypto frontend. It exposes public, browser-callable `/rpc/{chain}` endpoints for Ethereum, Arbitrum and Base mainnets plus their Sepolia testnets (`sepolia`, `arbitrum-sepolia`, `base-sepolia`) and nothing else — this service is **RPC-only** (token lists, prices and swap aggregation were removed). Each chain also has a billed form, `/rpc/{chain}/{api-key}`, that spends prepaid credits (Mullvad-style accounts; see README "Billing"). The cross-cutting design goal: the upstream providers cannot distinguish customers, and the server stores no customer PII, writes no request logs, and keeps only billing state (digests and numbers) at rest. Honor that posture in any change — see "Privacy posture" below.

> Billing status: accounts, keys, claims and the lease engine are built; the payment indexer (reads `Paid` events from zxstimlabs/rpc-pay-contracts into `payments`) is not yet — it needs the deployed contract addresses.

## Commands

```bash
bun install                              # install deps
bun run dev                              # watch-reload dev server on :8000
bun run test                             # full test suite
bun run build                            # compile to a standalone binary (./build/zxstim-rpc)
bun run db:generate                      # schema change → new SQL migration in ./drizzle (commit it)
```

- **Single test file:** `bun --env-file=.env.local test src/test/rpc.test.ts`
- **By test name:** `bun --env-file=.env.local test -t "strips headers"`
- `bun run test` passes `--env-file=.env.local` explicitly because **`bun test` deliberately ignores `.env.local`**. The dev server auto-loads it, but `bun test` does not — always pass `--env-file=.env.local` when running tests directly.
- Tests need a disposable **Redis** (`REDIS_URL`) and **Postgres** (`DATABASE_URL`) — they reset counters, briefly pause Redis writes and write accounts/payments, so never point them at ones that serve traffic. Run them in Docker with their own: `docker compose -f deploy/compose.test.yaml run --rm --build test` (then `... down -v`). The user prefers tests run **on the server box**, not this Mac: copy the tree with `git ls-files -co --exclude-standard | grep -v '^\.env' | COPYFILE_DISABLE=1 tar --no-mac-metadata --no-xattrs -czf - -T - | tailscale ssh root@zxstim-rpc '…tar -xzf - -C /root/rpc-test…'` (without `COPYFILE_DISABLE`/`--no-mac-metadata`, macOS adds `._*` files that bun tries to run as tests).
- Tests never hit a real upstream (`rpc.test.ts` mocks `globalThis.fetch`), but the RPC module still needs all six `*_RPC_URL` vars set to load. Any values work, but keep them distinct so the per-chain routing test can catch a route wired to the wrong upstream.

### Environment

Copy `.env.example` → `.env.local` and fill in all keys. Env vars are read **once at module load and throw if any are missing** (fail-fast at boot, not at first request); the server also refuses to start without Redis, Postgres, or if migrations fail. This is intentional. Required: `REDIS_URL`, `DATABASE_URL`, `ETHEREUM_RPC_URL`, `ARBITRUM_RPC_URL`, `BASE_RPC_URL`, `SEPOLIA_RPC_URL`, `ARBITRUM_SEPOLIA_RPC_URL`, `BASE_SEPOLIA_RPC_URL`.

## Architecture

### Feature-module pattern (controller + service)

Every feature lives in `src/modules/<feature>/` (currently `rpc` and `account`):
- **`index.ts` (controller)** — an Elysia instance owning a route prefix. Mounts `cors` + `rateLimit`, validates input, and delegates to the service. Route handlers are thin.
- **`service.ts` (service)** — an `abstract class` of `static` methods with **no Elysia dependency**, so business logic is unit-testable without an HTTP server.

`src/index.ts` mounts each module with `.use(...)`. **Adding a feature = new folder under `modules/` + one `.use()` call.**

### Controller conventions

Copy `src/modules/rpc/index.ts` when adding a module:
- `cors({ origin: true, credentials: false })` registered **before** `rateLimit` (so CORS preflights short-circuit and don't consume rate-limit budget).
- `rateLimit` with `scoping: "scoped"` (confines the limiter to that module — without it the plugin defaults to `"global"` and throttles `/` too), `countFailedRequest: true` (4xx/5xx still spend budget), and a custom `generator` that keys on `hashClientIp(ip)` — never the raw IP.
- **`hashClientIp`** (`src/lib/client-id.ts`) = `sha256(per-process-random-salt || ip)`. The salt lives only in memory and dies with the process, so the rate-limit store (Redis) holds opaque digests, not IPs.
- **Rate-limit counts live in Redis** via `RedisRateLimitContext` (`src/lib/redis-rate-limit.ts`, implements the plugin's `context` interface; one atomic Lua `EVAL` per request; fixed window). It **fails closed**: Redis down/slow/erroring → `RateLimiterUnavailableError` → the controller's `.onError` returns **503** + `Retry-After` (via `set`, so CORS headers survive). The shared client (`src/lib/redis.ts`) has `enableOfflineQueue: false` so an outage fails fast instead of hanging requests. `src/index.ts` awaits `connectRedis()` before `.listen()`; `GET /health` is 200 only while Redis answers PING. Shared in `lib/` so any future module reuses it rather than duplicating it.

### Directory roles

- `src/config/<feature>.ts` — server-side defaults (rate-limit budgets, timeouts). **Applied server-side and never accepted from the client.**
- `src/lib/` — cross-module helpers (`client-id.ts`, `redis.ts`, `redis-rate-limit.ts`, `keccak.ts`, `billing/`).
- `src/db/` — Drizzle schema + Bun SQL client (`drizzle-orm/bun-sql`, no extra Postgres package). Migrations in `drizzle/` are generated (`bun run db:generate`), committed, copied into the image and applied at startup by `migrateDb()`. Migrations only move forward and a rollback runs the previous image against the new schema, so keep schema changes backward-compatible.
- `Dockerfile` (deps → test → build → distroless `runtime` with `drizzle/`), `deploy/compose.yaml` (app + Redis 8.12 + Postgres 19, app on `127.0.0.1:${HOST_PORT:-8001}`), `deploy/compose.test.yaml` (tests + throwaway Redis and Postgres).

### Billing (`src/lib/billing/`, `src/modules/account/`)

- **Accounts are Mullvad-style**: an account id is `keccak256("zxstim-rpc/account/v1" ‖ secret)`; API keys are stored as `keccak256(key)`; payments carry `memo = keccak256(payment_secret)`. All derived by the wallet; the server stores only digests (`src/lib/keccak.ts` — Ethereum Keccak, not NIST SHA3). Test vectors are shared with `deploy/smoke-test.sh` and zxstimlabs/rpc-pay-contracts; don't change them on one side only.
- **Leases** (`leases.ts`, the hot path): every credit is in exactly one place — Postgres `accounts.balance` or a Redis lease. A billed request is one Redis script; refills move ≤1,000 credits under a per-account lock (Postgres `balance -= take, leased += take`, then Redis). Redis restarts are handled by the `epoch` key: a dead epoch's `leased` is refunded in full on the next refill. Don't turn this into a cache in front of Postgres, and never add a per-request Postgres write.
- **Claims** (`claims.ts`): one transaction marks unclaimed `payments` with the memo claimed and credits the account. `payments` deliberately has **no account column** — keep it that way.
- Billed route: 1 credit per JSON-RPC call (batches count each), refund on upstream 5xx/429/unreachable, 402 out of credits, `debug_*`/`trace_*` blocked, batches ≤100. Its rate limit is per IP (not per key), so random keys can't mint fresh buckets.

### The `rpc` module

`.all("/:chain", ...)` (keyless) and `.all("/:chain/:key", ...)` (billed, separate `rpcKeyed` instance with its own limiter) proxy JSON-RPC byte-for-byte; both look the chain up in the `UPSTREAMS` map. `RpcService.proxy` uses a header **allowlist** (new fingerprinting headers are blocked by default) and overwrites `User-Agent` to a fixed value so the upstream can't distinguish customers. It strips `content-encoding` / `content-length` / `transfer-encoding` from the upstream response because Bun's `fetch` has already decompressed the body. To add a chain: add a `[path, requireEnv(...)]` entry to `UPSTREAMS` in `src/modules/rpc/index.ts`, the var in `.env.example`, the GitHub environments and test env (see Deployment), and a row in the routing `test.each` in `src/test/rpc.test.ts`. One rate-limit budget (`src/config/rpc.ts`) covers all chains.

## Deployment

- `.github/workflows/ci-cd.yml`: push `develop` → GitHub env **develop** → stack `zxstim-rpc-dev` (127.0.0.1:8002) → `deploy/smoke-test.sh` on the server → **torn down** (containers, Redis, `.env`). develop is throwaway: the user tests there instead of on their laptop; push `main` → env **production** → stack `zxstim-rpc` (127.0.0.1:8001, behind nginx). PRs run tests only. Actions are pinned by commit SHA; keep it that way when bumping.
- Server = Tailscale machine `zxstim-rpc` (Hetzner, Ubuntu 26.04). The runner joins as `tag:ci` via a per-environment Tailscale OIDC credential (GitHub vars `TS_CLIENT_ID`/`TS_AUDIENCE`) and SSHes as `deploy` (the only user tag:ci may use). `deploy/deploy.sh` runs there: swaps `.env.next` → `.env`, pulls, restarts, checks `/health`, rolls back on failure.
- `deploy/smoke-test.sh` stops Redis on purpose, writes a test account and payment, and refuses any stack not ending in `-dev`. Never run it against production.
- The stack's Postgres password is generated on the server by `deploy.sh` into `/opt/<stack>/db.env` (mode 600, never leaves the box, not in GitHub). Never delete production's `db.env`: its data volume was initialised with that password. develop's teardown removes it with the volume. Postgres backups (encrypted, off-box) are still to be set up.
- **Public repo ⇒ public workflow logs.** Never echo secrets, `.env` contents, or container logs in the workflow or `deploy.sh`. Secrets go over SSH stdin, never argv.
- Adding an env var the app needs: add it to both GitHub environments, to the `.env` writer step in the workflow, to `.env.example`, and to the test env (`deploy/compose.test.yaml` and the workflow's test job).
- `TRUST_PROXY=1` (set in `deploy/compose.yaml`) makes the rate limiter key on nginx's `X-Real-IP`. It's only safe because the app port is bound to 127.0.0.1. Never publish the app port publicly with it on.

## Privacy posture (do not regress)

- **No request logging.** The only `console.log` is the startup line (the smoke test checks the app log is exactly that one line). Don't add logging to the Redis/rate-limit/billing failure paths either. Don't add access logs, request/response body logging, or per-customer APM attributes. Postgres runs with `log_min_error_statement=panic` and `client_min_messages=warning`; keep query text and NOTICEs out of logs.
- **No client PII persisted.** No cookies, no IPs in plaintext (rate-limit store holds salted hashes only). Redis runs with persistence off. The only data at rest is billing state in Postgres: account ids, key hashes, balances, on-chain payments — no IPs, no timestamps, no request records, no wallet addresses, nothing linking a payment to an account. Don't add `created_at`/`last_used` columns or usage history.
- **Header allowlist, not denylist** for the RPC proxy; fixed outbound `User-Agent`.
- **Client IP for rate limiting:** `clientIp()` in `src/lib/client-id.ts`. Behind nginx it uses `X-Real-IP` (only with `TRUST_PROXY=1`); otherwise the TCP peer, via the server registered with `setListeningServer()` (sub-apps can't see `app.server`; before this fix every client shared the "" bucket). If a CDN proxy (e.g. Cloudflare orange-cloud) is ever put in front, nginx must restore the real client IP (`real_ip_header`) or everyone collapses into the CDN's IPs.

## Conventions

- TypeScript `strict` is on; no path aliases configured — use relative imports.
- `bunfig.toml` sets `minimumReleaseAge` (7 days) on installs, so brand-new package versions won't resolve immediately, and `exact = true`, so `bun add` saves pinned versions (no `^`/`~`).
