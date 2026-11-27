/**
 * Tests for LeaseStore (src/lib/billing/leases.ts) against a real Redis and
 * Postgres. Each run uses a random Redis prefix and fresh accounts, and a
 * small lease size so refills happen often.
 *
 * The invariant under test: every credit is in exactly one place, so
 * Postgres balance + live Redis lease = what the customer can still spend.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { RedisClient } from "bun";
import { db, migrateDb } from "../db";
import { redis } from "../lib/redis";
import { LeaseStore, type LeaseOptions } from "../lib/billing/leases";
import { BillingUnavailableError, InsufficientCreditsError } from "../lib/billing/errors";
import { RedisRateLimitContext } from "../lib/redis-rate-limit";
import { accountRow, newAccount, randomHex32 } from "./helpers";

const RUN = `test:${crypto.randomUUID()}:`;

const options = (overrides: Partial<LeaseOptions> = {}): LeaseOptions => ({
  prefix: RUN,
  timeoutMs: 500,
  size: 10,
  lowWater: 3,
  idleReturnMs: 1_000,
  lockTtlMs: 5_000,
  refillWaitMs: 2_000,
  ...overrides,
});

const store = new LeaseStore(redis, db, options());
const leaseOf = async (id: string) => Number((await redis.get(`${RUN}lease:${id}`)) ?? 0);

/** Wait out any background (low-water) refill so state is settled. */
const settle = () => Bun.sleep(50);

beforeAll(async () => {
  await redis.connect();
  await migrateDb();
});

afterAll(async () => {
  // Every key this run created starts with RUN.
  await new RedisRateLimitContext(redis, { prefix: RUN, timeoutMs: 2_000 }).reset();
});

describe("LeaseStore", () => {
  test("the first spend leases `size` credits out of Postgres", async () => {
    const id = await newAccount(25);
    const spent = await store.spend(id, 1);

    expect(spent.lease).toBe(9);
    expect(spent.balance).toBe(15); // Postgres after the refill
    await settle();
    const row = await accountRow(id);
    expect(row.balance).toBe(15);
    expect(row.leased).toBe(10);
    expect(await leaseOf(id)).toBe(9);
  });

  test("spending drains the whole balance across refills, then 402", async () => {
    const id = await newAccount(25);
    for (let i = 0; i < 25; i++) await store.spend(id, 1);
    await expect(store.spend(id, 1)).rejects.toBeInstanceOf(InsufficientCreditsError);

    await settle();
    const row = await accountRow(id);
    expect(row.balance).toBe(0);
    expect(row.leased).toBe(25); // all of it went through Redis
    expect(await leaseOf(id)).toBe(0);
    expect(await store.available(id)).toBe(0);
  });

  test("a batch bigger than what's left in the lease triggers a refill", async () => {
    const id = await newAccount(25);
    await store.spend(id, 8); // lease 2 left, Postgres 15
    const spent = await store.spend(id, 5); // refill +10 → 12 → 7

    expect(spent.lease).toBe(7);
    await settle();
    expect((await accountRow(id)).balance).toBe(5);
    expect(await store.available(id)).toBe(12);
  });

  test("402 when lease + Postgres can't cover n; the partial lease is kept", async () => {
    const id = await newAccount(5);
    await store.spend(id, 3); // takes all 5 into the lease → 2 left

    await expect(store.spend(id, 4)).rejects.toBeInstanceOf(InsufficientCreditsError);
    expect(await leaseOf(id)).toBe(2);
    expect((await store.spend(id, 2)).lease).toBe(0); // smaller requests still fit
  });

  test("concurrent spends never overspend", async () => {
    const id = await newAccount(30);
    const results = await Promise.allSettled(
      Array.from({ length: 50 }, () => store.spend(id, 1))
    );

    const ok = results.filter((r) => r.status === "fulfilled").length;
    const refused = results.filter(
      (r) => r.status === "rejected" && r.reason instanceof InsufficientCreditsError
    ).length;
    expect(ok).toBe(30);
    expect(refused).toBe(20);
    await settle();
    expect(await store.available(id)).toBe(0);
  });

  test("refund puts credits back into the lease", async () => {
    const id = await newAccount(25);
    await store.spend(id, 5);
    await store.refund(id, 5);

    expect(await leaseOf(id)).toBe(10);
    await settle();
    expect(await store.available(id)).toBe(25);
  });

  test("Redis restart: a dead epoch's lease is refunded in full (customer loses nothing)", async () => {
    const id = await newAccount(25);
    await store.spend(id, 4); // Postgres 15, leased 10, lease 6
    await settle();

    // Simulate Redis losing everything (it keeps nothing on disk).
    await redis.del(`${RUN}lease:${id}`, `${RUN}snap:${id}`, `${RUN}epoch`, `${RUN}leased-at`);
    // Before the next refill, the dead lease still counts as spendable.
    expect(await store.available(id)).toBe(25);

    const spent = await store.spend(id, 1); // refund 10 → 25, lease 10 → 9
    expect(spent.lease).toBe(9);
    await settle();
    const row = await accountRow(id);
    expect(row.balance).toBe(15);
    expect(row.leased).toBe(10);
    // The 4 calls spent from the lost lease were free: never short-changed.
    expect(await store.available(id)).toBe(24);
  });

  test("an idle lease goes back to Postgres", async () => {
    const id = await newAccount(25);
    await store.spend(id, 3); // Postgres 15, lease 7
    await settle();

    const returned = await store.returnIdle(Date.now() + 2_000);
    expect(returned).toBeGreaterThanOrEqual(1);
    const row = await accountRow(id);
    expect(row.balance).toBe(22);
    expect(row.leased).toBe(0);
    expect(await redis.get(`${RUN}lease:${id}`)).toBeNull();
    expect(await store.available(id)).toBe(22);

    // The account keeps working: the next spend leases again.
    expect((await store.spend(id, 1)).lease).toBe(9);
  });

  test("a fresh lease isn't returned (not idle yet)", async () => {
    const id = await newAccount(25);
    await store.spend(id, 1);
    await settle();
    await store.returnIdle(Date.now());
    expect(await leaseOf(id)).toBe(9);
  });

  test("an unknown account can't spend", async () => {
    await expect(store.spend(randomHex32(), 1)).rejects.toBeInstanceOf(InsufficientCreditsError);
  });

  test("Redis not connected → BillingUnavailableError, fast", async () => {
    const dead = new RedisClient("redis://127.0.0.1:1", {
      autoReconnect: false,
      enableOfflineQueue: false,
      connectionTimeout: 200,
    });
    const offline = new LeaseStore(dead, db, options());
    const started = Date.now();
    await expect(offline.spend(await newAccount(10), 1)).rejects.toBeInstanceOf(
      BillingUnavailableError
    );
    expect(Date.now() - started).toBeLessThan(100);
    dead.close();
  });

  test("Postgres totals stay consistent: credits in = credits out + left", async () => {
    const id = await newAccount(1_000);
    const big = new LeaseStore(redis, db, options({ size: 100, lowWater: 30 }));
    let spentTotal = 0;
    for (let i = 0; i < 40; i++) {
      const n = 1 + (i % 7);
      await big.spend(id, n);
      spentTotal += n;
    }
    await settle();
    expect(await big.available(id)).toBe(1_000 - spentTotal);
  });
});
