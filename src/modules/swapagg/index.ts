/**
 * Swap Aggregator Module (controller)
 * -----------------------------------
 * Exposes `/swapagg/*` endpoints that fan out to KyberSwap, 0x, and
 * Uniswap via the umbrella SDK and return a normalized routes envelope.
 * Same privacy and rate-limit posture as the rpc/prices modules: open
 * CORS, salted-hash client identity, no request logging.
 */

import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { rateLimit } from "elysia-rate-limit";
import { hashClientIp } from "../../lib/client-id";
import { SwapAggService } from "./service";
import { KyberSwapError } from "../../lib/swap/sdks/kyberswap/kyberswap";

// --- Configuration ---------------------------------------------------------

/**
 * Aggregator credentials. Read once at module load from `.env.local`
 * (Bun auto-loads it). Each is required so the process refuses to start
 * without all three — failing fast here is better than returning 500s at
 * runtime when a particular aggregator's path is hit.
 *
 * `0x_API_KEY` starts with a digit so we access it via the `process.env`
 * indexer and bind it to a TS-legal identifier.
 */
const KYBERSWAP_CLIENT_ID = process.env.KYBERSWAP_CLIENT_ID;
const UNISWAP_API_KEY = process.env.UNISWAP_API_KEY;
const ZEROX_API_KEY = process.env.ZEROX_API_KEY;

if (!KYBERSWAP_CLIENT_ID) {
  throw new Error("KYBERSWAP_CLIENT_ID is not set");
}
if (!UNISWAP_API_KEY) {
  throw new Error("UNISWAP_API_KEY is not set");
}
if (!ZEROX_API_KEY) {
  throw new Error("ZEROX_API_KEY is not set");
}

/**
 * Tighter limit than `/rpc` because each call here fans out to three
 * aggregator APIs in parallel. 10 per minute lets a typical user iterate
 * on their swap (re-quote on input change) without burning the partner
 * client-id quota.
 */
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_DURATION_MS = 60_000;

// --- Input validation ------------------------------------------------------
//
// Every field is constrained as tightly as is meaningful. The aggregator
// upstreams already reject malformed input, but we don't want garbage to
// reach them at all: it consumes our rate-limit budget there, leaks
// arbitrary strings into our `meta.request` echo (which the frontend may
// render), and would land in `route.raw` if persisted later.
//
// The regexes below are intentionally strict (allowlist, anchored,
// length-bounded). Anything that doesn't match returns 400 from Elysia
// before the handler runs.

/**
 * EVM address: literal `0x` followed by exactly 40 hex chars. Accepts
 * any case (lowercase, uppercase, EIP-55 mixed) — the SDKs handle
 * normalization downstream. The zero address (`0x000…`) is intentionally
 * accepted because it's the native-token sentinel.
 */
const HEX_ADDRESS = "^0x[a-fA-F0-9]{40}$";

/**
 * Decimal integer string, 1 to 78 chars (max uint256 in decimal is 78
 * digits ≈ 1.16e77). Rejects negatives, scientific notation, hex,
 * leading-zero variants other than the literal `"0"`. We do NOT permit
 * `"0"` either — selling zero is meaningless and only consumes upstream
 * budget — but the regex itself doesn't forbid it; the aggregator returns
 * a clean 4xx if you somehow get a zero through.
 */
const DECIMAL_AMOUNT = "^[0-9]{1,78}$";

/**
 * Free-form tag (KyberSwap `source` / `referral`, etc.). Allowlist of
 * alphanumeric + a few safe separators. Length-capped to keep large
 * blobs from being smuggled into our `meta.request` echo.
 */
const TAG = "^[A-Za-z0-9._:/\\-]{1,64}$";

/**
 * Largest Unix-epoch-seconds deadline we accept. `0xFFFFFFFF` is the
 * uint32 ceiling (~year 2106), comfortably past any realistic swap
 * deadline. Avoids `Number.MAX_SAFE_INTEGER` being passed through to
 * aggregators and triggering downstream BigInt overflows.
 */
