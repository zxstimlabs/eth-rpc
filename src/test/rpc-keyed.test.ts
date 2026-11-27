/**
 * Tests for the billed route `/rpc/{chain}/{key}` (rpcKeyed). Real Redis
 * and Postgres; `globalThis.fetch` is mocked, so no upstream is contacted.
 * Each test uses a fresh account with its own credits.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { migrateDb } from "../db";
import { redis } from "../lib/redis";
import { accountStore, leaseStore } from "../lib/billing";
import { BillingUnavailableError } from "../lib/billing/errors";
import { accountIdOf, keyHashOf, parseHex32 } from "../lib/keccak";
import { rpcKeyed, rpcKeyedRateLimitStore } from "../modules/rpc";
import { randomHex32, setBalance } from "./helpers";

/** A registered API key for a fresh account holding `credits`. */
const paidKey = async (credits: number) => {
  const accountId = accountIdOf(parseHex32(randomHex32())!);
  const key = randomHex32();
  await accountStore.registerKey(accountId, keyHashOf(parseHex32(key)!));
  await setBalance(accountId, credits);
  return { key: key.slice(2), accountId };
};

const call = (method = "eth_chainId", id = 1) => ({ jsonrpc: "2.0", id, method, params: [] });

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  rpcKeyed.handle(
    new Request(`http://localhost${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );

const remaining = (res: Response) => Number(res.headers.get("x-credits-remaining"));

const originalFetch = globalThis.fetch;
let upstream: { calls: number; status: number; throws: boolean; lastBody: string | null };

beforeAll(async () => {
  await redis.connect();
  await migrateDb();
});

beforeEach(async () => {
  await rpcKeyedRateLimitStore.reset();
  upstream = { calls: 0, status: 200, throws: false, lastBody: null };
  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    upstream.calls++;
    upstream.lastBody = new TextDecoder().decode(init?.body as ArrayBuffer);
    if (upstream.throws) throw new Error("connection refused");
    return new Response('{"jsonrpc":"2.0","id":1,"result":"0x1"}', {
      status: upstream.status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("POST /rpc/{chain}/{key}", () => {
  test("charges 1 credit per call and reports what's left", async () => {
    const { key } = await paidKey(100);

    const one = await post(`/rpc/ethereum/${key}`, call());
    expect(one.status).toBe(200);
    expect(remaining(one)).toBe(99);

    const batch = await post(`/rpc/base/${key}`, [call("a", 1), call("b", 2), call("c", 3)]);
    expect(batch.status).toBe(200);
    expect(remaining(batch)).toBe(96);
    expect(upstream.calls).toBe(2);
  });

  test("forwards the body byte-for-byte (counting doesn't rewrite it)", async () => {
    const { key } = await paidKey(10);
    const body = '{ "jsonrpc":"2.0",  "id":7, "method":"eth_blockNumber", "params":[] }';
    await post(`/rpc/sepolia/${key}`, body);
    expect(upstream.lastBody).toBe(body);
  });

  test("accepts the key with a 0x prefix too", async () => {
    const { key } = await paidKey(10);
    expect((await post(`/rpc/ethereum/0x${key}`, call())).status).toBe(200);
  });

  test("402 with a JSON-RPC error when out of credits, and nothing is proxied", async () => {
    const { key } = await paidKey(2);
    expect((await post(`/rpc/ethereum/${key}`, call())).status).toBe(200);
    expect((await post(`/rpc/ethereum/${key}`, call())).status).toBe(200);

    const res = await post(`/rpc/ethereum/${key}`, call(), { origin: "https://app.example.com" });
    expect(res.status).toBe(402);
    expect(((await res.json()) as { error: { message: string } }).error.message).toBe(
      "out of credits"
    );
    expect(res.headers.get("access-control-allow-origin")).toBeTruthy();
    expect(upstream.calls).toBe(2);
  });

  test("a batch costing more than the balance is refused whole", async () => {
    const { key } = await paidKey(2);
    const res = await post(`/rpc/ethereum/${key}`, [call("a", 1), call("b", 2), call("c", 3)]);
    expect(res.status).toBe(402);
    expect(upstream.calls).toBe(0);
  });

  test("upstream 5xx / 429 is refunded", async () => {
    const { key } = await paidKey(10);
    upstream.status = 503;
    const failed = await post(`/rpc/ethereum/${key}`, call());
    expect(failed.status).toBe(503);
    expect(remaining(failed)).toBe(10);

    upstream.status = 429;
    expect(remaining(await post(`/rpc/ethereum/${key}`, call()))).toBe(10);

    upstream.status = 200;
    expect(remaining(await post(`/rpc/ethereum/${key}`, call()))).toBe(9);
  });

  test("upstream unreachable → 502, refunded", async () => {
    const { key, accountId } = await paidKey(10);
    upstream.throws = true;
    expect((await post(`/rpc/ethereum/${key}`, call())).status).toBe(502);
    expect(await leaseStore.available(accountId)).toBe(10);
  });

  test("invalid or blocked requests are refused without charge", async () => {
    const { key, accountId } = await paidKey(10);
    expect((await post(`/rpc/ethereum/${key}`, "{not json")).status).toBe(400);
    expect((await post(`/rpc/ethereum/${key}`, call("debug_traceTransaction"))).status).toBe(400);
    const tooBig = Array.from({ length: 101 }, (_, i) => call("eth_chainId", i));
    expect((await post(`/rpc/ethereum/${key}`, tooBig)).status).toBe(400);
    expect(upstream.calls).toBe(0);
    expect(await leaseStore.available(accountId)).toBe(10);
  });

  test("bad, unknown and revoked keys → 401", async () => {
    expect((await post(`/rpc/ethereum/not-a-key`, call())).status).toBe(401);
    expect((await post(`/rpc/ethereum/${randomHex32().slice(2)}`, call())).status).toBe(401);

    const { key, accountId } = await paidKey(10);
    await accountStore.revokeKey(accountId, keyHashOf(parseHex32(key)!));
    expect((await post(`/rpc/ethereum/${key}`, call())).status).toBe(401);
    expect(upstream.calls).toBe(0);
  });

  test("unknown chain → 404; non-POST → 405", async () => {
    const { key } = await paidKey(10);
    expect((await post(`/rpc/dogecoin/${key}`, call())).status).toBe(404);
    const get = await rpcKeyed.handle(new Request(`http://localhost/rpc/ethereum/${key}`));
    expect(get.status).toBe(405);
  });

  test("billing unavailable → 503 with Retry-After, nothing proxied", async () => {
    const { key } = await paidKey(10);
    const original = leaseStore.spend;
    leaseStore.spend = async () => {
      throw new BillingUnavailableError();
    };
    try {
      const res = await post(`/rpc/ethereum/${key}`, call());
      expect(res.status).toBe(503);
      expect(res.headers.get("retry-after")).toBe("5");
      expect(upstream.calls).toBe(0);
    } finally {
      leaseStore.spend = original;
    }
  });

  test("the browser may read X-Credits-Remaining (CORS expose)", async () => {
    const { key } = await paidKey(10);
    const res = await post(`/rpc/ethereum/${key}`, call(), { origin: "https://app.example.com" });
    expect((res.headers.get("access-control-expose-headers") ?? "").toLowerCase()).toContain(
      "x-credits-remaining"
    );
  });
});
