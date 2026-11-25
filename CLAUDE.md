# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A privacy-preserving [Elysia](https://elysiajs.com) / [Bun](https://bun.sh) JSON-RPC proxy for a crypto frontend. It exposes public, browser-callable `/rpc/{chain}` endpoints for Ethereum, Arbitrum and Base mainnets plus their Sepolia testnets (`sepolia`, `arbitrum-sepolia`, `base-sepolia`) and nothing else — this service is **RPC-only** (token lists, prices and swap aggregation were removed). The cross-cutting design goal: the upstream providers cannot distinguish customers, and the server stores no customer PII, writes no request logs, and persists nothing to disk. Honor that posture in any change — see "Privacy posture" below.

> The README's "TODO — Billing endpoint" is a design doc for unbuilt work, not current behavior.

## Commands

```bash
bun install                              # install deps
bun run dev                              # watch-reload dev server on :8000
bun run test                             # full test suite
bun run build                            # compile to a standalone binary (./build/zxstim-rpc)
```

- **Single test file:** `bun --env-file=.env.local test src/test/rpc.test.ts`
- **By test name:** `bun --env-file=.env.local test -t "strips headers"`
- `bun run test` passes `--env-file=.env.local` explicitly because **`bun test` deliberately ignores `.env.local`**. The dev server auto-loads it, but `bun test` does not — always pass `--env-file=.env.local` when running tests directly.
- Tests need a disposable **Redis** (`REDIS_URL`) — they reset counters and briefly pause Redis writes, so never point them at a Redis that serves traffic. Run them in Docker with their own Redis: `docker compose -f deploy/compose.test.yaml run --rm --build test` (then `... down`). The user prefers tests run **on the server box**, not this Mac.
- Tests never hit a real upstream (`rpc.test.ts` mocks `globalThis.fetch`), but the RPC module still needs all six `*_RPC_URL` vars set to load. Any values work, but keep them distinct so the per-chain routing test can catch a route wired to the wrong upstream.

### Environment

Copy `.env.example` → `.env.local` and fill in all keys. The rpc module reads its env vars **once at module load and throws if any are missing** (fail-fast at boot, not at first request). A missing key means the whole server refuses to start — this is intentional. Required: `REDIS_URL`, `ETHEREUM_RPC_URL`, `ARBITRUM_RPC_URL`, `BASE_RPC_URL`, `SEPOLIA_RPC_URL`, `ARBITRUM_SEPOLIA_RPC_URL`, `BASE_SEPOLIA_RPC_URL`.

## Architecture

### Feature-module pattern (controller + service)

Every feature lives in `src/modules/<feature>/` (currently only `rpc`):
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
- `src/lib/` — cross-module helpers (`client-id.ts`, `redis.ts`, `redis-rate-limit.ts`).
- `Dockerfile` (deps → test → build → distroless `runtime`), `deploy/compose.yaml` (app + Redis, app on `127.0.0.1:${HOST_PORT:-8001}`), `deploy/compose.test.yaml` (tests + throwaway Redis).

### The `rpc` module

`.all("/{chain}", ...)` proxies JSON-RPC byte-for-byte. `RpcService.proxy` uses a header **allowlist** (new fingerprinting headers are blocked by default) and overwrites `User-Agent` to a fixed value so the upstream can't distinguish customers. It strips `content-encoding` / `content-length` / `transfer-encoding` from the upstream response because Bun's `fetch` has already decompressed the body. To add a chain: add a `requireEnv(...)` line at the top of `src/modules/rpc/index.ts`, a matching `.all()` route, the var in `.env.example`, and a row in the routing `test.each` in `src/test/rpc.test.ts`. One rate-limit budget (`src/config/rpc.ts`) covers all chains.

## Deployment

- `.github/workflows/ci-cd.yml`: push `develop` → GitHub env **develop** → stack `zxstim-rpc-dev` (127.0.0.1:8002); push `main` → env **production** → stack `zxstim-rpc` (127.0.0.1:8001, behind nginx). PRs run tests only. Actions are pinned by commit SHA; keep it that way when bumping.
- Server = Tailscale machine `zxstim-rpc` (Hetzner, Ubuntu 26.04). The runner joins as `tag:ci` via a per-environment Tailscale OIDC credential (GitHub vars `TS_CLIENT_ID`/`TS_AUDIENCE`) and SSHes as `deploy` (the only user tag:ci may use). `deploy/deploy.sh` runs there: swaps `.env.next` → `.env`, pulls, restarts, checks `/health`, rolls back on failure.
- **Public repo ⇒ public workflow logs.** Never echo secrets, `.env` contents, or container logs in the workflow or `deploy.sh`. Secrets go over SSH stdin, never argv.
- Adding an env var the app needs: add it to both GitHub environments, to the `.env` writer step in the workflow, to `.env.example`, and to the test env (`deploy/compose.test.yaml` and the workflow's test job).
- `TRUST_PROXY=1` (set in `deploy/compose.yaml`) makes the rate limiter key on nginx's `X-Real-IP`. It's only safe because the app port is bound to 127.0.0.1. Never publish the app port publicly with it on.

## Privacy posture (do not regress)

- **No request logging.** The only `console.log` is the startup line. Don't add logging to the Redis/rate-limit failure paths either. Don't add access logs, request/response body logging, or per-customer APM attributes.
- **No client PII persisted.** No cookies, no IPs in plaintext (rate-limit store holds salted hashes only). Nothing is written to disk: Redis runs with persistence off and every counter expires with its window.
- **Header allowlist, not denylist** for the RPC proxy; fixed outbound `User-Agent`.
- **Client IP for rate limiting:** `clientIp()` in `src/lib/client-id.ts`. Behind nginx it uses `X-Real-IP` (only with `TRUST_PROXY=1`); otherwise the TCP peer, via the server registered with `setListeningServer()` (sub-apps can't see `app.server`; before this fix every client shared the "" bucket). If a CDN proxy (e.g. Cloudflare orange-cloud) is ever put in front, nginx must restore the real client IP (`real_ip_header`) or everyone collapses into the CDN's IPs.

## Conventions

- TypeScript `strict` is on; no path aliases configured — use relative imports.
- `bunfig.toml` sets `minimumReleaseAge` (7 days) on installs, so brand-new package versions won't resolve immediately, and `exact = true`, so `bun add` saves pinned versions (no `^`/`~`).