const MAX_DEADLINE = 0xFFFFFFFF;

/**
 * JSON body validator for `POST /swapagg/{chain}`. POST (not GET) so
 * wallet addresses and amounts don't end up in access logs or the Referer
 * header.
 *
 * Unknown fields are silently stripped by Elysia's body parser before the
 * handler runs (verified empirically — Elysia drops keys not in the
 * schema regardless of `additionalProperties`). This is functionally
 * equivalent to rejection for our security model: extras cannot propagate
 * to the service, the upstream APIs, or the echoed `meta.request`. The
 * `additionalProperties: false` setting documents intent and would kick
 * in if Elysia's strip behavior ever changes.
 */
const SwapAggBody = t.Object(
  {
    tokenIn: t.String({ pattern: HEX_ADDRESS }),
    tokenOut: t.String({ pattern: HEX_ADDRESS }),
    amountIn: t.String({ pattern: DECIMAL_AMOUNT }),
    sender: t.String({ pattern: HEX_ADDRESS }),
    recipient: t.String({ pattern: HEX_ADDRESS }),
    // bps; integer required (fractional bps don't exist).
    slippageTolerance: t.Optional(
      t.Integer({ minimum: 0, maximum: 2000 })
    ),
    deadline: t.Optional(t.Integer({ minimum: 0, maximum: MAX_DEADLINE })),
    origin: t.Optional(t.String({ pattern: HEX_ADDRESS })),
    source: t.Optional(t.String({ pattern: TAG })),
    referral: t.Optional(t.String({ pattern: TAG })),
    enableGasEstimation: t.Optional(t.Boolean()),
  },
  { additionalProperties: false }
);

// --- Controller ------------------------------------------------------------

export const swapagg = new Elysia({ prefix: "/swapagg" })
  .use(cors({ origin: true, credentials: false }))
  .use(
    rateLimit({
      max: RATE_LIMIT_MAX,
      duration: RATE_LIMIT_DURATION_MS,
      scoping: "scoped",
      countFailedRequest: true,
      generator: (request, server) => {
        const ip = server?.requestIP(request)?.address;
        return ip ? hashClientIp(ip) : "";
      },
    })
  )
  // POST /swapagg/ethereum — get a best-effort route across all three
  // aggregators in one round-trip. Returns the shared `SwapAggResult`
  // envelope:
  //   { id, timestamp, routes: { kyberswap?, zerox?, uniswap? }, meta, status }
  //
  // POST (not GET) so wallet addresses and amounts stay out of access
  // logs and Referer headers. Quotes are time-sensitive (gas/price/
  // slippage), so the response is marked uncacheable as well.
  .post(
    "/ethereum",
    async ({ body, set }) => {
      set.headers["cache-control"] = "no-store";

      // Defensive re-construction: even though `SwapAggBody` validates
      // shape, we destructure to the exact request fields the service
      // accepts. This prevents any future schema laxity from accidentally
      // forwarding unexpected keys to the umbrella SDK / aggregators.
      const {
        tokenIn,
        tokenOut,
        amountIn,
        sender,
        recipient,
        slippageTolerance,
        deadline,
        origin,
        source,
        referral,
        enableGasEstimation,
      } = body;

      try {
        return await SwapAggService.getSwap("ethereum", {
          tokenIn,
          tokenOut,
          amountIn,
          sender,
          recipient,
          slippageTolerance,
          deadline,
          origin,
          source,
          referral,
          enableGasEstimation,
        });
      } catch (err) {
        // The umbrella SDK swallows per-aggregator failures inside
        // Promise.allSettled, so this branch only fires for programmer
        // errors (unsupported chain) or a pathological runtime. Keep the
        // KyberSwap-specific mapping in case the SDK is ever called in a
        // non-fan-out mode again — harmless when dead.
        if (err instanceof KyberSwapError) {
          set.status = err.status >= 400 && err.status < 600 ? err.status : 502;
          return {
            code: err.code,
            message: err.message,
            requestId: err.requestId,
          };
        }
        throw err;
      }
    },
    { body: SwapAggBody }
  );
