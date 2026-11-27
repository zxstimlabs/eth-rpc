/**
 * Credit leases: spending credits without a database write per call
 * ------------------------------------------------------------------
 * Every credit is in exactly ONE place:
 *
 *   Postgres  accounts.balance    the durable part
 *   Redis     <prefix>lease:<id>  up to `size` credits that requests spend
 *
 * Postgres also records `accounts.leased` — how many credits were moved
 * into Redis — and `lease_epoch`, the Redis incarnation they went to.
 *
 *   spend   one atomic Redis script: lease ≥ n → subtract, else "refill".
 *   refill  (per-account lock) Postgres: balance -= take, leased += take;
 *           then Redis: lease += take. One DB write per `size` calls.
 *   return  (idle job) Redis: take the lease's remainder away; Postgres:
 *           balance += remainder, leased = 0. The rest was spent.
 *   claim   Postgres only (balance += credits); the next refill sees it.
 *
 * Credits move between the stores but always add up; there's no cache to
 * keep in sync. Redis keeps nothing on disk, so a Redis restart loses the
 * live leases: the epoch key changes, and each account's next refill sees
 * its `leased` belongs to a dead epoch and refunds all of it. The customer
 * loses nothing; we give away at most one lease per active account.
 *
 * Fails closed: Redis/Postgres unavailable → BillingUnavailableError (503).
 */

import type { RedisClient } from "bun";
import { eq, sql } from "drizzle-orm";
import type { Db } from "../../db";
import { accounts } from "../../db/schema";
import {
  BillingUnavailableError,
  InsufficientCreditsError,
  dbOp,
  redisOp,
} from "./errors";

/**
 * lease ≥ n → {lease after, balance snapshot}. Otherwise {-1} (refill), or
 * {-2} when a refill just found Postgres empty (the `empty` marker), so an
 * account that's out of credits doesn't cost a DB round trip per request.
 */
const SPEND_SCRIPT = `
local v = redis.call('GET', KEYS[1])
local n = tonumber(ARGV[1])
if (not v) or tonumber(v) < n then
  if redis.call('EXISTS', KEYS[3]) == 1 then return {-2, 0} end
  return {-1, 0}
end
local left = redis.call('DECRBY', KEYS[1], n)
return {left, tonumber(redis.call('GET', KEYS[2]) or '0')}
`;

/** After a refill's DB commit: add to the lease, record the balance snapshot and time. */
const APPLY_REFILL_SCRIPT = `
redis.call('INCRBY', KEYS[1], ARGV[1])
redis.call('SET', KEYS[2], ARGV[2])
redis.call('ZADD', KEYS[3], ARGV[3], ARGV[4])
return 1
`;

/** Take a lease away whole; returns what was left in it. */
const TAKE_LEASE_SCRIPT = `
local v = tonumber(redis.call('GET', KEYS[1]) or '0')
redis.call('DEL', KEYS[1], KEYS[2])
redis.call('ZREM', KEYS[3], ARGV[1])
return v
`;

/** This Redis incarnation's id; created on first use after a (re)start. */
const EPOCH_SCRIPT = `
local v = redis.call('GET', KEYS[1])
if v then return v end
redis.call('SET', KEYS[1], ARGV[1])
return ARGV[1]
`;

