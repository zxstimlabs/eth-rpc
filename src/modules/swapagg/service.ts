/**
 * SwapAggService
 * --------------
 * Thin HTTP-facing facade over the umbrella swap SDK (`lib/swap/um-swap`).
 * All aggregator-specific orchestration — client construction, chain
 * mapping, fan-out, response normalization — lives in the SDK so it can
 * be reused outside the HTTP layer (jobs, scripts, other modules).
 *
 * This class is intentionally tiny: kept around so the controller has a
 * stable, namespaced entry point (`SwapAggService.getSwap`) and so future
 * request-scoped concerns (auth, telemetry, request logging) have a place
 * to land without touching the SDK.
 */

import { umSwap } from "../../lib/swap/um-swap";
import type {
  SwapAggChain,
  SwapAggRequest,
  SwapAggResult,
} from "../../types/swapagg";

export abstract class SwapAggService {
  static getSwap(
    chain: SwapAggChain,
    req: SwapAggRequest
  ): Promise<SwapAggResult> {
    return umSwap.getSwap(chain, req);
  }
}
