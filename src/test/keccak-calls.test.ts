/**
 * Pure unit tests: Ethereum keccak helpers (src/lib/keccak.ts) and JSON-RPC
 * call counting (src/lib/billing/calls.ts). No Redis or Postgres needed.
 */

import { describe, expect, test } from "bun:test";
import {
  accountIdOf,
  keccakHex,
  keyHashOf,
  memoOf,
  normalizeHex32,
  parseHex32,
} from "../lib/keccak";
import { countCalls } from "../lib/billing/calls";

const hex = (byte: string) => parseHex32(`0x${byte.repeat(32)}`)!;

describe("keccak", () => {
  test("is Ethereum's Keccak-256, not NIST SHA3-256", () => {
    // keccak256("") — SHA3-256("") would be 0xa7ffc6f8…
    expect(keccakHex(new Uint8Array())).toBe(
      "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"
    );
  });

  // Fixed vectors, shared with deploy/smoke-test.sh (which can't compute
  // keccak in bash) and the wallet. Don't change them without updating both.
  test("account id, key hash and memo vectors", () => {
    expect(accountIdOf(hex("11"))).toBe(
      "0x0363c4eebeccc707e44b819fa9dfe2df56f4e9ed7b656c8580c0611c22a9df5f"
    );
    expect(keyHashOf(hex("22"))).toBe(
      "0xc4bd59e1394781d1c7bf20a2c0b30c2acc9fbdd52dc5e0d76917de4034ebdf59"
    );
    expect(memoOf(hex("33"))).toBe(
      "0x02cc96397d444c8ebdd3c75f2c53fc945bed8aab1e8da3f22ecca96cd45f8c57"
    );
  });

  // Computed in Solidity by zxstimlabs/rpc-pay-contracts (test_memoVectors):
  // secret_0 = keccak256(abi.encodePacked(0x11…11, "zxstim-rpc/pay/v1", uint256(0))).
  test("matches the contract repo's Solidity vectors", () => {
    const tag = new TextEncoder().encode("zxstim-rpc/pay/v1");
    const n0 = new Uint8Array(32); // uint256(0), big-endian
    const secret0 = keccakHex(hex("11"), tag, n0);
    expect(secret0).toBe("0xac650f8aa93b37c10812ee360ce77fdf5d780b56f6341b946537505f9f67e445");
    expect(memoOf(parseHex32(secret0)!)).toBe(
      "0xc5e67ffdd63e0e0ba0977564cf874f137c18fb138ea3153835c39a1c375d5541"
    );
  });

  test("parseHex32 accepts 32 bytes of hex with or without 0x, nothing else", () => {
    expect(parseHex32("ab".repeat(32))).toEqual(hex("ab"));
    expect(normalizeHex32("0X" + "AB".repeat(32))).toBe(`0x${"ab".repeat(32)}`);
    expect(parseHex32("ab".repeat(31))).toBeNull();
    expect(parseHex32("zz".repeat(32))).toBeNull();
    expect(parseHex32(undefined)).toBeNull();
  });
});

describe("countCalls", () => {
  const opts = { maxBatch: 3, blockedMethodPrefixes: ["debug_", "trace_"] };
  const call = (method: string) => ({ jsonrpc: "2.0", id: 1, method, params: [] });

  test("one call → 1; a batch of N → N", () => {
    expect(countCalls(JSON.stringify(call("eth_chainId")), opts)).toEqual({ ok: true, calls: 1 });
    expect(countCalls(JSON.stringify([call("a"), call("b"), call("c")]), opts)).toEqual({
      ok: true,
      calls: 3,
    });
  });

  test.each([
    ["not json", "{", -32700],
    ["empty batch", "[]", -32600],
    ["batch too big", JSON.stringify([call("a"), call("b"), call("c"), call("d")]), -32600],
    ["no method", JSON.stringify({ id: 1 }), -32600],
    ["a scalar", "42", -32600],
    ["blocked debug_", JSON.stringify(call("debug_traceTransaction")), -32601],
    ["blocked trace_ in a batch", JSON.stringify([call("eth_call"), call("trace_block")]), -32601],
  ])("rejects %s", (_name, body, code) => {
    const result = countCalls(body, opts);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe(code);
  });
});
