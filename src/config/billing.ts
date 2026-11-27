/**
 * Server-side defaults for prepaid credits (billing).
 *
 * Model: 1 credit = 1 JSON-RPC call (a batch of N costs N). Credits are
 * bought on-chain (see zxstimlabs/rpc-pay-contracts) and claimed into an
 * account with the payment's secret. Never accepted from the client.
 *
 * Hot path: credits are spent from a per-account *lease* in Redis, refilled
 * from the durable balance in Postgres `lease.size` credits at a time. Each
 * credit is in exactly one place: Postgres `accounts.balance`, or a Redis
 * lease (tracked in Postgres as `accounts.leased`). See lib/billing/leases.ts.
 */

export const billingConfig = {
  /** Namespace for billing keys in Redis (leases, locks, key cache). */
  redisKeyPrefix: "zxstim-rpc:bill:",
  /** Redis must answer within this many ms, or the request fails closed (503). */
  redisTimeoutMs: 500,
  /** `Retry-After` (seconds) on 503s when Redis or Postgres is unavailable. */
  unavailableRetryAfterSec: 5,

  lease: {
    /** Credits moved from Postgres into Redis per refill ($0.10 at $1 = 10,000). */
    size: 1_000,
    /** Below this many credits left in a lease, refill in the background. */
    lowWater: 200,
    /** A lease not refilled for this long goes back to Postgres. */
    idleReturnMs: 5 * 60_000,
    /** How often the idle-lease return job runs. */
    returnEveryMs: 60_000,
    /** Per-account refill/return lock lifetime (guards against a crashed holder). */
    lockTtlMs: 10_000,
    /** How long a request waits for another request's refill before giving up (503). */
    refillWaitMs: 2_000,
  },

  keys: {
    /** Active (non-revoked) API keys per account. */
    maxPerAccount: 20,
    /** Redis cache of key hash → account id. */
    cacheMs: 24 * 60 * 60_000,
    /** Unknown keys are cached as unknown this long (bounds DB lookups for junk keys). */
    unknownCacheMs: 30_000,
  },

  calls: {
    /** Largest JSON-RPC batch accepted on billed routes. */
    maxBatch: 100,
    /** Methods refused on billed routes (expensive upstream, not needed by wallets). */
    blockedMethodPrefixes: ["debug_", "trace_"],
  },

  /** Per-client (IP) limit on /v1/* account and claim endpoints. */
  accountRateLimit: {
    max: 60,
    durationMs: 60_000,
    redisKeyPrefix: "zxstim-rpc:rl:account:",
  },
};
