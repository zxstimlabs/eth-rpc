# zxstim-rpc

An [Elysia](https://elysiajs.com) / [Bun](https://bun.sh) backend that exposes privacy-preserving, browser-callable JSON-RPC proxies for a crypto frontend:

| Chain            | Path                    | Env var                    |
| ---------------- | ----------------------- | -------------------------- |
| Ethereum         | `/rpc/ethereum`         | `ETHEREUM_RPC_URL`         |
| Arbitrum One     | `/rpc/arbitrum`         | `ARBITRUM_RPC_URL`         |
| Base             | `/rpc/base`             | `BASE_RPC_URL`             |
| Sepolia          | `/rpc/sepolia`          | `SEPOLIA_RPC_URL`          |
| Arbitrum Sepolia | `/rpc/arbitrum-sepolia` | `ARBITRUM_SEPOLIA_RPC_URL` |
| Base Sepolia     | `/rpc/base-sepolia`     | `BASE_SEPOLIA_RPC_URL`     |

Every endpoint is designed to be called directly from a browser: open CORS, per-client rate limiting, zero request logging, and no client data at rest. Each path also has a **billed** form, `/rpc/{chain}/{api-key}`, that spends prepaid credits (see [Billing](#billing-prepaid-credits)).

## Getting Started

```bash
bun install
cp .env.example .env.local   # then fill in REDIS_URL, DATABASE_URL and all six *_RPC_URL values
bun run dev
```

Open http://localhost:8000/ with your browser to see the result.

Every variable in `.env.example` is required — the server reads them once at load and refuses to start if any is missing, if Redis or Postgres is unreachable, or if its migrations fail.

## Scripts

| Command               | What it does                                                        |
| --------------------- | ------------------------------------------------------------------- |
| `bun run dev`         | Start the dev server on `:8000` with file-watch reload.             |
| `bun run test`        | Run the Bun test suite (`src/test/**/*.test.ts`).                   |
| `bun run build`       | Compile a standalone binary to `./build/zxstim-rpc`.                |
| `bun run db:generate` | Generate a SQL migration in `./drizzle` from `src/db/schema.ts`.    |

`bun run test` loads `.env.local` explicitly via `--env-file`, because `bun test` deliberately ignores `.env.local` by default.

## Project Structure

```
src/
├── index.ts              # Root app — connects Redis, migrates Postgres, mounts modules, /health, :8000
├── config/
│   ├── rpc.ts            # Rate-limit budgets (keyless and billed). Never client-supplied.
│   └── billing.ts        # Lease sizes, key limits, batch cap, blocked methods
├── db/
│   ├── schema.ts         # Drizzle schema: accounts, api_keys, payments, indexer_state
│   └── index.ts          # Bun SQL client + Drizzle, migrateDb(), dbHealthy()
├── lib/
│   ├── client-id.ts      # Salted SHA-256 hash of client IP (rate-limit key)
│   ├── keccak.ts         # Ethereum keccak256: account ids, key hashes, payment memos
│   ├── redis.ts          # Shared Redis client
│   ├── redis-rate-limit.ts
│   └── billing/          # Leases (hot path), accounts/keys, claims, call counting
├── modules/
│   ├── rpc/              # JSON-RPC proxy: keyless and billed routes (controller + service)
│   └── account/          # /v1 key registration, balance, claims (controller + service)
└── test/
drizzle/                  # Generated SQL migrations (committed), applied at startup
```

### Architecture

The app follows Elysia's recommended **feature-based module** pattern ([MVC guide](https://elysiajs.com/patterns/mvc.html)): each feature lives under `src/modules/<feature>/` with a controller (`index.ts`) and a service (`service.ts`).

- **Controller (`index.ts`)** — an Elysia instance that owns the prefix, mounts plugins (`@elysiajs/cors`, `elysia-rate-limit`), and registers routes. Route handlers are thin wrappers that delegate to the service.
- **Service (`service.ts`)** — an abstract class of static methods with no Elysia dependency, which makes it trivial to unit-test without spinning up an HTTP server.
- **Root app (`src/index.ts`)** — imports each module and mounts it via `.use(module)`. Adding a new feature = add a new folder under `modules/` and one `.use()` call.
- **Per-feature config (`src/config/`)** — server-side defaults (rate-limit budgets, timeouts) kept out of the controllers. These are applied server-side and never accepted from the client.

**Privacy primitives live in `src/lib/`.** `client-id.ts` exports `hashClientIp(ip)`: a SHA-256 over a process-lifetime random salt plus the IP. The rate limiter calls it, so Redis stores only opaque hex digests. The salt never leaves the process. `keccak.ts` derives the only identifiers billing stores (see below).

## Endpoints

### `POST /rpc/{chain}` — JSON-RPC proxy

Drop-in replacement for the chain's upstream RPC URL in a browser frontend. Forwards the request body byte-for-byte to the upstream and streams the response back. `{chain}` is one of `ethereum`, `arbitrum`, `base`, `sepolia`, `arbitrum-sepolia`, `base-sepolia`.

**Usage:**
```
http://localhost:8000/rpc/ethereum
http://localhost:8000/rpc/base-sepolia
```
Point viem / ethers / web3.js at that URL instead of your Alchemy/Infura/etc. URL.

**What the upstream provider sees:**
- This server's IP (not the end-user's).
- A fixed `User-Agent: zxstim-rpc/1.0` — every request looks identical, so customers cannot be distinguished by browser fingerprint.
- `content-type: application/json` and `accept` from the client; everything else (`user-agent`, `accept-language`, `sec-ch-ua-*`, `sec-fetch-*`, `referer`, `origin`, `cookie`, `x-forwarded-*`, `dnt`, etc.) is stripped by `RpcService.proxy`.

**CORS:** `Access-Control-Allow-Origin: *`, credentials off. `OPTIONS` preflights are short-circuited by `@elysiajs/cors` and never proxied upstream.

**Adding a chain:** add a `[path, requireEnv("…_RPC_URL")]` entry to `UPSTREAMS` in `src/modules/rpc/index.ts` (both the keyless and billed routes use it), the var in `.env.example`, and a row in the routing test in `src/test/rpc.test.ts`.

### `POST /rpc/{chain}/{api-key}` — billed JSON-RPC proxy

Same proxy, same privacy, but each JSON-RPC call costs 1 credit (a batch of N costs N). The key is in the path because a wallet's "custom RPC" setting only takes a URL; nginx keeps no access log, so it isn't written anywhere.

| Response | When |
|---|---|
| upstream's response + `X-Credits-Remaining` | charged; JSON-RPC errors such as `execution reverted` count (the upstream did the work) |
| upstream 5xx / 429, or 502 | upstream failed → **refunded** |
| `400` | not JSON-RPC, a batch over 100 calls, or a blocked method (`debug_*`, `trace_*`) — not charged |
| `401` / `402` | unknown or revoked key / out of credits (JSON-RPC error body) |
| `503` + `Retry-After` | Redis or Postgres unavailable — fails closed, nothing proxied |

Rate limit: 1,200 requests/min per client IP (`rpcConfig.keyedRateLimit`), per IP rather than per key so minting random keys can't buy fresh buckets.

### `/v1` — accounts, keys, claims

| Endpoint | Auth | |
|---|---|---|
| `POST /v1/account/keys` `{keyHash}` | `Authorization: Account <account-secret>` | register an API key (by its hash); creates the account on first use |
| `DELETE /v1/account/keys/{keyHash}` | `Account …` | revoke a key (revoked keys stay revoked) |
| `GET /v1/account` | `Authorization: Bearer <api-key>` | `{credits}` |
| `POST /v1/claims` `{secret}` | `Bearer …` | claim a payment: `200` credited, `202` not seen on-chain yet (retry), `409` already claimed |

60 requests/min per client IP. All values are 32 bytes of hex (`0x` optional).

## Billing (prepaid credits)

Mullvad-style: no email, no username, no wallet address. **An account is a 32-byte secret** that the wallet derives from its seed (BIP-85), so the seed phrase is the backup. The server only ever stores keccak256 digests:

```
account id = keccak256("zxstim-rpc/account/v1" ‖ account_secret)
key hash   = keccak256(api_key)                      (API keys are derived by the wallet too)
secret_n   = keccak256(account_secret ‖ "zxstim-rpc/pay/v1" ‖ uint256(n))   (wallet only)
memo_n     = keccak256(secret_n)                     (goes on-chain)
```

**Paying.** The wallet calls the ownerless payment contract ([zxstimlabs/rpc-pay-contracts](https://github.com/zxstimlabs/rpc-pay-contracts)) with a fresh `memo_n`: ETH (0.001 / 0.002 / 0.005 / 0.01 / 0.02 / 0.05) or USDC/USDT ($2 / $5 / $10 / $50 / $100) on Ethereum, Base or Arbitrum (testnets for develop). Fixed amounts make payments hard to tell apart; one-time memos make them unlinkable. Funds go straight to the treasury (a Safe); the contract holds nothing and has no owner.

**Claiming.** A payment indexer records each `Paid(memo, token, amount)` event in `payments` with its credits ($1 = 10,000 credits; ETH valued at the Chainlink ETH/USD price at the payment's block). The wallet then posts `secret_n` to `/v1/claims` with its API key: the server checks `keccak256(secret_n)`, marks the payment claimed and adds the credits. Anyone can read a memo on-chain, but only the wallet knows the secret. The payment ↔ account link exists only during that request; **`payments` has no account column.** After a lost phone, the wallet re-derives its memos from the seed, finds them on-chain and claims anything unclaimed.

**Spending — leases.** Every credit is in exactly one place: Postgres `accounts.balance`, or a Redis *lease* (`src/lib/billing/leases.ts`):

- A billed request is one atomic Redis script: lease ≥ n → subtract; otherwise refill.
- A refill moves up to 1,000 credits from Postgres into the lease (`balance -= take`, `leased += take`) under a per-account lock, in the background once a lease falls below 200. One Postgres write per ~1,000 calls instead of one per call, no hot-row contention, and requests keep flowing through a brief Postgres outage.
- Leases idle for 5 minutes go back to Postgres. Claims only touch Postgres; the next refill picks them up — there's no cache to invalidate.
- **Redis keeps nothing on disk.** If it restarts, the leases are gone; a random `epoch` key changes, and each account's next refill sees its `leased` belongs to a dead epoch and **refunds all of it**. The customer loses nothing; we give away at most one lease ($0.10) per active account.

**Not built yet:** the payment indexer (needs the deployed contract addresses), contract deployment, and the wallet side. Open: Postgres backups (encrypted, off the box), the free allowance for keyless users of our own apps, an `eth_getLogs` block-range cap.

## Rate limiting

The rpc and account modules use [`elysia-rate-limit`](https://github.com/rayriffy/elysia-rate-limit), with budgets in `src/config/` (keyless: 200 requests per fixed 60s window per client, shared across all chains). **Counts live in Redis** (`src/lib/redis-rate-limit.ts`, Bun's built-in client), not in process memory.

- **`countFailedRequest: true`** — 4xx/5xx responses still consume the budget, so an attacker cannot spam deliberately-erroring calls for free.
- **`scoping: "scoped"`** — each limiter's hooks apply only to its module; `/` and `/health` are never throttled.
- **Client key** — the custom generator (see `src/lib/client-id.ts`) returns `sha256(salt || ip)` as a hex string; Redis stores that digest (under `zxstim-rpc:rl:*`), never the IP. Each key expires with its window. Unidentifiable clients share one bucket under the empty-string key.
- **Fails closed** — if Redis is down, stalled (> 500 ms) or erroring, requests get **503** with `Retry-After: 5` (CORS headers intact) instead of being served uncounted. `GET /health` returns 200 only while Redis and Postgres both answer.
- **Redis config** (`deploy/compose.yaml`) — persistence off (`--save ""`, no AOF), 64 MB cap, no published port. Counters and the key cache expire; credit leases don't, so they're never evicted.
- The salt is per-process, so counts reset when the app restarts.

## Privacy posture

The goal across the whole app is: **the upstream RPC provider cannot distinguish customers, and this server never stores who its customers are.** Concretely:

- **No logging.** No access logs, no request/response bodies written anywhere. The only log is a single startup line in `src/index.ts`. Postgres runs with `log_min_error_statement=panic` (never logs query text) and no connection logging.
- **Billing state only, no client data, at rest.** Postgres holds account ids, API key hashes, balances and on-chain payments — digests and numbers. No IPs, no timestamps, no request records, no wallet addresses, and nothing links a payment to an account. Redis holds salted-hash rate-limit counters (each expiring with its window), credit leases, and a key-hash cache, in memory only.
- **IPs are not stored in plaintext.** The rate limiter stores salted hashes only; the salt is in-process memory and dies with the process.
- **Customer headers are dropped, not passed through.** `RpcService.proxy` uses an allowlist (not a denylist), so new browser fingerprinting headers are blocked by default.
- **User-Agent is overwritten.** Every outbound request carries `zxstim-rpc/1.0` regardless of what the customer sent.

## Deployment note — client IPs behind nginx

The app sits behind nginx (TLS) and Docker, so its TCP peer is never the real client. With `TRUST_PROXY=1` (set in `deploy/compose.yaml`) the rate limiter keys on the `X-Real-IP` header that nginx overwrites with `$remote_addr`. That is only safe because the container port is bound to `127.0.0.1`, so clients can't reach the app directly and forge the header. If a CDN proxy is ever added in front of nginx, nginx must restore the real client IP first (e.g. `real_ip_header CF-Connecting-IP` plus the CDN's ranges), or every client collapses into the CDN's addresses.

## Deployment (CI/CD)

`.github/workflows/ci-cd.yml` — push to deploy, nothing manual:

| Event | Jobs | Target |
|---|---|---|
| PR into `main` / `develop` | test | — |
| push `develop` | test → build → deploy → **smoke test on the server → tear down** | GitHub env **develop** → stack `zxstim-rpc-dev` on `127.0.0.1:8002`. Throwaway: tested in place of a laptop, then removed with its `.env`, `db.env` and database |
| push `main` | test → build → deploy | GitHub env **production** → stack `zxstim-rpc` on `127.0.0.1:8001` (nginx: `rpc.zxstim.com`, `api.unitmetal.com`) |

- **Image:** `ghcr.io/zxstimlabs/eth-rpc:<commit-sha>` (+ `:<branch>`), built from the `Dockerfile` `runtime` target (binary + SQL migrations). It contains no secrets.
- **Stack:** app + Redis 8.12 + Postgres 19 (`deploy/compose.yaml`), on a private network; only the app's port is published, on `127.0.0.1`.
- **Secrets** (the six `*_RPC_URL`) live in the GitHub environment and only reach the server at deploy time, as `/opt/<stack>/.env` (mode 600). The **Postgres password** is generated on the server by `deploy.sh` into `/opt/<stack>/db.env` (mode 600) once per stack and never leaves it. Don't delete production's `db.env`: the data volume was initialised with it.
- **Access:** the runner joins Tailscale with a per-environment OIDC credential (no stored secret) as `tag:ci`, which the tailnet policy lets reach only `tag:server`'s SSH, as user `deploy`. The server has no public SSH.
- **develop smoke test** (`deploy/smoke-test.sh`, refuses non-dev stacks): `/health`; every chain returns its correct chain id (catches wrong or swapped secrets); CORS preflight; per-client rate-limit counting in Redis (no raw IPs, 60s expiry, persistence off); billing end to end (register a key, claim a payment, spend credits, balance; no IPs or raw secrets in Postgres; Postgres logging off); a Redis outage → 503 + `Retry-After`, then recovery with the lost lease refunded; the app logged only its startup line.
- **On the server:** `deploy/deploy.sh` swaps in the new `.env`, pulls, restarts, checks `/health` for 30s, and **rolls back** to the previous image and `.env` if unhealthy.
- **Rollback by hand:** re-run the workflow for an earlier commit (Actions → CI/CD → Run workflow on that branch), or on the server: `IMAGE=<old ref> HOST_PORT=<port> docker compose -p <stack> -f /opt/<stack>/compose.yaml up -d`. Migrations only move forward, so keep schema changes backward-compatible with the previous image.
- Workflow logs are public (public repo): nothing in the pipeline prints secrets or container logs.

## Testing

```bash
docker compose -f deploy/compose.test.yaml run --rm --build test   # its own Redis + Postgres
docker compose -f deploy/compose.test.yaml down
```

- `rpc.test.ts` — keyless proxy: headers stripped, fixed `User-Agent`, byte-for-byte body, CORS, preflights never proxied, per-chain routing, rate limiting and fail-closed 503.
- `rpc-keyed.test.ts` — billed route: per-call charging, batches, refunds on upstream failure, 400/401/402/404/405/503, CORS-exposed balance header.
- `billing-leases.test.ts` — the lease engine against real Redis + Postgres: refills, drains, concurrency (never overspends), refunds, idle returns, Redis-restart refund.
- `billing-accounts.test.ts`, `account-api.test.ts` — keys (register, conflict, revoke, cap, cache), claims (once only, races, no account link stored), the /v1 API.
- `keccak-calls.test.ts` — Ethereum keccak vectors (shared with the smoke test and the contract repo) and call counting.

Tests need a disposable Redis (`REDIS_URL`) and Postgres (`DATABASE_URL`): they reset counters, pause Redis writes and write accounts. No test hits a real upstream, but all six `*_RPC_URL` must be set; give them distinct values or the routing test can't catch a route pointing at the wrong chain.
