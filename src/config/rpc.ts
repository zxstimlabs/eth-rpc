/**
 * Server-side defaults for the `/rpc/*` JSON-RPC proxy.
 *
 * Currently only the per-client rate-limit budget lives here. Other RPC
 * knobs (timeouts, provider rotation strategy, etc.) belong here too as
 * they get added.
 */

export const rpcConfig = {
  /**
   * Per-client rate-limit tunables. Adjust these to change throughput.
   *
   *   max       — requests allowed inside the window
   *   durationMs — window length in milliseconds
   *
   * The current setting (200 per 60s per client) is chosen to absorb the
   * typical burst of calls a wallet/dapp makes on page load without
   * exhausting the upstream provider quota. Wallets like MetaMask can
   * fire 50–100 calls in the first few seconds of a page load (chainId,
   * blockNumber, balance, allowance, multicall reads, etc.) — 200/min
   * leaves headroom for two or three such page loads per minute.
   *
   * The limiter is keyed by a salted IP hash (see `hashClientIp`), so
   * each public IP gets its own bucket. The window is a rolling 60s.
   */
  rateLimit: {
    max: 200,
    durationMs: 60_000,

    /** Namespace for this limiter's keys in Redis. */
    redisKeyPrefix: "zxstim-rpc:rl:rpc:",
    /**
     * Redis must answer within this many ms, or the request is refused
     * (503). Redis on the same host answers in well under 1 ms; this only
     * trips when Redis is stalled.
     */
    redisTimeoutMs: 500,
    /** `Retry-After` (seconds) sent with the 503 when Redis is unavailable. */
    unavailableRetryAfterSec: 5,
  },
};
