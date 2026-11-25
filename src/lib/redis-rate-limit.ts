/**
 * Redis-backed store for `elysia-rate-limit`
 * ------------------------------------------
 * Implements the plugin's `Context` interface so counts live in Redis
 * instead of an in-process LRU. Same semantics as the plugin's default
 * store: a fixed window per key that starts on the key's first request
 * and lasts `duration` ms.
 *
 * **Fails closed.** If Redis is unreachable, slow, or errors, every method
 * throws `RateLimiterUnavailableError`. The controller maps that to
 * `503 Service Unavailable` — when we can't count, we don't serve. This
 * protects the upstream RPC quota during a Redis outage.
 *
 * Privacy: keys are whatever the plugin's `generator` returns — in this
 * app, `hashClientIp(ip)` (salted SHA-256), never a raw IP. Each key
 * expires with its window (≤ `duration`), and the Redis server runs with
 * persistence off, so nothing outlives a minute or reaches disk. Nothing
 * here logs.
 */

import type { RedisClient } from "bun";
import type { Context, Options } from "elysia-rate-limit";

export class RateLimiterUnavailableError extends Error {
  constructor() {
    super("rate limiter unavailable");
    this.name = "RateLimiterUnavailableError";
  }
}

/**
 * Atomic INCR + "set expiry on first hit" in one round trip. Returns
 * `{count, pttl}`. The `ttl < 0` branch also repairs a key that somehow
 * lost its expiry, so a counter can never become permanent.
 */
const INCREMENT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return {count, ttl}
`;

/** Decrement only if the window still exists (don't create a key). */
const DECREMENT_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 1 then
  return redis.call('DECR', KEYS[1])
end
return 0
`;

export type RedisRateLimitOptions = {
  /** Key namespace, e.g. "zxstim-rpc:rl:rpc:". Keeps limiters separate. */
  prefix: string;
  /** Per-command deadline. Slower than this counts as unavailable. */
  timeoutMs: number;
};

export class RedisRateLimitContext implements Context {
  private duration = 60_000;
  private lastReconnectAttempt = 0;

  constructor(
    private readonly client: RedisClient,
    private readonly options: RedisRateLimitOptions
  ) {}

  init(options: Omit<Options, "context">): void {
    this.duration = options.duration;
  }

  async increment(key: string): Promise<{ count: number; nextReset: Date }> {
    const [count, ttl] = (await this.run(() =>
      this.client.send("EVAL", [
        INCREMENT_SCRIPT,
        "1",
        this.options.prefix + key,
        String(this.duration),
      ])
    )) as [number, number];
    return {
      count: Number(count),
      nextReset: new Date(Date.now() + Number(ttl)),
    };
  }

  async decrement(key: string): Promise<void> {
    await this.run(() =>
      this.client.send("EVAL", [DECREMENT_SCRIPT, "1", this.options.prefix + key])
    );
  }

  /** Delete one key's window, or every window under this prefix. */
  async reset(key?: string): Promise<void> {
    if (typeof key === "string") {
      await this.run(() => this.client.send("DEL", [this.options.prefix + key]));
      return;
    }
    let cursor = "0";
    do {
      const [next, keys] = (await this.run(() =>
        this.client.send("SCAN", [
          cursor,
          "MATCH",
          `${this.options.prefix}*`,
          "COUNT",
          "200",
        ])
      )) as [string, string[]];
      cursor = String(next);
      if (keys.length > 0) {
        await this.run(() => this.client.send("DEL", keys));
      }
    } while (cursor !== "0");
  }

  /**
   * Called by the plugin when the app stops. The Redis client is shared
   * (health check, other limiters), so it is not closed here, and counts
   * are left to expire on their own.
   */
  kill(): void {}

  /**
   * Run one Redis command with the fail-closed rules: not connected →
   * unavailable now (and nudge a reconnect); slower than `timeoutMs` →
   * unavailable; any error → unavailable.
   */
  private async run<T>(command: () => Promise<T>): Promise<T> {
    if (!this.client.connected) {
      this.nudgeReconnect();
      throw new RateLimiterUnavailableError();
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        command(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new RateLimiterUnavailableError()),
            this.options.timeoutMs
          );
        }),
      ]);
    } catch {
      throw new RateLimiterUnavailableError();
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Bun's client reconnects on its own but stops after its retry budget.
   * This restarts the attempt, at most once per second, driven by traffic.
   */
  private nudgeReconnect(): void {
    const now = Date.now();
    if (now - this.lastReconnectAttempt < 1_000) return;
    this.lastReconnectAttempt = now;
    this.client.connect().catch(() => {});
  }
}
