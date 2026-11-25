/**
 * Tests for the /rpc/* proxy endpoints. Privacy/passthrough behaviour is
 * exercised on /rpc/ethereum (every chain shares `RpcService.proxy`); the
 * routing table is checked for every chain.
 *
 * These tests replace `globalThis.fetch` with a mock that captures the
 * outbound request. That lets us assert privacy behaviour (stripped
 * headers, fixed User-Agent, byte-exact body passthrough) without making
 * real network calls.
 *
 * `afterEach` restores the original fetch so the mock cannot leak into
 * other test files (Bun may run test files in separate workers, but we
 * don't rely on that).
 *
 * Rate-limit counts live in Redis, so these tests need `REDIS_URL` pointing
 * at a disposable Redis. Every window under the rpc limiter's prefix is
 * cleared before each test. (`rpc.handle()` has no server, so requests
 * without an `X-Real-IP` header share the "" client key.)
 */

import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { rpc, rpcRateLimitStore } from "../modules/rpc";
import { redis } from "../lib/redis";
import { RateLimiterUnavailableError } from "../lib/redis-rate-limit";
import { rpcConfig } from "../config/rpc";

beforeAll(async () => {
  await redis.connect();
});

beforeEach(async () => {
  await rpcRateLimitStore.reset();
});

type FetchArgs = { url: string; init: RequestInit | undefined };

const UPSTREAM_RESPONSE_BODY = JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  result: "0x1234",
});

describe("POST /rpc/ethereum", () => {
  const originalFetch = globalThis.fetch;
  let lastCall: FetchArgs | null;
  let mockStatus: number;

  beforeEach(() => {
    lastCall = null;
    mockStatus = 200;

    // Replace fetch with a capturing mock. We accept the loose `any` here
    // because we're intentionally narrowing to the 2-arg form the proxy
    // actually uses.
    globalThis.fetch = (async (
      input: string | URL | Request,
      init?: RequestInit
    ) => {
      lastCall = {
        url: typeof input === "string" ? input : input.toString(),
        init,
      };
      return new Response(UPSTREAM_RESPONSE_BODY, {
        status: mockStatus,
        headers: { "content-type": "application/json" },
      });
    }) as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("forwards POST body byte-for-byte to upstream", async () => {
    const body = JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_blockNumber",
      params: [],
      id: 1,
    });

    const res = await rpc.handle(
      new Request("http://localhost/rpc/ethereum", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      })
    );

    expect(res.status).toBe(200);
    expect(await res.text()).toBe(UPSTREAM_RESPONSE_BODY);

    // Verify the upstream received the exact same bytes.
    expect(lastCall).not.toBeNull();
    const forwardedBody = new TextDecoder().decode(
      lastCall!.init!.body as ArrayBuffer
    );
    expect(forwardedBody).toBe(body);
  });

  test("strips identifying headers from the outbound request", async () => {
    await rpc.handle(
      new Request("http://localhost/rpc/ethereum", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "EvilBrowser/6.6 (Linux)",
          "accept-language": "en-US",
          referer: "https://customer.example.com/page",
          origin: "https://customer.example.com",
          cookie: "session=deadbeef",
          "x-forwarded-for": "203.0.113.42",
          "sec-ch-ua": '"Chromium";v="130"',
        },
        body: "{}",
      })
    );

    const fwd = new Headers(lastCall!.init!.headers as HeadersInit);

    // User-Agent is overridden to the fixed proxy value.
    expect(fwd.get("user-agent")).toBe("zxstim-rpc/1.0");

    // All identifying headers are dropped.
    expect(fwd.get("accept-language")).toBeNull();
    expect(fwd.get("referer")).toBeNull();
    expect(fwd.get("origin")).toBeNull();
    expect(fwd.get("cookie")).toBeNull();
    expect(fwd.get("x-forwarded-for")).toBeNull();
    expect(fwd.get("sec-ch-ua")).toBeNull();

    // Allowed headers pass through.
    expect(fwd.get("content-type")).toBe("application/json");
  });

  test("preserves the upstream HTTP status code", async () => {
    mockStatus = 503;

    const res = await rpc.handle(
      new Request("http://localhost/rpc/ethereum", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      })
    );

    expect(res.status).toBe(503);
  });

  test("response carries CORS headers for cross-origin callers", async () => {
    const res = await rpc.handle(
      new Request("http://localhost/rpc/ethereum", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://app.example.com",
        },
        body: "{}",
      })
    );

    // With `origin: true, credentials: false` the plugin sets `*`.
    expect(res.headers.get("access-control-allow-origin")).toBeTruthy();
  });

  test("OPTIONS preflight is handled locally (not proxied upstream)", async () => {
    const res = await rpc.handle(
      new Request("http://localhost/rpc/ethereum", {
        method: "OPTIONS",
        headers: {
          origin: "https://app.example.com",
          "access-control-request-method": "POST",
          "access-control-request-headers": "content-type",
        },
      })
    );

    // CORS plugin responded — no upstream call was made.
    expect(lastCall).toBeNull();
    expect(res.headers.get("access-control-allow-origin")).toBeTruthy();
  });
});

