/**
 * Tests for AccountStore (keys) and claimPayment against a real Redis and
 * Postgres. Fresh random ids per test; a private Redis prefix per run.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { db, migrateDb } from "../db";
import { payments } from "../db/schema";
import { redis } from "../lib/redis";
import { AccountStore, type AccountOptions } from "../lib/billing/accounts";
import { claimPayment } from "../lib/billing/claims";
import { RedisRateLimitContext } from "../lib/redis-rate-limit";
import { accountRow, newAccount, randomHex32 } from "./helpers";

const RUN = `test:${crypto.randomUUID()}:`;

const makeStore = (overrides: Partial<AccountOptions> = {}) =>
  new AccountStore(redis, db, {
    prefix: RUN,
    timeoutMs: 500,
    maxKeysPerAccount: 20,
    keyCacheMs: 60_000,
    unknownKeyCacheMs: 60_000,
    ...overrides,
  });

beforeAll(async () => {
  await redis.connect();
  await migrateDb();
});

afterAll(async () => {
  await new RedisRateLimitContext(redis, { prefix: RUN, timeoutMs: 2_000 }).reset();
});

describe("AccountStore", () => {
  test("register creates the account on first use; the key then resolves to it", async () => {
    const store = makeStore();
    const accountId = randomHex32();
    const keyHash = randomHex32();

    expect(await store.registerKey(accountId, keyHash)).toBe("created");
    expect(await store.resolveKey(keyHash)).toBe(accountId);
    expect((await accountRow(accountId)).balance).toBe(0);
    expect(await store.registerKey(accountId, keyHash)).toBe("exists");
  });

  test("a key hash belongs to one account", async () => {
    const store = makeStore();
    const keyHash = randomHex32();
    await store.registerKey(randomHex32(), keyHash);
    expect(await store.registerKey(randomHex32(), keyHash)).toBe("conflict");
  });

  test("unknown keys resolve to null and are negative-cached; registering clears that", async () => {
    const store = makeStore();
    const keyHash = randomHex32();

    expect(await store.resolveKey(keyHash)).toBeNull();
    expect(await redis.get(`${RUN}key:${keyHash}`)).toBe(""); // cached as unknown

    const accountId = randomHex32();
    await store.registerKey(accountId, keyHash);
    expect(await store.resolveKey(keyHash)).toBe(accountId);
  });

  test("revoked keys stop resolving immediately and can't be re-registered", async () => {
    const store = makeStore();
    const accountId = randomHex32();
    const keyHash = randomHex32();
    await store.registerKey(accountId, keyHash);
    expect(await store.resolveKey(keyHash)).toBe(accountId); // now cached

    expect(await store.revokeKey(accountId, keyHash)).toBe(true);
    expect(await store.resolveKey(keyHash)).toBeNull();
    expect(await store.registerKey(accountId, keyHash)).toBe("revoked");
  });

  test("only the owning account can revoke a key", async () => {
    const store = makeStore();
    const owner = randomHex32();
    const keyHash = randomHex32();
    await store.registerKey(owner, keyHash);

    expect(await store.revokeKey(randomHex32(), keyHash)).toBe(false);
    expect(await store.resolveKey(keyHash)).toBe(owner);
  });

  test("active keys per account are capped", async () => {
    const store = makeStore({ maxKeysPerAccount: 2 });
    const accountId = randomHex32();
    const first = randomHex32();
    await store.registerKey(accountId, first);
    await store.registerKey(accountId, randomHex32());
    expect(await store.registerKey(accountId, randomHex32())).toBe("limit");

    // Revoking one frees a slot.
    await store.revokeKey(accountId, first);
    expect(await store.registerKey(accountId, randomHex32())).toBe("created");
  });
});

describe("claimPayment", () => {
  const recordPayment = (memo: string, credits: number) =>
    db.insert(payments).values({
      chainId: 8453,
      txHash: randomHex32(),
      logIndex: 0,
      memo,
      token: "0x0000000000000000000000000000000000000000",
      amount: "1000000",
      credits,
    });

  test("credits every unclaimed payment with the memo, once", async () => {
    const accountId = await newAccount(5);
    const memo = randomHex32();
    await recordPayment(memo, 100);
    await recordPayment(memo, 50);

    expect(await claimPayment(db, accountId, memo)).toEqual({ status: "credited", credits: 150 });
    expect((await accountRow(accountId)).balance).toBe(155);
    expect(await claimPayment(db, accountId, memo)).toEqual({ status: "already-claimed" });
    expect((await accountRow(accountId)).balance).toBe(155);
  });

  test("a memo not seen on-chain yet is pending", async () => {
    expect(await claimPayment(db, await newAccount(), randomHex32())).toEqual({ status: "pending" });
  });

  test("a later payment reusing a claimed memo is claimable again", async () => {
    const accountId = await newAccount();
    const memo = randomHex32();
    await recordPayment(memo, 20);
    await claimPayment(db, accountId, memo);
    await recordPayment(memo, 30);

    expect(await claimPayment(db, accountId, memo)).toEqual({ status: "credited", credits: 30 });
    expect((await accountRow(accountId)).balance).toBe(50);
  });

  test("two claims racing for one payment credit exactly one account", async () => {
    const a = await newAccount();
    const b = await newAccount();
    const memo = randomHex32();
    await recordPayment(memo, 100);

    const results = await Promise.all([claimPayment(db, a, memo), claimPayment(db, b, memo)]);
    expect(results.filter((r) => r.status === "credited")).toHaveLength(1);
    expect(results.filter((r) => r.status === "already-claimed")).toHaveLength(1);
    expect((await accountRow(a)).balance + (await accountRow(b)).balance).toBe(100);
  });

  test("the payments table never records who claimed", async () => {
    const accountId = await newAccount();
    const memo = randomHex32();
    await recordPayment(memo, 10);
    await claimPayment(db, accountId, memo);

    const [row] = await db.select().from(payments).where(eq(payments.memo, memo));
    expect(row!.claimed).toBe(true);
    expect(JSON.stringify(row)).not.toContain(accountId.slice(2));
  });
});
