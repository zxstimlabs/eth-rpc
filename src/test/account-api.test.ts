/**
 * Tests for the /v1 account endpoints (key registration, balance, claims).
 * Real Redis and Postgres; payments are inserted directly, standing in for
 * the on-chain indexer.
 */

import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { db, migrateDb } from "../db";
import { payments } from "../db/schema";
import { redis } from "../lib/redis";
import { keyHashOf, memoOf, parseHex32 } from "../lib/keccak";
import { account, accountRateLimitStore } from "../modules/account";
import { randomHex32 } from "./helpers";

const request = (
  method: string,
  path: string,
  { auth, body }: { auth?: string; body?: unknown } = {}
) =>
  account.handle(
    new Request(`http://localhost${path}`, {
      method,
      headers: {
        ...(auth ? { authorization: auth } : {}),
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  );

/** A wallet: account secret plus one API key, as the wallet would derive them. */
const wallet = () => {
  const secret = randomHex32();
  const key = randomHex32();
  return {
    accountAuth: `Account ${secret}`,
    keyAuth: `Bearer ${key}`,
    keyHash: keyHashOf(parseHex32(key)!),
  };
};

const register = (w: ReturnType<typeof wallet>) =>
  request("POST", "/v1/account/keys", { auth: w.accountAuth, body: { keyHash: w.keyHash } });

const recordPayment = (memo: string, credits: number) =>
  db.insert(payments).values({
    chainId: 1,
    txHash: randomHex32(),
    logIndex: 3,
    memo,
    token: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    amount: "5000000",
    credits,
  });

beforeAll(async () => {
  await redis.connect();
  await migrateDb();
});

beforeEach(async () => {
  await accountRateLimitStore.reset();
});

describe("/v1 account API", () => {
  test("register a key, then read the (empty) balance with it", async () => {
    const w = wallet();
    const created = await register(w);
    expect(created.status).toBe(201);
    expect((await register(w)).status).toBe(200); // idempotent

    const balance = await request("GET", "/v1/account", { auth: w.keyAuth });
    expect(balance.status).toBe(200);
    expect(await balance.json()).toEqual({ credits: 0 });
  });

  test("registration needs the account secret", async () => {
    const w = wallet();
    expect(
      (await request("POST", "/v1/account/keys", { body: { keyHash: w.keyHash } })).status
    ).toBe(401);
    expect(
      (await request("POST", "/v1/account/keys", { auth: "Account nope", body: { keyHash: w.keyHash } }))
        .status
    ).toBe(401);
    expect(
      (await request("POST", "/v1/account/keys", { auth: w.accountAuth, body: { keyHash: "0x1234" } }))
        .status
    ).toBe(422); // schema validation
  });

  test("claim a payment by its secret: credited once, then 409; unknown → 202", async () => {
    const w = wallet();
    await register(w);
    const paymentSecret = randomHex32();
    await recordPayment(memoOf(parseHex32(paymentSecret)!), 50_000);

    const claimed = await request("POST", "/v1/claims", {
      auth: w.keyAuth,
      body: { secret: paymentSecret },
    });
    expect(claimed.status).toBe(200);
    expect(await claimed.json()).toEqual({ status: "credited", credits: 50_000 });

    const again = await request("POST", "/v1/claims", {
      auth: w.keyAuth,
      body: { secret: paymentSecret },
    });
    expect(again.status).toBe(409);

    const pending = await request("POST", "/v1/claims", {
      auth: w.keyAuth,
      body: { secret: randomHex32() },
    });
    expect(pending.status).toBe(202);

    const balance = await request("GET", "/v1/account", { auth: w.keyAuth });
    expect(await balance.json()).toEqual({ credits: 50_000 });
  });

  test("the memo alone can't claim: posting the memo itself finds nothing", async () => {
    const w = wallet();
    await register(w);
    const paymentSecret = randomHex32();
    const memo = memoOf(parseHex32(paymentSecret)!);
    await recordPayment(memo, 10);

    const res = await request("POST", "/v1/claims", { auth: w.keyAuth, body: { secret: memo } });
    expect(res.status).toBe(202); // keccak(memo) matches no payment
  });

  test("claims and balance need a registered key", async () => {
    expect((await request("GET", "/v1/account", { auth: `Bearer ${randomHex32()}` })).status).toBe(401);
    expect(
      (await request("POST", "/v1/claims", { auth: `Bearer ${randomHex32()}`, body: { secret: randomHex32() } }))
        .status
    ).toBe(401);
  });

  test("revoke a key: it stops working; only the owner can revoke", async () => {
    const w = wallet();
    await register(w);
    const other = wallet();

    expect(
      (await request("DELETE", `/v1/account/keys/${w.keyHash}`, { auth: other.accountAuth })).status
    ).toBe(404);
    expect(
      (await request("DELETE", `/v1/account/keys/${w.keyHash}`, { auth: w.accountAuth })).status
    ).toBe(204);
    expect((await request("GET", "/v1/account", { auth: w.keyAuth })).status).toBe(401);
    expect((await register(w)).status).toBe(409); // revoked stays revoked
  });

  test("a key hash already used by another account → 409", async () => {
    const w = wallet();
    await register(w);
    const thief = { ...wallet(), keyHash: w.keyHash };
    expect((await register(thief)).status).toBe(409);
  });
});