const UNLOCK_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
return 0
`;

/** After a claim: clear the `empty` marker; bump the snapshot if a lease is live. */
const CREDITED_SCRIPT = `
redis.call('DEL', KEYS[2])
if redis.call('EXISTS', KEYS[1]) == 1 then redis.call('INCRBY', KEYS[1], ARGV[1]) end
return 1
`;

/** How long "Postgres has nothing left for this account" is remembered. */
const EMPTY_MARKER_MS = 5_000;

export type LeaseOptions = {
  /** Redis key namespace, e.g. "zxstim-rpc:bill:". */
  prefix: string;
  timeoutMs: number;
  size: number;
  lowWater: number;
  idleReturnMs: number;
  lockTtlMs: number;
  refillWaitMs: number;
};

export type SpendResult = {
  /** Credits left in the live lease. */
  lease: number;
  /** Postgres balance as of the last refill (approximate; for display). */
  balance: number;
};

type RefillOutcome = "added" | "busy" | "empty";

export class LeaseStore {
  constructor(
    private readonly redis: RedisClient,
    private readonly db: Db,
    private readonly options: LeaseOptions
  ) {}

  private key(kind: "lease" | "snap" | "lock" | "empty", accountId: string) {
    return `${this.options.prefix}${kind}:${accountId}`;
  }
  private get leasedAtKey() {
    return `${this.options.prefix}leased-at`;
  }
  private get epochKey() {
    return `${this.options.prefix}epoch`;
  }

  private r<T>(command: () => Promise<T>): Promise<T> {
    return redisOp(this.redis.connected, command, this.options.timeoutMs);
  }

  /**
   * Spend `n` credits for `accountId`. Throws InsufficientCreditsError when
   * the account (lease + Postgres) can't cover n, BillingUnavailableError
   * when Redis/Postgres can't answer.
   */
  async spend(accountId: string, n: number): Promise<SpendResult> {
    const deadline = Date.now() + this.options.refillWaitMs;
    for (;;) {
      const [left, snapshot] = (await this.r(() =>
        this.redis.send("EVAL", [
          SPEND_SCRIPT,
          "3",
          this.key("lease", accountId),
          this.key("snap", accountId),
          this.key("empty", accountId),
          String(n),
        ])
      )) as [number, number];

      if (left >= 0) {
        if (left < this.options.lowWater && snapshot > 0) {
          // Top up before it runs dry, off the request path.
          this.refill(accountId).catch(() => {});
        }
        return { lease: left, balance: snapshot };
      }
      if (left === -2) throw new InsufficientCreditsError();

      // "empty" sets the marker, so the next spend either succeeds (another
      // request's refill just landed) or reports -2.
      const outcome = await this.refill(accountId);
      if (outcome === "busy") {
        // Another request is refilling this account; wait for it.
        if (Date.now() > deadline) throw new BillingUnavailableError();
        await Bun.sleep(20);
      }
    }
  }

  /** Give back credits for a call that failed upstream (or on our side). */
  async refund(accountId: string, n: number): Promise<void> {
    await this.r(() => this.redis.send("INCRBY", [this.key("lease", accountId), String(n)]));
  }

  /**
   * Move up to `size` credits from Postgres into the account's lease.
   * "empty": nothing left in Postgres (and the lease can't cover the request).
   */
  private async refill(accountId: string): Promise<RefillOutcome> {
    const token = await this.lock(accountId);
    if (!token) return "busy";
    try {
      const epoch = await this.currentEpoch();
      const moved = await dbOp(() =>
        this.db.transaction(async (tx) => {
          const [row] = await tx
            .select({
              balance: accounts.balance,
              leased: accounts.leased,
              leaseEpoch: accounts.leaseEpoch,
            })
            .from(accounts)
            .where(eq(accounts.id, accountId))
            .for("update");
          if (!row) return null;

          let { balance, leased } = row;
          if (row.leaseEpoch !== epoch) {
            // Those credits went to a Redis that has since restarted: refund them.
            balance += leased;
            leased = 0;
          }
          const take = Math.min(this.options.size, balance);
          await tx
            .update(accounts)
            .set({ balance: balance - take, leased: leased + take, leaseEpoch: epoch })
            .where(eq(accounts.id, accountId));
          return { take, balanceAfter: balance - take };
        })
      );
      if (!moved || moved.take === 0) {
        await this.r(() =>
          this.redis.send("SET", [
            this.key("empty", accountId),
            "1",
            "PX",
            String(EMPTY_MARKER_MS),
          ])
        );
        return "empty";
      }

      try {
        await this.r(() =>
          this.redis.send("EVAL", [
            APPLY_REFILL_SCRIPT,
            "3",
            this.key("lease", accountId),
            this.key("snap", accountId),
            this.leasedAtKey,
            String(moved.take),
            String(moved.balanceAfter),
            String(Date.now()),
            accountId,
          ])
        );
      } catch (error) {
        // Committed in Postgres but never reached Redis: put the credits back.
        await this.db
          .update(accounts)
          .set({
            balance: sql`${accounts.balance} + ${moved.take}`,
            leased: sql`${accounts.leased} - ${moved.take}`,
          })
          .where(eq(accounts.id, accountId))
          .catch(() => {});
        throw error;
      }
      return "added";
    } finally {
      await this.unlock(accountId, token).catch(() => {});
    }
  }

  /**
   * Return leases that haven't been refilled for `idleReturnMs` to Postgres.
   * Run periodically (src/index.ts). Returns how many leases it returned.
   */
  async returnIdle(now = Date.now(), limit = 100): Promise<number> {
    const idle = (await this.r(() =>
      this.redis.send("ZRANGE", [
        this.leasedAtKey,
        "-inf",
        String(now - this.options.idleReturnMs),
        "BYSCORE",
        "LIMIT",
        "0",
        String(limit),
      ])
    )) as string[];

    let returned = 0;
    for (const accountId of idle) {
      const token = await this.lock(accountId);
      if (!token) continue; // busy refilling: it's active, not idle
      try {
        const left = Number(
          await this.r(() =>
            this.redis.send("EVAL", [
              TAKE_LEASE_SCRIPT,
              "3",
              this.key("lease", accountId),
              this.key("snap", accountId),
              this.leasedAtKey,
              accountId,
            ])
          )
        );
        try {
          await dbOp(() =>
            this.db
              .update(accounts)
              .set({ balance: sql`${accounts.balance} + ${left}`, leased: 0 })
              .where(eq(accounts.id, accountId))
          );
          returned++;
        } catch (error) {
          // Postgres didn't take it: put the lease back so nothing is lost.
          await this.r(() =>
            this.redis.send("EVAL", [
              APPLY_REFILL_SCRIPT,
              "3",
              this.key("lease", accountId),
              this.key("snap", accountId),
              this.leasedAtKey,
              String(left),
              "0",
              String(now),
              accountId,
            ])
          ).catch(() => {});
          throw error;
        }
      } finally {
        await this.unlock(accountId, token).catch(() => {});
      }
    }
    return returned;
  }

  /** Credits the account can still spend: Postgres balance + live lease. */
  async available(accountId: string): Promise<number> {
    const [row] = await dbOp(() =>
      this.db
        .select({
          balance: accounts.balance,
          leased: accounts.leased,
          leaseEpoch: accounts.leaseEpoch,
        })
        .from(accounts)
        .where(eq(accounts.id, accountId))
    );
    if (!row) return 0;
    const epoch = await this.currentEpoch();
    if (row.leaseEpoch !== epoch) return row.balance + row.leased; // dead lease: refundable
    const lease = await this.r(() => this.redis.get(this.key("lease", accountId)));
    return row.balance + Number(lease ?? 0);
  }

  /**
   * After a claim (Postgres already credited): let the account spend again
   * right away and keep X-Credits-Remaining current. Best effort — the
   * `empty` marker expires on its own within seconds.
   */
  async noteCredited(accountId: string, credits: number): Promise<void> {
    await this.r(() =>
      this.redis.send("EVAL", [
        CREDITED_SCRIPT,
        "2",
        this.key("snap", accountId),
        this.key("empty", accountId),
        String(credits),
      ])
    );
  }

  private async currentEpoch(): Promise<string> {
    return (await this.r(() =>
      this.redis.send("EVAL", [EPOCH_SCRIPT, "1", this.epochKey, crypto.randomUUID()])
    )) as string;
  }

  private async lock(accountId: string): Promise<string | null> {
    const token = crypto.randomUUID();
    const ok = await this.r(() =>
      this.redis.send("SET", [
        this.key("lock", accountId),
        token,
        "NX",
        "PX",
        String(this.options.lockTtlMs),
      ])
    );
    return ok === "OK" ? token : null;
  }

  private async unlock(accountId: string, token: string): Promise<void> {
    await this.r(() =>
      this.redis.send("EVAL", [UNLOCK_SCRIPT, "1", this.key("lock", accountId), token])
    );
  }
}
