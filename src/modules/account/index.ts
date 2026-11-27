/**
 * Account Module (controller)
 * ---------------------------
 *   POST   /v1/account/keys            Account auth  {keyHash}  → register an API key
 *   DELETE /v1/account/keys/{keyHash}  Account auth             → revoke it
 *   GET    /v1/account                 Bearer auth              → {credits}
 *   POST   /v1/claims                  Bearer auth   {secret}   → claim a payment
 *
 * The wallet derives the account secret, API keys and payment secrets from
 * its seed; this module only ever stores digests (see AccountService).
 * Per-IP rate limit like /rpc; fails closed (503) without Redis/Postgres.
 */

import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { rateLimit } from "elysia-rate-limit";
import { clientIp, getListeningServer, hashClientIp } from "../../lib/client-id";
import { redis } from "../../lib/redis";
import {
  RateLimiterUnavailableError,
  RedisRateLimitContext,
} from "../../lib/redis-rate-limit";
import { BillingUnavailableError } from "../../lib/billing";
import { normalizeHex32, parseHex32 } from "../../lib/keccak";
import { billingConfig } from "../../config/billing";
import { AccountService } from "./service";

const TRUST_PROXY = process.env.TRUST_PROXY === "1";

const hex32 = t.String({ pattern: "^(0x|0X)?[0-9a-fA-F]{64}$" });

/** Exported so tests can reset windows. */
export const accountRateLimitStore = new RedisRateLimitContext(redis, {
  prefix: billingConfig.accountRateLimit.redisKeyPrefix,
  timeoutMs: billingConfig.redisTimeoutMs,
});

export const account = new Elysia({ prefix: "/v1" })
  .use(cors({ origin: true, credentials: false }))
  .use(
    rateLimit({
      max: billingConfig.accountRateLimit.max,
      duration: billingConfig.accountRateLimit.durationMs,
      scoping: "scoped",
      countFailedRequest: true,
      context: accountRateLimitStore,
      injectServer: getListeningServer,
      generator: (request, server) => {
        const ip = clientIp(request, server, TRUST_PROXY);
        return ip ? hashClientIp(ip) : "";
      },
    })
  )
  .onError(({ error, set }) => {
    if (error instanceof RateLimiterUnavailableError || error instanceof BillingUnavailableError) {
      set.status = 503;
      set.headers["retry-after"] = String(billingConfig.unavailableRetryAfterSec);
      return { error: "temporarily unavailable" };
    }
  })
  .post(
    "/account/keys",
    async ({ headers, body, set }) => {
      const accountId = AccountService.accountFromSecret(headers.authorization);
      if (!accountId) {
        set.status = 401;
        return { error: "missing or invalid account secret" };
      }
      const keyHash = normalizeHex32(body.keyHash);
      if (!keyHash) {
        set.status = 400;
        return { error: "keyHash must be 32 bytes of hex" };
      }
      const outcome = await AccountService.registerKey(accountId, keyHash);
      switch (outcome) {
        case "created":
          set.status = 201;
          return { status: "created" };
        case "exists":
          return { status: "exists" };
        case "revoked":
          set.status = 409;
          return { error: "key was revoked; derive a new one" };
        case "conflict":
          set.status = 409;
          return { error: "key belongs to another account" };
        case "limit":
          set.status = 409;
          return { error: `at most ${billingConfig.keys.maxPerAccount} active keys per account` };
      }
    },
    { body: t.Object({ keyHash: hex32 }) }
  )
  .delete(
    "/account/keys/:keyHash",
    async ({ headers, params, set }) => {
      const accountId = AccountService.accountFromSecret(headers.authorization);
      if (!accountId) {
        set.status = 401;
        return { error: "missing or invalid account secret" };
      }
      const keyHash = normalizeHex32(params.keyHash);
      if (!keyHash || !(await AccountService.revokeKey(accountId, keyHash))) {
        set.status = 404;
        return { error: "no such key on this account" };
      }
      set.status = 204;
      return "";
    }
  )
  .get("/account", async ({ headers, set }) => {
    const accountId = await AccountService.accountFromKey(headers.authorization);
    if (!accountId) {
      set.status = 401;
      return { error: "missing or unknown api key" };
    }
    return { credits: await AccountService.balance(accountId) };
  })
  .post(
    "/claims",
    async ({ headers, body, set }) => {
      const accountId = await AccountService.accountFromKey(headers.authorization);
      if (!accountId) {
        set.status = 401;
        return { error: "missing or unknown api key" };
      }
      const secret = parseHex32(body.secret);
      if (!secret) {
        set.status = 400;
        return { error: "secret must be 32 bytes of hex" };
      }
      const result = await AccountService.claim(accountId, secret);
      switch (result.status) {
        case "credited":
          return result;
        case "pending":
          // Not seen on-chain yet (or not past confirmations). Retry later.
          set.status = 202;
          return result;
        case "already-claimed":
          set.status = 409;
          return result;
      }
    },
    { body: t.Object({ secret: hex32 }) }
  );
