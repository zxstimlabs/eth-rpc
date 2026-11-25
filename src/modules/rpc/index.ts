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
 * This file is the Elysia "controller" for the feature: it wires together
 * CORS, per-client rate limiting, and the RpcService (which does the actual
 * request forwarding). The Elysia instance is exported so the root app can
 * mount it via `.use(rpc)`.
 */

import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { rateLimit } from "elysia-rate-limit";
import { hashClientIp } from "../../lib/client-id";
import { redis } from "../../lib/redis";
import {
  RateLimiterUnavailableError,
  RedisRateLimitContext,
} from "../../lib/redis-rate-limit";
import { rpcConfig } from "../../config/rpc";
import { RpcService } from "./service";

// --- Configuration ---------------------------------------------------------

/**
 * Upstream JSON-RPC endpoints, one per supported chain. Read once at
 * module load from `.env.local` (Bun auto-loads it). The process refuses
 * to start without any of them — failing fast here is better than
 * returning 500s at runtime when a particular chain's path is hit.
 *
 * When you add a new chain: add a `requireEnv` line here and a matching
 * `.all("/{chain}", ...)` route below.
 */
const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
};

// Mainnets
const ETHEREUM_RPC_URL = requireEnv("ETHEREUM_RPC_URL");
const ARBITRUM_RPC_URL = requireEnv("ARBITRUM_RPC_URL");
const BASE_RPC_URL = requireEnv("BASE_RPC_URL");

// Testnets (Sepolia-based)
const SEPOLIA_RPC_URL = requireEnv("SEPOLIA_RPC_URL");
const ARBITRUM_SEPOLIA_RPC_URL = requireEnv("ARBITRUM_SEPOLIA_RPC_URL");
const BASE_SEPOLIA_RPC_URL = requireEnv("BASE_SEPOLIA_RPC_URL");

/**
 * Rate-limit counts live in Redis (shared `redis` client). Fails closed:
 * if Redis can't answer, requests get a 503 (see `.onError` below) rather
 * than being served uncounted. Exported so tests can reset windows.
 */
export const rpcRateLimitStore = new RedisRateLimitContext(redis, {
  prefix: rpcConfig.rateLimit.redisKeyPrefix,
  timeoutMs: rpcConfig.rateLimit.redisTimeoutMs,
});

// --- Controller ------------------------------------------------------------

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

      // Custom key generator. Replaces the plugin's default, which:
      //   (a) uses the raw IP as the LRU key (we don't want IPs in RAM), and
      //   (b) emits `console.warn` when IP detection fails (we want zero logs).
      //
      // `server.requestIP(request)` returns the direct TCP peer. If this
      // service is ever deployed behind a load balancer/CDN, every
      // customer will share the LB's IP — at that point, read
      // `x-forwarded-for` here instead (and trust it only from the LB).
      generator: (request, server) => {
        const ip = server?.requestIP(request)?.address;
        // Empty string still works as a key: all unidentifiable clients
        // share one bucket, which is safe (they self-throttle together).
        return ip ? hashClientIp(ip) : "";
      },
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
  .all("/ethereum", ({ request }) =>
    RpcService.proxy(request, ETHEREUM_RPC_URL)
  )
  .all("/arbitrum", ({ request }) =>
    RpcService.proxy(request, ARBITRUM_RPC_URL)
  )
  .all("/base", ({ request }) => RpcService.proxy(request, BASE_RPC_URL))
  .all("/sepolia", ({ request }) =>
    RpcService.proxy(request, SEPOLIA_RPC_URL)
  )
  .all("/arbitrum-sepolia", ({ request }) =>
    RpcService.proxy(request, ARBITRUM_SEPOLIA_RPC_URL)
  )
  .all("/base-sepolia", ({ request }) =>
    RpcService.proxy(request, BASE_SEPOLIA_RPC_URL)
  );