describe("chain routing", () => {
  const originalFetch = globalThis.fetch;
  let upstreamUrl: string | null;

  beforeEach(() => {
    upstreamUrl = null;
    globalThis.fetch = (async (input: string | URL | Request) => {
      upstreamUrl = typeof input === "string" ? input : input.toString();
      return new Response(UPSTREAM_RESPONSE_BODY, { status: 200 });
    }) as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // Each path must reach the upstream from its own env var. Catches a
  // copy-paste route pointing at the wrong chain (only detectable when the
  // env values differ, which they do in any real config).
  test.each([
    ["/rpc/ethereum", "ETHEREUM_RPC_URL"],
    ["/rpc/arbitrum", "ARBITRUM_RPC_URL"],
    ["/rpc/base", "BASE_RPC_URL"],
    ["/rpc/sepolia", "SEPOLIA_RPC_URL"],
    ["/rpc/arbitrum-sepolia", "ARBITRUM_SEPOLIA_RPC_URL"],
    ["/rpc/base-sepolia", "BASE_SEPOLIA_RPC_URL"],
  ])("%s proxies to %s", async (path, envVar) => {
    const res = await rpc.handle(
      new Request(`http://localhost${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      })
    );

    expect(res.status).toBe(200);
    expect(upstreamUrl).toBe(process.env[envVar]!);
  });
});

describe("rate limiting (Redis-backed)", () => {
  const originalFetch = globalThis.fetch;
  let upstreamCalls: number;

  const post = (headers: Record<string, string> = {}) =>
    rpc.handle(
      new Request("http://localhost/rpc/ethereum", {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: "{}",
      })
    );

  beforeEach(() => {
    upstreamCalls = 0;
    globalThis.fetch = (async () => {
      upstreamCalls++;
      return new Response(UPSTREAM_RESPONSE_BODY, { status: 200 });
    }) as unknown as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("allows `max` requests per window, then answers 429 without proxying", async () => {
    const { max } = rpcConfig.rateLimit;

    for (let i = 0; i < max; i++) {
      const res = await post();
      expect(res.status).toBe(200);
    }
    expect(upstreamCalls).toBe(max);

    const limited = await post();
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBeTruthy();
    expect(limited.headers.get("ratelimit-remaining")).toBe("0");
    expect(upstreamCalls).toBe(max); // the 429 never reached the upstream
  });

  // Needs TRUST_PROXY=1 at module load (set in deploy/compose.test.yaml and CI).
  test.if(process.env.TRUST_PROXY === "1")(
    "each client (X-Real-IP from nginx) gets its own bucket",
    async () => {
      const { max } = rpcConfig.rateLimit;
      for (let i = 0; i < max; i++) {
        expect((await post({ "x-real-ip": "203.0.113.1" })).status).toBe(200);
      }
      expect((await post({ "x-real-ip": "203.0.113.1" })).status).toBe(429);
      // A different client is unaffected by the first one's usage.
      expect((await post({ "x-real-ip": "203.0.113.2" })).status).toBe(200);
    }
  );

  test("fails closed: limiter unavailable → 503 with Retry-After and CORS, no upstream call", async () => {
    const original = rpcRateLimitStore.increment;
    rpcRateLimitStore.increment = async () => {
      throw new RateLimiterUnavailableError();
    };
    try {
      const res = await post({ origin: "https://app.example.com" });

      expect(res.status).toBe(503);
      expect(await res.text()).toBe("rate limiter unavailable");
      expect(res.headers.get("retry-after")).toBe(
        String(rpcConfig.rateLimit.unavailableRetryAfterSec)
      );
      expect(res.headers.get("access-control-allow-origin")).toBeTruthy();
      expect(upstreamCalls).toBe(0);
    } finally {
      rpcRateLimitStore.increment = original;
    }
  });
});
