/**
 * UmSwap — unified swap-aggregator SDK
 * ------------------------------------
 * Higher-level wrapper over the per-provider SDKs under `./sdks/*`. Exposes
 * a single `umSwap.getSwap(chain, request)` call that fans out to every
 * supported aggregator in parallel, normalizes each upstream's response
 * into the shared `SwapAggRoute` shape, and returns them keyed by name.
 *
 * Per-aggregator upstream flow:
 *   - KyberSwap: GET /routes  → POST /route/build         (two-step)
 *   - 0x:        GET /swap/allowance-holder/quote          (single-step)
 *   - Uniswap:   POST /quote  → POST /swap (no signature)  (two-step)
 *
 * Lives in `src/lib/swap/` (not under `src/modules/`) so it can be reused
 * by anything that needs aggregated quotes — the `swapagg` HTTP module is
 * one consumer; future jobs (e.g. periodic price sampling) can import it
 * directly without going through the HTTP layer.
 *
 * The fan-out uses `Promise.allSettled` so one upstream failing or timing
 * out doesn't take the others down. The aggregate `status` reflects whether
 * all / some / no upstreams returned a route.
 */

import {
  KyberSwapClient,
  type BuildRouteData,
  type KyberSwapChain,
  type RouteSummary,
} from "./sdks/kyberswap/kyberswap";
import {
  ZeroxClient,
  type AllowanceHolderQuoteResponse,
  type ZeroxChainId,
} from "./sdks/zerox/zerox";
import {
  UniswapClient,
  isClassicQuote,
  type ClassicQuoteResponse,
  type SwapResponse as UniswapSwapResponse,
  type UniswapChainId,
} from "./sdks/uniswap/uniswap";
import { swapaggConfig } from "../../config/swapagg";
import type {
  SwapAggChain,
  SwapAggRequest,
  SwapAggResult,
  SwapAggRoute,
  SwapAggStatus,
} from "../../types/swapagg";

// Re-export the public types so callers can do
//   `import type { SwapAggRoute } from "../../lib/swap/um-swap"`
// instead of reaching into `src/types`.
export type {
  SwapAggChain,
  SwapAggRequest,
  SwapAggResult,
  SwapAggRoute,
  SwapAggStatus,
};

// --- Credentials -----------------------------------------------------------

/**
 * All three credentials are read once at module load. Failing fast here is
 * better than returning 500s at runtime when a particular aggregator's
 * branch is hit.
 *
 * The 0x env var starts with a digit, so we read it via the `process.env`
 * indexer rather than dot access (`process.env.0X_API_KEY` is invalid JS).
 */
const KYBERSWAP_CLIENT_ID = process.env.KYBERSWAP_CLIENT_ID;
const ZEROX_API_KEY = process.env.ZEROX_API_KEY;
const UNISWAP_API_KEY = process.env.UNISWAP_API_KEY;

if (!KYBERSWAP_CLIENT_ID) {
  throw new Error("KYBERSWAP_CLIENT_ID is not set");
}
if (!ZEROX_API_KEY) {
  throw new Error("ZEROX_API_KEY is not set");
}
if (!UNISWAP_API_KEY) {
  throw new Error("UNISWAP_API_KEY is not set");
}

// --- Clients ---------------------------------------------------------------

/**
 * Shared client instances. Each wrapper holds no per-request state so
 * reusing one across requests is safe and avoids re-allocating fetch state.
 */
const kyberSwapClient = new KyberSwapClient({ clientId: KYBERSWAP_CLIENT_ID });
const zeroxClient = new ZeroxClient({ apiKey: ZEROX_API_KEY });
const uniswapClient = new UniswapClient({ apiKey: UNISWAP_API_KEY });

// --- Chain mapping ---------------------------------------------------------

/**
 * Per-upstream chain identifiers. KyberSwap takes a slug (`"ethereum"`),
 * while 0x and Uniswap take numeric chain IDs. Centralising the mapping
 * keeps `umSwap.getSwap` symmetric across upstreams.
 */
interface AggregatorChainIds {
  kyberswap: KyberSwapChain;
  zerox: ZeroxChainId;
  uniswap: UniswapChainId;
}

/**
 * Chains we have fan-out support for. `SwapAggChain` (from `types/swapagg`)
 * is broader because the HTTP surface accepts any slug for forward compat;
 * at the SDK layer we explicitly enumerate the chains we have a mapping
 * for and throw a clear error otherwise.
 */
