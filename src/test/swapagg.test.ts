/**
 * Tests for the /swapagg/ethereum endpoint.
 *
 * Like `prices.test.ts`, this test hits real upstreams — in this case
 * KyberSwap, 0x (AllowanceHolder), and Uniswap (Trading API) — using the
 * credentials in `.env.local`. Mocking would require hand-crafting three
 * sets of response envelopes and is too fragile to be worth maintaining;
 * the value of this test is verifying that a real ETH→USDC quote
 * round-trips through each aggregator and produces broadcastable calldata.
 *
 * The fan-out is non-deterministic: any of the three upstreams can time
 * out under load. The test therefore allows a `"partial"` status as long
 * as at least one aggregator returned a route, and gates each
 * aggregator-specific assertion on that aggregator actually appearing in
 * `body.routes`.
 *
 * The full request is made once in `beforeAll` so we only consume a single
 * unit of the rate-limit budget (max 10/min) and one round-trip of latency.
 */

import { beforeAll, describe, expect, test } from "bun:test";
import { swapagg } from "../modules/swapagg";
import type { SwapAggRequest, SwapAggResult } from "../types/swapagg";

// Native ETH is encoded as the zero address by each SDK and translated to
// the upstream-specific sentinel (0xEeee… for 0x, 0xeeee… for KyberSwap).
const NATIVE_ETH = "0x0000000000000000000000000000000000000000";
// Canonical USDC on Ethereum mainnet (6 decimals).
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
// Public well-known address used as sender/recipient. Tests don't broadcast,
// so any non-zero EOA works — vitalik.eth is convenient and well-known.
const TEST_WALLET = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
// 0.01 ETH in wei — small enough to keep price impact tiny on a deep pair.
const AMOUNT_IN = "10000000000000000";

/**
 * Aggregators the service is expected to fan out to. Each is exercised by
 * its own `describe.each` block; per-aggregator tests early-return when
 * the route is absent (transient upstream failure) so the overall test
 * suite tolerates the documented "partial" status while still verifying
 * shape for whichever aggregators did return.
 */
const EXPECTED_AGGREGATORS = ["kyberswap", "zerox", "uniswap"] as const;
type ExpectedAggregator = (typeof EXPECTED_AGGREGATORS)[number];

const REQUEST_BODY: SwapAggRequest = {
  tokenIn: NATIVE_ETH,
  tokenOut: USDC,
  amountIn: AMOUNT_IN,
  sender: TEST_WALLET,
  recipient: TEST_WALLET,
  slippageTolerance: 50,
};

