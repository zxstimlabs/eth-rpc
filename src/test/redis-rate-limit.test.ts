/**
 * Tests for RedisRateLimitContext against a real Redis (`REDIS_URL`).
 *
 * Each run uses a random key prefix, so runs never see each other's
 * counts. Run where a disposable Redis is available, e.g. via
 * `docker compose -f deploy/compose.yaml --profile test run --rm test`.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { RedisClient } from "bun";
import { redis } from "../lib/redis";
import {
  RateLimiterUnavailableError,
  RedisRateLimitContext,
} from "../lib/redis-rate-limit";

const RUN = `test:${crypto.randomUUID()}:`;

/** A store with its own prefix and window length. */
const makeStore = (name: string, durationMs = 60_000, timeoutMs = 500) => {
  const store = new RedisRateLimitContext(redis, {
    prefix: `${RUN}${name}:`,
    timeoutMs,
  });
  // The plugin normally calls init() with its options; only `duration`
  // matters to this store.
  store.init({ duration: durationMs } as Parameters<typeof store.init>[0]);
  return store;
};

beforeAll(async () => {
  await redis.connect();
});

afterAll(async () => {
  // Clear everything this run created (every store's prefix starts with RUN).
  await new RedisRateLimitContext(redis, { prefix: RUN, timeoutMs: 2_000 }).reset();
});

describe("RedisRateLimitContext", () => {
  test("first hit starts a window at count 1, ending ~duration from now", async () => {
    const store = makeStore("first");
    const before = Date.now();
    const { count, nextReset } = await store.increment("k");

    expect(count).toBe(1);
    expect(nextReset.getTime()).toBeGreaterThanOrEqual(before + 59_000);
    expect(nextReset.getTime()).toBeLessThanOrEqual(Date.now() + 60_000);
  });

  test("later hits in the same window increment without moving the reset", async () => {
    const store = makeStore("same-window");
    const a = await store.increment("k");
    const b = await store.increment("k");
    const c = await store.increment("k");

    expect([a.count, b.count, c.count]).toEqual([1, 2, 3]);
    // Same window: reset time stays put (allow for clock/ttl rounding).
    expect(Math.abs(c.nextReset.getTime() - a.nextReset.getTime())).toBeLessThan(50);
  });

  test("keys are counted independently", async () => {
    const store = makeStore("isolation");
    await store.increment("a");
    await store.increment("a");
    const b = await store.increment("b");

    expect(b.count).toBe(1);
  });

  test("the Redis key expires with the window (never permanent)", async () => {
    const store = makeStore("ttl");
    await store.increment("k");
    const pttl = (await redis.send("PTTL", [`${RUN}ttl:k`])) as number;

    expect(pttl).toBeGreaterThan(0);
    expect(pttl).toBeLessThanOrEqual(60_000);
  });

  test("a new window starts after the old one expires", async () => {
    const store = makeStore("expiry", 300);
    await store.increment("k");
    await store.increment("k");
    await Bun.sleep(400);
    const { count } = await store.increment("k");

    expect(count).toBe(1);
  });

  test("decrement lowers the count, and never creates a key", async () => {
    const store = makeStore("decrement");
    await store.increment("k");
    await store.increment("k");
    await store.decrement("k");
    expect((await store.increment("k")).count).toBe(2);

    await store.decrement("missing");
    expect(await redis.send("EXISTS", [`${RUN}decrement:missing`])).toBe(0);
  });

  test("reset(key) clears one window; reset() clears only this prefix", async () => {
    const store = makeStore("reset");
    const other = makeStore("reset-other");
    await store.increment("a");
    await store.increment("b");
    await other.increment("a");

    await store.reset("a");
    expect((await store.increment("a")).count).toBe(1);

    await store.reset();
    expect((await store.increment("b")).count).toBe(1);
    expect((await other.increment("a")).count).toBe(2); // untouched
  });

  test("stores only the given key and an integer count", async () => {
    const store = makeStore("contents");
    await store.increment("opaque-digest");
    const keys = (await redis.send("KEYS", [`${RUN}contents:*`])) as string[];

    expect(keys).toEqual([`${RUN}contents:opaque-digest`]);
    expect(await redis.get(keys[0]!)).toBe("1");
  });
});

describe("fails closed", () => {
  test("not connected → RateLimiterUnavailableError, immediately", async () => {
    // Nothing listens on port 1; never connects.
    const dead = new RedisClient("redis://127.0.0.1:1", {
      autoReconnect: false,
      enableOfflineQueue: false,
      connectionTimeout: 200,
    });
    const store = new RedisRateLimitContext(dead, { prefix: RUN, timeoutMs: 500 });
    store.init({ duration: 60_000 } as Parameters<typeof store.init>[0]);

    const started = Date.now();
    await expect(store.increment("k")).rejects.toBeInstanceOf(RateLimiterUnavailableError);
    expect(Date.now() - started).toBeLessThan(100);
    dead.close();
  });

  test("Redis stalled longer than timeoutMs → RateLimiterUnavailableError", async () => {
    const store = makeStore("stalled", 60_000, 100);
    // Pause write commands on the server for 400 ms (a separate admin
    // connection so the shared client's queue isn't involved).
    const admin = new RedisClient(process.env.REDIS_URL);
    await admin.connect();
    await admin.send("CLIENT", ["PAUSE", "400", "WRITE"]);

    const started = Date.now();
    await expect(store.increment("k")).rejects.toBeInstanceOf(RateLimiterUnavailableError);
    const elapsed = Date.now() - started;
    expect(elapsed).toBeGreaterThanOrEqual(90);
    expect(elapsed).toBeLessThan(350);

    await Bun.sleep(400); // let the pause end before other tests
    admin.close();
  });
});
