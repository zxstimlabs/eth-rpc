/**
 * Server-side defaults for the swap-aggregator fan-out layer.
 *
 * Two kinds of settings live here:
 *
 *   1. Cross-aggregator knobs (e.g. `timeoutMs`) at the top level.
 *   2. Per-aggregator fee / routing policy, namespaced by aggregator name.
 *
 * Per-aggregator sections exist because each upstream's fee API is shaped
 * differently — the policy expressed for KyberSwap (bps + receiver +
 * chargeFeeBy) doesn't translate 1:1 to 0x's `swapFee*` params or to
 * Uniswap's no-native-fees model. Keeping them as separate, typed sections
 * preserves each upstream's vocabulary instead of forcing a lossy common
 * shape.
 *
 * Nothing in here is accepted from the frontend — these defaults are
 * applied server-side inside `lib/swap/um-swap.ts` so fee policy is
 * controlled by the backend and cannot be tampered with by the client.
 */

import type { ChargeFeeBy } from "../lib/swap/sdks/kyberswap/kyberswap";
import { UNITMETAL_TREASURY_ADDRESS } from "../lib/constants";

export const swapaggConfig = {
  /**
   * Per-aggregator wall-clock budget in milliseconds.
   *
   * `umSwap.getSwap` calls every configured aggregator in parallel via
   * `Promise.allSettled`. Aggregators that don't resolve within this
   * budget are dropped from the response — their slot in `routes` is
   * absent and the overall `status` becomes `"partial"` (or `"failed"`
   * if every aggregator timed out / errored).
   *
   * Tuned for DEX aggregator latency: most return in 300–800ms, RFQ-heavy
   * ones can hit ~1.5s. Past 2s a quote is usually stale (gas/price ticks)
   * so dropping is safer than waiting longer. The frontend always sees a
   * response within this bound, regardless of the slowest aggregator.
   */
  timeoutMs: 2000,

  /**
   * KyberSwap fee policy. Appended to the `getRoute` request inside
   * `umSwap.getSwap`. The four fields are coupled — see comments below
   * for how they interact.
   */
  kyberswap: {
    /**
     * Fee amount to collect per swap.
     *
     * Interpretation depends on `isInBps`:
     *   - `isInBps: true`  → bps with base 10000. "10" = 0.10%.
     *   - `isInBps: false` → absolute token wei. "10" = 10 wei of the fee token.
     *
     * KyberSwap also accepts a comma-separated list (e.g. "10,20") to
     * split the fee across multiple receivers in `feeReceiver`. We use a
     * single value.
     */
    feeAmount: "10",

    /**
     * Which side of the swap the fee is taken from.
     *   - "currency_in"  → fee deducted from the input token before routing.
     *   - "currency_out" → fee deducted from the output token after routing.
     *
     * Leaving this unset on the request would disable fee collection
     * entirely, so this field is required for fees to actually be charged.
     */
    chargeFeeBy: "currency_out" as ChargeFeeBy,

    /**
     * Whether `feeAmount` is interpreted as basis points (true) or as a
     * raw wei amount of the fee token (false). See `feeAmount` above.
     */
    isInBps: true,

    /**
     * Wallet that receives the collected fee. Mirrors `feeAmount` shape:
     * a single address, or a comma-separated list when splitting across
     * multiple receivers. Pinned to the Unitmetal treasury.
     */
    feeReceiver: UNITMETAL_TREASURY_ADDRESS,
  },

  /**
   * 0x (AllowanceHolder) fee policy. Appended to the `getAllowanceHolderQuote`
   * request inside `umSwap.getSwap`. The two fields are coupled — omitting
   * either disables fee collection per the API contract.
   *
   * Notes from the 0x AllowanceHolder docs:
   *   - `swapFeeBps` has a default API cap of 1000 bps (10%); ask 0x for
   *     a higher limit if you ever need one.
   *   - `swapFeeToken` (the token the fee is taken in) is intentionally
   *     NOT set here. When omitted, 0x picks the fee token with
   *     preference for stablecoins / highly liquid assets — better default
   *     than hardcoding to either side of the swap.
   *   - Both fields are strings on the wire because 0x also accepts
   *     comma-separated values for multi-receiver splits.
   */
  zerox: {
    /**
     * Bps amount of the fee. "10" = 0.10%. Matches KyberSwap's `feeAmount`
     * so the take rate is consistent across aggregators.
     */
    swapFeeBps: "10",

    /**
     * Wallet that receives the collected fee. Pinned to the Unitmetal
     * treasury (same as KyberSwap's `feeReceiver`).
     */
    swapFeeRecipient: UNITMETAL_TREASURY_ADDRESS,
  },

  /**
   * Uniswap Trading API fee policy. Passed as `integratorFees` on the
   * `getQuote` request. Per the API docs:
   *   - The fee is always taken from the OUTPUT token.
   *   - For `EXACT_INPUT` swaps the quoted `output.amount` does NOT yet
   *     subtract the fee — the realized fee shows up on the response's
   *     `portionBips` / `portionAmount` fields instead. Adjust UI math
   *     accordingly when displaying net amounts.
   */
  uniswap: {
    /** Bps amount of the fee. 10 = 0.10%. Matches the other aggregators. */
    bips: 10,

    /** Treasury address that receives the fee. */
    recipient: UNITMETAL_TREASURY_ADDRESS,
  },
};