describe("POST /swapagg/ethereum (real ETH→USDC quote)", () => {
  let status: number;
  let body: SwapAggResult;

  beforeAll(async () => {
    const res = await swapagg.handle(
      new Request("http://localhost/swapagg/ethereum", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(REQUEST_BODY),
      })
    );
    status = res.status;
    body = (await res.json()) as SwapAggResult;
  }, 30_000);

  // --- envelope --------------------------------------------------------------

  test("responds 200", () => {
    expect(status).toBe(200);
  });

  test("envelope has id, timestamp, routes, meta, status", () => {
    expect(typeof body.id).toBe("string");
    expect(body.id.length).toBeGreaterThan(0);
    expect(typeof body.timestamp).toBe("number");
    expect(body.timestamp).toBeGreaterThan(0);
    expect(body.routes).toBeDefined();
    expect(body.meta).toBeDefined();
  });

  test("status is 'success' or 'partial' (fan-out tolerates one upstream timeout)", () => {
    expect(["success", "partial"]).toContain(body.status);
  });

  test("at least one expected aggregator returned a route", () => {
    const returned = EXPECTED_AGGREGATORS.filter((n) => body.routes[n]);
    expect(returned.length).toBeGreaterThan(0);
  });

  test("status reflects how many aggregators returned", () => {
    const returned = EXPECTED_AGGREGATORS.filter((n) => body.routes[n]).length;
    if (returned === EXPECTED_AGGREGATORS.length) {
      expect(body.status).toBe("success");
    } else if (returned > 0) {
      expect(body.status).toBe("partial");
    } else {
      expect(body.status).toBe("failed");
    }
  });

  test("meta echoes the request and chain", () => {
    expect(body.meta.chain).toBe("ethereum");
    expect(body.meta.request.tokenIn).toBe(NATIVE_ETH);
    expect(body.meta.request.tokenOut).toBe(USDC);
    expect(body.meta.request.amountIn).toBe(AMOUNT_IN);
    expect(body.meta.request.sender).toBe(TEST_WALLET);
    expect(body.meta.request.recipient).toBe(TEST_WALLET);
  });

  test("response is marked uncacheable", async () => {
    const res = await swapagg.handle(
      new Request("http://localhost/swapagg/ethereum", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(REQUEST_BODY),
      })
    );
    expect(res.headers.get("cache-control")).toBe("no-store");
  }, 30_000);

  // --- per-aggregator generic checks -----------------------------------------
  //
  // These tests run for every aggregator in `EXPECTED_AGGREGATORS`. When a
  // particular aggregator failed upstream, its `body.routes[name]` is
  // undefined and the test returns early (covered by the "at least one
  // returned" envelope assertion above).

  // `describe.each` rejects readonly tuples (the type from `as const`) — spread
  // into a mutable array. The callback's `name` param is annotated explicitly
  // to recover the narrow `ExpectedAggregator` type the spread loses.
  describe.each([...EXPECTED_AGGREGATORS] as ExpectedAggregator[])(
    "%s route",
    (name: ExpectedAggregator) => {
    test("name matches the route key", () => {
      const r = body.routes[name];
      if (!r) return;
      expect(r.name).toBe(name);
    });

    test("carries broadcastable calldata", () => {
      const r = body.routes[name];
      if (!r) return;
      expect(r.routerAddress.startsWith("0x")).toBe(true);
      expect(r.routerAddress.length).toBe(42);
      expect(r.data.startsWith("0x")).toBe(true);
      // Real swap calldata is hundreds of bytes — anything trivially short
      // would mean we got an empty/malformed build.
      expect(r.data.length).toBeGreaterThan(10);
    });

    test("transactionValue is decimal wei matching amountIn for ETH input", () => {
      const r = body.routes[name];
      if (!r) return;
      // ETH→ERC20: msg.value must equal amountIn. All three aggregators
      // must report this as a decimal string (the service normalizes
      // Uniswap's hex-encoded `value` to match KyberSwap and 0x).
      expect(/^\d+$/.test(r.transactionValue)).toBe(true);
      expect(r.transactionValue).toBe(AMOUNT_IN);
    });

    test("quote fields reflect the input swap", () => {
      const r = body.routes[name];
      if (!r) return;
      expect(r.tokenIn).toBe(NATIVE_ETH);
      expect(r.tokenOut).toBe(USDC);
      expect(r.amountIn).toBe(AMOUNT_IN);
      // amountOut is a positive integer string in USDC base units (6 decimals).
      expect(/^\d+$/.test(r.amountOut)).toBe(true);
      expect(BigInt(r.amountOut)).toBeGreaterThan(0n);
    });

    test("amountOut is in the ballpark of ETH/USDC mid-price", () => {
      const r = body.routes[name];
      if (!r) return;
      // 0.01 ETH ≈ $20–50 of USDC at any plausible ETH price. Tightens the
      // assertion beyond just "> 0" so a bogus response (wrong decimals,
      // missing zeros) doesn't slip through.
      const out = Number(r.amountOut);
      expect(out).toBeGreaterThan(10 * 1_000_000); // > 10 USDC
      expect(out).toBeLessThan(1_000 * 1_000_000); // < 1000 USDC
    });

    test("priceImpactBps is a non-negative number when USD reference is present", () => {
      const r = body.routes[name];
      if (!r) return;
      // Only KyberSwap exposes USD-denominated input/output today; 0x and
      // Uniswap leave amountInUsd/amountOutUsd undefined and therefore
      // priceImpactBps undefined too. The check is gated on those being
      // present, so it remains a no-op for the latter two.
      if (r.amountInUsd && r.amountOutUsd && Number(r.amountInUsd) > 0) {
        expect(typeof r.priceImpactBps).toBe("number");
        expect(r.priceImpactBps).toBeGreaterThanOrEqual(0);
        // 0.01 ETH on a deep pair like ETH/USDC should be well under 1%.
        expect(r.priceImpactBps).toBeLessThan(100);
      }
    });

    test("raw upstream payload is preserved on the route", () => {
      const r = body.routes[name];
      if (!r) return;
      // We don't enforce a deep shape on `raw` here — the contract is
      // "kept verbatim for DB persistence". Per-aggregator raw-shape
      // sanity checks live in their own `describe` blocks below.
      expect(r.raw).toBeDefined();
      expect(typeof r.raw).toBe("object");
    });
  }
  );

  // --- per-aggregator raw shape sanity checks --------------------------------
  //
  // Each aggregator has a different upstream response shape. We don't deep-
  // assert (the SDKs already type the response), but we sanity-check that
  // the fields a downstream consumer might look up — to debug a quote or
  // persist it — are actually present.

  describe("kyberswap raw shape (when present)", () => {
    test("carries routeSummary, routerAddress, build", () => {
      const r = body.routes.kyberswap;
      if (!r) return;
      const raw = r.raw as Record<string, unknown>;
      expect(raw.routeSummary).toBeDefined();
      expect(raw.routerAddress).toBeDefined();
      expect(raw.build).toBeDefined();
    });
  });

  describe("zerox raw shape (when present)", () => {
    test("is a successful AllowanceHolderQuoteResponse with a transaction", () => {
      const r = body.routes.zerox;
      if (!r) return;
      const raw = r.raw as Record<string, unknown>;
      // Service only resolves zerox when liquidity is available, so we
      // should always see the discriminated `exact-in`/`exact-out` shape
      // here (never the `liquidityAvailable: false` variant).
      expect(raw.liquidityAvailable).toBe(true);
      expect(raw.mode).toBeDefined();
      expect(["exact-in", "exact-out"]).toContain(raw.mode as string);
      expect(raw.buyAmount).toBeDefined();
      expect(raw.transaction).toBeDefined();
      const tx = raw.transaction as Record<string, unknown>;
      expect(typeof tx.to).toBe("string");
      expect(typeof tx.data).toBe("string");
      expect(typeof tx.value).toBe("string");
    });
  });

  describe("uniswap raw shape (when present)", () => {
    test("carries a CLASSIC quote and a swap calldata blob", () => {
      const r = body.routes.uniswap;
      if (!r) return;
      const raw = r.raw as Record<string, unknown>;
      expect(raw.quote).toBeDefined();
      expect(raw.swap).toBeDefined();
      // Service forces post-filtering for CLASSIC/WRAP/UNWRAP (it can't
      // sign UniswapX orders on the server), so the routing must be one
      // of those three when the route is present.
      const quote = raw.quote as Record<string, unknown>;
      expect(["CLASSIC", "WRAP", "UNWRAP"]).toContain(quote.routing as string);
      const swap = raw.swap as Record<string, unknown>;
      expect(typeof swap.to).toBe("string");
      expect(typeof swap.data).toBe("string");
    });
  });
});

// --- body validation -------------------------------------------------------

describe("POST /swapagg/ethereum body validation", () => {
  test("rejects requests missing required fields", async () => {
    const res = await swapagg.handle(
      new Request("http://localhost/swapagg/ethereum", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tokenIn: NATIVE_ETH }),
      })
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  test("rejects GET (the route is POST-only)", async () => {
    const res = await swapagg.handle(
      new Request("http://localhost/swapagg/ethereum")
    );
    // Elysia returns 404 for an unhandled method on a known path.
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
