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
- Tests never hit a real upstream (`rpc.test.ts` mocks `globalThis.fetch`), but the RPC module still needs all six `*_RPC_URL` vars set to load. Any values work, but keep them distinct so the per-chain routing test can catch a route wired to the wrong upstream.

### Environment

Copy `.env.example` → `.env.local` and fill in all keys. The rpc module reads its env vars **once at module load and throws if any are missing** (fail-fast at boot, not at first request). A missing key means the whole server refuses to start — this is intentional. Required: `ETHEREUM_RPC_URL`, `ARBITRUM_RPC_URL`, `BASE_RPC_URL`, `SEPOLIA_RPC_URL`, `ARBITRUM_SEPOLIA_RPC_URL`, `BASE_SEPOLIA_RPC_URL`.

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
- **`hashClientIp`** (`src/lib/client-id.ts`) = `sha256(per-process-random-salt || ip)`. The salt lives only in memory and dies with the process, so the rate-limit store holds opaque digests, not IPs. Shared in `lib/` so any future module reuses it rather than duplicating it.

### Directory roles

- `src/config/<feature>.ts` — server-side defaults (rate-limit budgets, timeouts). **Applied server-side and never accepted from the client.**
- `src/lib/` — cross-module helpers (`client-id.ts`).

### The `rpc` module

`.all("/{chain}", ...)` proxies JSON-RPC byte-for-byte. `RpcService.proxy` uses a header **allowlist** (new fingerprinting headers are blocked by default) and overwrites `User-Agent` to a fixed value so the upstream can't distinguish customers. It strips `content-encoding` / `content-length` / `transfer-encoding` from the upstream response because Bun's `fetch` has already decompressed the body. To add a chain: add a `requireEnv(...)` line at the top of `src/modules/rpc/index.ts`, a matching `.all()` route, the var in `.env.example`, and a row in the routing `test.each` in `src/test/rpc.test.ts`. One rate-limit budget (`src/config/rpc.ts`) covers all chains.

## Privacy posture (do not regress)

- **No request logging.** The only `console.log` is the startup line. Don't add access logs, request/response body logging, or per-customer APM attributes.
- **No client PII persisted.** No cookies, no IPs in plaintext (rate-limit store holds salted hashes only). The server currently writes nothing to disk at all.
- **Header allowlist, not denylist** for the RPC proxy; fixed outbound `User-Agent`.
- **Reverse-proxy caveat:** rate-limit keys on `server.requestIP()` (direct TCP peer). Behind an LB/CDN every client collapses to one bucket — the fix is to read a trusted `x-forwarded-for` in the module's `generator`, but only once the deployment actually sits behind a trusted proxy.

## Conventions

- TypeScript `strict` is on; no path aliases configured — use relative imports.
- `bunfig.toml` sets `minimumReleaseAge` (7 days) on installs, so brand-new package versions won't resolve immediately, and `exact = true`, so `bun add` saves pinned versions (no `^`/`~`).
