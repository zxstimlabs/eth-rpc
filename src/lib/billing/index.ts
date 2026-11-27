/**
 * The app's billing stores, wired to the shared Redis and Postgres clients
 * and `billingConfig`. Tests build their own instances with a private
 * Redis prefix and small lease sizes.
 */

import { billingConfig } from "../../config/billing";
import { db } from "../../db";
import { redis } from "../redis";
import { AccountStore } from "./accounts";
import { LeaseStore } from "./leases";

export const leaseStore = new LeaseStore(redis, db, {
  prefix: billingConfig.redisKeyPrefix,
  timeoutMs: billingConfig.redisTimeoutMs,
  ...billingConfig.lease,
});

export const accountStore = new AccountStore(redis, db, {
  prefix: billingConfig.redisKeyPrefix,
  timeoutMs: billingConfig.redisTimeoutMs,
  maxKeysPerAccount: billingConfig.keys.maxPerAccount,
  keyCacheMs: billingConfig.keys.cacheMs,
  unknownKeyCacheMs: billingConfig.keys.unknownCacheMs,
});

export { claimPayment } from "./claims";
export { countCalls } from "./calls";
export { BillingUnavailableError, InsufficientCreditsError } from "./errors";
