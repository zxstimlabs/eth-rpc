/**
 * RPC Module (controller)
 * -----------------------
 * Exposes public `/rpc/*` endpoints that proxy JSON-RPC requests to
 * blockchain providers. Each supported chain has a path backed by its own
 * upstream URL:
 *
 *   mainnets: `/rpc/ethereum`, `/rpc/arbitrum`, `/rpc/base`
 *   testnets: `/rpc/sepolia`, `/rpc/arbitrum-sepolia`, `/rpc/base-sepolia`
 *
 * Two Elysia instances share the `/rpc` prefix:
 *
 *   `rpc`       `/rpc/{chain}`        keyless; per-IP rate limit only
 *   `rpcKeyed`  `/rpc/{chain}/{key}`  billed: 1 credit per JSON-RPC call
 *                                     (see lib/billing), its own per-IP limit
 *
 * The key sits in the path, not a header, because a wallet's "custom RPC"
 * setting takes only a URL. nginx keeps no access log, so it isn't written
 * anywhere. Both are exported so the root app can mount them.
 */

import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { rateLimit } from "elysia-rate-limit";
import {
  clientIp,
  getListeningServer,
  hashClientIp,
} from "../../lib/client-id";
import { redis } from "../../lib/redis";
import {
  RateLimiterUnavailableError,
  RedisRateLimitContext,
} from "../../lib/redis-rate-limit";
import {
  BillingUnavailableError,
  InsufficientCreditsError,
  accountStore,
  countCalls,
  leaseStore,
} from "../../lib/billing";
import { keyHashOf, parseHex32 } from "../../lib/keccak";
import { billingConfig } from "../../config/billing";
import { rpcConfig } from "../../config/rpc";
import { RpcService } from "./service";

// --- Configuration ---------------------------------------------------------

/**
 * Upstream JSON-RPC endpoints, one per supported chain. Read once at
 * module load. The process refuses to start without any of them — failing
 * fast here is better than returning 500s at runtime when a particular
 * chain's path is hit.
 *
 * When you add a new chain: add a line here (path → env var). Both the
 * keyless and the billed route pick it up.
 */
const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
};

// A Map, so names every object has (`toString`, `__proto__`) aren't chains.
const UPSTREAMS: ReadonlyMap<string, string> = new Map([
  // Mainnets
  ["ethereum", requireEnv("ETHEREUM_RPC_URL")],
  ["arbitrum", requireEnv("ARBITRUM_RPC_URL")],
  ["base", requireEnv("BASE_RPC_URL")],
  // Testnets (Sepolia-based)
  ["sepolia", requireEnv("SEPOLIA_RPC_URL")],
  ["arbitrum-sepolia", requireEnv("ARBITRUM_SEPOLIA_RPC_URL")],
  ["base-sepolia", requireEnv("BASE_SEPOLIA_RPC_URL")],
]);

const upstreamFor = (chain: string): string | undefined => UPSTREAMS.get(chain);

/**
 * `TRUST_PROXY=1` → take the client IP from `X-Real-IP` (set by our nginx).
 * Only safe when the app is reachable solely through that proxy — see
 * `clientIp()`. deploy/compose.yaml sets it; the port is bound to 127.0.0.1.
 */
const TRUST_PROXY = process.env.TRUST_PROXY === "1";

/**
 * Rate-limit key: a salted hash of the client IP, never the raw IP.
 * Replaces the plugin's default, which (a) keys on the raw IP and (b)
 * `console.warn`s when IP detection fails (we want zero logs). Behind
 * nginx + Docker the TCP peer is the proxy, so with TRUST_PROXY the
 * nginx-set `X-Real-IP` is used instead (see clientIp). Empty string still
 * works as a key: all unidentifiable clients share one bucket, which is
 * safe (they self-throttle together).
 */
const clientKey = (request: Request, server: Parameters<typeof clientIp>[1]) => {
  const ip = clientIp(request, server, TRUST_PROXY);
  return ip ? hashClientIp(ip) : "";
};

/** A JSON-RPC-shaped error response (wallets show `error.message`). */
const rpcError = (status: number, code: number, message: string) =>
  new Response(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code, message } }), {
    status,
    headers: { "content-type": "application/json" },
  });

/**
 * Rate-limit counts live in Redis (shared `redis` client). Fails closed:
 * if Redis can't answer, requests get a 503 (see `.onError` below) rather
 * than being served uncounted. Exported so tests can reset windows.
 */
export const rpcRateLimitStore = new RedisRateLimitContext(redis, {
  prefix: rpcConfig.rateLimit.redisKeyPrefix,
  timeoutMs: rpcConfig.rateLimit.redisTimeoutMs,
});

export const rpcKeyedRateLimitStore = new RedisRateLimitContext(redis, {
  prefix: rpcConfig.keyedRateLimit.redisKeyPrefix,
  timeoutMs: rpcConfig.rateLimit.redisTimeoutMs,
});

// --- Keyless controller ----------------------------------------------------

