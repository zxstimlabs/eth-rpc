/**
 * Tests for client identification (src/lib/client-id.ts): which IP the
 * rate limiter keys on, and that only a salted digest leaves the helper.
 */

import { describe, expect, test } from "bun:test";
import { clientIp, hashClientIp } from "../lib/client-id";

/** Minimal stand-in for Bun's server: the TCP peer is always `peer`. */
const serverWithPeer = (peer: string) =>
  ({ requestIP: () => ({ address: peer, family: "IPv4", port: 1 }) }) as never;

const req = (headers: Record<string, string> = {}) =>
  new Request("http://localhost/rpc/ethereum", { headers });

describe("clientIp", () => {
  test("trustProxy: X-Real-IP wins over the TCP peer", () => {
    expect(clientIp(req({ "x-real-ip": "203.0.113.7" }), serverWithPeer("172.18.0.1"), true)).toBe(
      "203.0.113.7"
    );
  });

  test("without trustProxy, a client-sent X-Real-IP is ignored", () => {
    expect(clientIp(req({ "x-real-ip": "203.0.113.7" }), serverWithPeer("198.51.100.9"), false)).toBe(
      "198.51.100.9"
    );
  });

  test("trustProxy but no (or blank) header → falls back to the TCP peer", () => {
    expect(clientIp(req(), serverWithPeer("172.18.0.1"), true)).toBe("172.18.0.1");
    expect(clientIp(req({ "x-real-ip": "  " }), serverWithPeer("172.18.0.1"), true)).toBe("172.18.0.1");
  });

  test("no server and no header → undefined (caller uses the shared '' bucket)", () => {
    expect(clientIp(req(), null, true)).toBeUndefined();
    expect(clientIp(req(), undefined, false)).toBeUndefined();
  });

  test("IPv6 addresses pass through unchanged", () => {
    expect(clientIp(req({ "x-real-ip": "2001:db8::1" }), null, true)).toBe("2001:db8::1");
  });
});

describe("hashClientIp", () => {
  test("is a 64-hex digest that doesn't contain the IP", () => {
    const h = hashClientIp("203.0.113.7");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain("203.0.113.7");
  });

  test("same IP → same key (within this process); different IPs → different keys", () => {
    expect(hashClientIp("203.0.113.7")).toBe(hashClientIp("203.0.113.7"));
    expect(hashClientIp("203.0.113.7")).not.toBe(hashClientIp("203.0.113.8"));
  });
});