const SUPPORTED_CHAINS: Partial<Record<SwapAggChain, AggregatorChainIds>> = {
  ethereum: { kyberswap: "ethereum", zerox: 1, uniswap: 1 },
};

function resolveChain(chain: SwapAggChain): AggregatorChainIds {
  const ids = SUPPORTED_CHAINS[chain];
  if (!ids) {
    throw new Error(
      `umSwap: chain "${chain}" is not configured — add it to SUPPORTED_CHAINS in src/lib/swap/um-swap.ts`
    );
  }
  return ids;
}

// --- Raw payloads retained on `route.raw` ---------------------------------

/** KyberSwap payload retained on `route.raw` for later persistence. */
interface KyberSwapRaw {
  routeSummary: RouteSummary;
  routerAddress: string;
  build: BuildRouteData;
}

/** 0x payload retained on `route.raw`. The quote already carries everything. */
type ZeroxRaw = AllowanceHolderQuoteResponse;

/** Uniswap payload retained on `route.raw` — the quote and the swap calldata. */
interface UniswapRaw {
  quote: ClassicQuoteResponse;
  swap: UniswapSwapResponse["swap"];
}

// --- Helpers ---------------------------------------------------------------

/**
 * Price impact in bps from an aggregator's USD-denominated input/output.
 * Returns `undefined` when the USD reference is missing or zero (e.g.
 * exotic tokens with no oracle). Negative values (output worth more than
 * input — possible from arbitrage routes or oracle drift) are clamped to
 * 0 so the frontend can treat the field as a non-negative "loss to depth"
 * signal.
 */
function computePriceImpactBps(
  amountInUsd: string | undefined,
  amountOutUsd: string | undefined
): number | undefined {
  const inUsd = Number(amountInUsd);
  const outUsd = Number(amountOutUsd);
  if (!Number.isFinite(inUsd) || !Number.isFinite(outUsd) || inUsd <= 0) {
    return undefined;
  }
  return Math.max(0, Math.round((1 - outUsd / inUsd) * 10_000));
}

/**
 * Normalize a numeric string to decimal. The Uniswap Trading API returns
 * `transactionValue` (and sometimes other numeric fields) in hex form
 * (`0x...`) while KyberSwap and 0x return decimal. Frontends consuming
 * `BigInt(...)` accept either, but the wire format should be consistent
 * across routes so the response shape is comparable.
 *
 * Empty / undefined / non-numeric values pass through unchanged.
 */
function toDecimalString(value: string | undefined): string | undefined {
  if (value === undefined || value === "") return value;
  if (value.startsWith("0x") || value.startsWith("0X")) {
    try {
      return BigInt(value).toString(10);
    } catch {
      return value;
    }
  }
  return value;
}

/**
 * Per-aggregator AbortSignal that fires after `swapaggConfig.timeoutMs`.
 * A separate signal per upstream means one slow aggregator can't eat the
 * budget another fast one would have used. Two-step flows share one
 * signal across both calls — if the overall budget runs out mid-flow, the
 * second call aborts cleanly.
 */
function aggregatorTimeoutSignal(): AbortSignal {
  return AbortSignal.timeout(swapaggConfig.timeoutMs);
}

// --- Per-aggregator fetchers ----------------------------------------------

async function fetchKyberSwapRoute(
  chain: KyberSwapChain,
  req: SwapAggRequest
): Promise<SwapAggRoute> {
  const signal = aggregatorTimeoutSignal();
  const route = await kyberSwapClient.getRoute(
    {
      tokenIn: req.tokenIn,
      tokenOut: req.tokenOut,
      amountIn: req.amountIn,
      // Pass the user's wallet through as `origin` if they didn't supply
      // one — gives access to RFQ liquidity and avoids the limiter that
      // KyberSwap applies per-`sender`.
      origin: req.origin ?? req.sender,
      feeAmount: swapaggConfig.kyberswap.feeAmount,
      chargeFeeBy: swapaggConfig.kyberswap.chargeFeeBy,
      isInBps: swapaggConfig.kyberswap.isInBps,
      feeReceiver: swapaggConfig.kyberswap.feeReceiver,
    },
    { chain, signal }
  );

  const build = await kyberSwapClient.buildRoute(
    {
      routeSummary: route.routeSummary,
      sender: req.sender,
      recipient: req.recipient,
      origin: req.origin,
      deadline: req.deadline,
      slippageTolerance: req.slippageTolerance,
      source: req.source,
      referral: req.referral,
      enableGasEstimation: req.enableGasEstimation,
    },
    { chain, signal }
  );

  const raw: KyberSwapRaw = {
    routeSummary: route.routeSummary,
    routerAddress: route.routerAddress,
    build,
  };

  return {
    name: "kyberswap",
    tokenIn: req.tokenIn,
    tokenOut: req.tokenOut,
    amountIn: build.amountIn,
    amountOut: build.amountOut,
    amountInUsd: build.amountInUsd,
    amountOutUsd: build.amountOutUsd,
    priceImpactBps: computePriceImpactBps(build.amountInUsd, build.amountOutUsd),
    gas: build.gas,
    gasUsd: build.gasUsd,
    routerAddress: build.routerAddress,
    data: build.data,
    transactionValue: build.transactionValue,
    raw,
  };
}