export const rpc = new Elysia({ prefix: "/rpc" })
  // CORS must be registered BEFORE rateLimit. The cors plugin answers
  // `OPTIONS` preflight requests itself (short-circuiting the request
  // pipeline with a 204). Because rateLimit is registered after, its
  // hook never runs on preflights, so preflights do not consume a
  // client's request budget.
  //
  //   origin: true        -> reflects Access-Control-Allow-Origin: *
  //   credentials: false  -> required when origin is `*`; the proxy does
  //                          not use cookies/auth headers anyway.
  .use(cors({ origin: true, credentials: false }))
  .use(
    rateLimit({
      max: rpcConfig.rateLimit.max,
      duration: rpcConfig.rateLimit.durationMs,

      // "scoped" confines the limiter to this Elysia instance and its
      // descendants. Without this override the plugin defaults to
      // "global" and would also throttle unrelated routes (e.g. `/`).
      scoping: "scoped",

      // Count 4xx/5xx as well. Otherwise an attacker could spam requests
      // that deliberately trigger upstream errors and get unlimited
      // throughput for free.
      countFailedRequest: true,

      // Counts in Redis instead of the plugin's in-process LRU.
      context: rpcRateLimitStore,

      // The plugin looks up the server on the app it's mounted on — this
      // sub-app, which has none (only the root app that calls .listen()
      // does). Without this, every client got the same "" key: one shared
      // bucket for everyone. src/index.ts registers the real server.
      injectServer: getListeningServer,

      generator: clientKey,
    })
  )
  // Fail closed: when the limiter can't reach Redis, refuse with a 503
  // instead of serving uncounted traffic. Setting `set.status`/headers
  // (rather than returning a bare Response) keeps the CORS headers, so
  // browsers can read the 503. Nothing is logged. Other errors fall
  // through to Elysia's default handling.
  .onError(({ error, set }) => {
    if (error instanceof RateLimiterUnavailableError) {
      set.status = 503;
      set.headers["retry-after"] = String(rpcConfig.rateLimit.unavailableRetryAfterSec);
      return "rate limiter unavailable";
    }
  })
  // `.all()` accepts any HTTP method so each endpoint behaves as a
  // drop-in for the upstream RPC URL. JSON-RPC is POST in practice, but
  // being permissive costs nothing and avoids surprising library
  // behaviour. Final paths are `/rpc/{chain}` (prefix + route).
  //
  // All chains (mainnet and testnet) share the one rate-limit budget above.
  .all("/:chain", ({ params, request }) => {
    const upstream = upstreamFor(params.chain);
    if (!upstream) return rpcError(404, -32601, "unknown chain");
    return RpcService.proxy(request, upstream);
  });

// --- Billed controller -----------------------------------------------------

export const rpcKeyed = new Elysia({ prefix: "/rpc" })
  // Same ordering rule as above. Browsers may read the balance header.
  .use(cors({ origin: true, credentials: false, exposeHeaders: ["x-credits-remaining"] }))
  .use(
    rateLimit({
      max: rpcConfig.keyedRateLimit.max,
      duration: rpcConfig.keyedRateLimit.durationMs,
      scoping: "scoped",
      countFailedRequest: true,
      context: rpcKeyedRateLimitStore,
      injectServer: getListeningServer,
      // Per IP, not per key: a per-key bucket would let anyone mint fresh
      // random keys for fresh buckets. Credits already meter each key.
      generator: clientKey,
    })
  )
  .onError(({ error, set }) => {
    if (error instanceof RateLimiterUnavailableError || error instanceof BillingUnavailableError) {
      set.status = 503;
      set.headers["retry-after"] = String(billingConfig.unavailableRetryAfterSec);
      set.headers["content-type"] = "application/json";
      return JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32003, message: "temporarily unavailable" },
      });
    }
    if (error instanceof InsufficientCreditsError) {
      set.status = 402;
      set.headers["content-type"] = "application/json";
      return JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32002, message: "out of credits" },
      });
    }
  })
  .all("/:chain/:key", async ({ params, request }) => {
    const upstream = upstreamFor(params.chain);
    if (!upstream) return rpcError(404, -32601, "unknown chain");

    const key = parseHex32(params.key);
    if (!key) return rpcError(401, -32001, "invalid api key");
    // Billing counts calls in the body, so it must be a JSON-RPC POST.
    if (request.method !== "POST") return rpcError(405, -32600, "use POST");

    const accountId = await accountStore.resolveKey(keyHashOf(key));
    if (!accountId) return rpcError(401, -32001, "unknown api key");

    const body = await request.arrayBuffer();
    const counted = countCalls(new TextDecoder().decode(body), billingConfig.calls);
    if (!counted.ok) return rpcError(400, counted.code, counted.message);

    // Throws InsufficientCreditsError (402) / BillingUnavailableError (503).
    const spent = await leaseStore.spend(accountId, counted.calls);

    let response: Response;
    try {
      response = await RpcService.proxy(request, upstream, body);
    } catch {
      await leaseStore.refund(accountId, counted.calls).catch(() => {});
      return rpcError(502, -32003, "upstream unavailable");
    }
    // Charge only when the upstream did the work (JSON-RPC errors like
    // `execution reverted` arrive as 200 and are charged).
    let refunded = 0;
    if (response.status >= 500 || response.status === 429) {
      await leaseStore.refund(accountId, counted.calls).catch(() => {});
      refunded = counted.calls;
    }
    response.headers.set("x-credits-remaining", String(spent.lease + spent.balance + refunded));
    return response;
  });
