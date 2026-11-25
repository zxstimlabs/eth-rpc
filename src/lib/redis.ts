/**
 * Shared Redis connection
 * -----------------------
 * One process-wide client (Bun's built-in `RedisClient`, no extra
 * dependency). Used by the rate limiter (`redis-rate-limit.ts`) and the
 * `/health` route.
 *
 * `REDIS_URL` is required and read once at module load, like every other
 * env var in this app: a missing value means the server refuses to start.
 *
 * Client options are chosen for a fail-closed rate limiter:
 *   - `enableOfflineQueue: false` — while disconnected, commands fail
 *     immediately instead of queueing. Queued commands would make every
 *     request hang until Redis came back.
 *   - `connectionTimeout` — bounded, so startup and reconnects don't stall.
 *   - `autoReconnect` — Bun retries on its own; `RedisRateLimitContext`
 *     also nudges a reconnect (throttled) if the client has given up.
 */

import { RedisClient } from "bun";

const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) {
  throw new Error("REDIS_URL is not set");
}

export const redis = new RedisClient(REDIS_URL, {
  connectionTimeout: 2_000,
  autoReconnect: true,
  enableOfflineQueue: false,
});

/**
 * Connect at startup. Throws if Redis is unreachable, so the process exits
 * and the supervisor (Docker `restart:`) retries — same fail-fast idea as
 * the env checks.
 */
export const connectRedis = async (): Promise<void> => {
  await redis.connect();
};

/** True if Redis answers PING within `timeoutMs`. Never throws. */
export const redisHealthy = async (timeoutMs = 500): Promise<boolean> => {
  if (!redis.connected) return false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const reply = await Promise.race([
      redis.send("PING", []),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
      }),
    ]);
    return reply === "PONG";
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
};