async function fetchZeroxRoute(
  chainId: ZeroxChainId,
  req: SwapAggRequest
): Promise<SwapAggRoute> {
  const signal = aggregatorTimeoutSignal();
  const quote = await zeroxClient.getAllowanceHolderQuote(
    {
      sellToken: req.tokenIn,
      buyToken: req.tokenOut,
      sellAmount: req.amountIn,
      taker: req.sender,
      // `recipient` is not honored by 0x for wrap/unwrap, but it's safe to
      // pass for normal swaps — the API ignores it in those cases.
      recipient: req.recipient,
      // 0x exposes the EOA-origin field too; treat it the same as KyberSwap
      // and forward the caller-supplied `origin` if any.
      txOrigin: req.origin,
      // SwapAggRequest already uses bps — 0x's `slippageBps` is the same unit.
      slippageBps: req.slippageTolerance,
      // Integrator fee — both fields must be set together. `swapFeeToken`
      // is intentionally left undefined so 0x picks the fee token itself
      // (prefers stablecoins / highly liquid assets).
      swapFeeBps: swapaggConfig.zerox.swapFeeBps,
      swapFeeRecipient: swapaggConfig.zerox.swapFeeRecipient,
    },
    { chainId, signal }
  );

  // 0x signals "no route" via `{ liquidityAvailable: false, zid }`. Throw
  // here so Promise.allSettled marks this aggregator failed for the caller.
  if (quote.liquidityAvailable === false || !("mode" in quote)) {
    throw new Error("zerox: no liquidity available for this pair");
  }

  const amountIn =
    quote.mode === "exact-in" ? quote.sellAmount : quote.estimatedNetSellAmount;
  const tx = quote.transaction;
  // `transaction.gas` is typed `unknown` because 0x's spec leaves the shape
  // open; observed responses are decimal strings (gas-limit units). Use
  // when present, drop otherwise.
  const gas = typeof tx.gas === "string" ? tx.gas : undefined;

  return {
    name: "zerox",
    tokenIn: req.tokenIn,
    tokenOut: req.tokenOut,
    amountIn,
    amountOut: quote.buyAmount,
    // 0x doesn't expose USD-denominated input/output on AllowanceHolder.
    // Leaving amountInUsd/amountOutUsd/priceImpactBps undefined keeps the
    // frontend honest — it should not synthesize a price impact from a
    // missing oracle.
    gas,
    routerAddress: tx.to,
    data: tx.data,
    transactionValue: tx.value,
    raw: quote satisfies ZeroxRaw,
  };
}

async function fetchUniswapRoute(
  chainId: UniswapChainId,
  req: SwapAggRequest
): Promise<SwapAggRoute> {
  const signal = aggregatorTimeoutSignal();
  const quote = await uniswapClient.getQuote(
    {
      swapper: req.sender,
      tokenIn: req.tokenIn,
      tokenOut: req.tokenOut,
      tokenInChainId: chainId,
      tokenOutChainId: chainId,
      amount: req.amountIn,
      type: "EXACT_INPUT",
      // Uniswap takes slippage as a 0–100 percentage; SwapAggRequest is in
      // bps. Convert bps → percent (50 bps = 0.50%).
      slippageTolerance:
        req.slippageTolerance !== undefined
          ? req.slippageTolerance / 100
          : undefined,
      // Ask the API for the best price; we'll reject the response after
      // the fact if it came back as UniswapX (DUTCH_*, PRIORITY), since
      // those require the caller to sign an EIP-712 order off-chain and
      // don't fit a server-side fan-out that returns plain calldata. The
      // API rejects the `"CLASSIC"` preference outright (only `BEST_PRICE`
      // / `FASTEST` are accepted), so post-filtering is the only option.
      routingPreference: "BEST_PRICE",
      deadline: req.deadline,
      recipient: req.recipient,
      // Integrator fee taken from the OUTPUT token. Per the Trading API,
      // for EXACT_INPUT swaps the `output.amount` does NOT yet subtract
      // this — the realized fee is recorded on the response's
      // `portionBips` / `portionAmount`. The frontend should reconcile
      // when displaying a net "you receive" amount.
      integratorFees: [
        {
          bips: swapaggConfig.uniswap.bips,
          recipient: swapaggConfig.uniswap.recipient,
        },
      ],
    },
    { chainId, signal }
  );

  if (!isClassicQuote(quote)) {
    throw new Error(
      `uniswap: unexpected routing ${quote.routing} (expected CLASSIC/WRAP/UNWRAP)`
    );
  }

  // Submit the quote unsigned. For users with a legacy Universal Router
  // approval this returns valid calldata; for users on the Permit2 path
  // the API returns an empty `swap.data`, which we treat as a failure
  // (the frontend should fall back to KyberSwap / 0x or sign Permit2 in a
  // dedicated flow).
  const swap = await uniswapClient.getSwap({ quote }, { chainId, signal });

  if (!swap.swap?.data || swap.swap.data === "" || swap.swap.data === "0x") {
    throw new Error(
      "uniswap: empty swap.data — quote expired or Permit2 signature required"
    );
  }

  const raw: UniswapRaw = { quote, swap: swap.swap };

  return {
    name: "uniswap",
    tokenIn: req.tokenIn,
    tokenOut: req.tokenOut,
    amountIn: quote.quote.input.amount,
    amountOut: quote.quote.output.amount,
    // Uniswap's `gasUseEstimate` is the gas-limit estimate (units), which
    // is what `gas` represents across all aggregators. `gasFeeUSD` is the
    // already-converted dollar cost — prefer it over computing from
    // `gasFee` (wei) with a hardcoded ETH price.
    gas: quote.quote.gasUseEstimate,
    gasUsd: quote.quote.gasFeeUSD,
    routerAddress: swap.swap.to,
    data: swap.swap.data,
    // Uniswap returns `value` as hex (`0x...`); KyberSwap and 0x return
    // decimal. Normalize so the cross-aggregator response is comparable.
    transactionValue: toDecimalString(swap.swap.value) ?? swap.swap.value,
    raw,
  };
}

// --- Public surface --------------------------------------------------------

/**
 * The unified umbrella SDK. Currently exposes a single `getSwap` method;
 * future aggregator-agnostic operations (token metadata fan-out, gasless
 * order submission, etc.) belong here too.
 */
export const umSwap = {
  /**
   * Fan out to every supported aggregator on `chain` in parallel and
   * return whichever routes resolved within the per-aggregator budget.
   * Never throws for per-aggregator failures — those are reflected in the
   * `status` field and the absence of the failed aggregator from `routes`.
   *
   * Throws only when:
   *   - `chain` is not in `SUPPORTED_CHAINS` (programmer error).
   *   - The runtime is so degraded that even `Promise.allSettled` itself
   *     rejects (extremely rare; reraised verbatim).
   */
  async getSwap(
    chain: SwapAggChain,
    req: SwapAggRequest
  ): Promise<SwapAggResult> {
    const ids = resolveChain(chain);

    const [kyberResult, zeroxResult, uniswapResult] = await Promise.allSettled([
      fetchKyberSwapRoute(ids.kyberswap, req),
      fetchZeroxRoute(ids.zerox, req),
      fetchUniswapRoute(ids.uniswap, req),
    ]);

    const routes: Record<string, SwapAggRoute> = {};
    if (kyberResult.status === "fulfilled") {
      routes.kyberswap = kyberResult.value;
    }
    if (zeroxResult.status === "fulfilled") {
      routes.zerox = zeroxResult.value;
    }
    if (uniswapResult.status === "fulfilled") {
      routes.uniswap = uniswapResult.value;
    }

    const successCount = Object.keys(routes).length;
    const totalCount = 3;
    const status: SwapAggStatus =
      successCount === totalCount
        ? "success"
        : successCount === 0
          ? "failed"
          : "partial";

    return {
      id: Bun.randomUUIDv7(),
      timestamp: Date.now(),
      routes,
      meta: { chain, request: req },
      status,
    };
  },
};
