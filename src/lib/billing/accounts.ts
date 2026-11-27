/**
 * Accounts and API keys
 * ---------------------
 * Mullvad-style: an account is an opaque id derived from a 32-byte secret
 * that only its owner holds (the wallet derives it from its seed). API keys
 * are derived by the wallet too and registered here only as keccak256(key),
 * so the server never sees a key until it's used, and a database dump holds
 * nothing that can be spent.
 *
 * Key lookups (one per billed request) are cached in Redis: key hash →
 * account id, and unknown hashes as "" for a short while so junk keys can't
 * turn into a database query each.
 */

import type { RedisClient } from "bun";
import { and, count, eq } from "drizzle-orm";
import type { Db } from "../../db";
import { accounts, apiKeys } from "../../db/schema";
import { dbOp, redisOp } from "./errors";

export type AccountOptions = {
  prefix: string;
  timeoutMs: number;
  maxKeysPerAccount: number;
  keyCacheMs: number;
  unknownKeyCacheMs: number;
};

export type RegisterOutcome = "created" | "exists" | "revoked" | "conflict" | "limit";

export class AccountStore {
  constructor(
    private readonly redis: RedisClient,
    private readonly db: Db,
    private readonly options: AccountOptions
  ) {}

  private cacheKey(keyHash: string) {
    return `${this.options.prefix}key:${keyHash}`;
  }

  private r<T>(command: () => Promise<T>): Promise<T> {
    return redisOp(this.redis.connected, command, this.options.timeoutMs);
  }

  /** The account a (non-revoked) key belongs to, or null. */
  async resolveKey(keyHash: string): Promise<string | null> {
    const cached = await this.r(() => this.redis.get(this.cacheKey(keyHash)));
    if (cached !== null) return cached === "" ? null : cached;

    const [row] = await dbOp(() =>
      this.db
        .select({ accountId: apiKeys.accountId })
        .from(apiKeys)
        .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.revoked, false)))
    );
    const accountId = row?.accountId ?? "";
    const ttl = accountId ? this.options.keyCacheMs : this.options.unknownKeyCacheMs;
    await this.r(() =>
      this.redis.send("SET", [this.cacheKey(keyHash), accountId, "PX", String(ttl)])
    );
    return accountId || null;
  }

  /**
   * Register a key for an account, creating the account on first use.
   * A key hash belongs to one account forever; revoked keys stay revoked
   * (the wallet derives a fresh key instead).
   */
  async registerKey(accountId: string, keyHash: string): Promise<RegisterOutcome> {
    const outcome = await dbOp(() =>
      this.db.transaction(async (tx): Promise<RegisterOutcome> => {
        await tx.insert(accounts).values({ id: accountId }).onConflictDoNothing();

        const [existing] = await tx
          .select({ accountId: apiKeys.accountId, revoked: apiKeys.revoked })
          .from(apiKeys)
          .where(eq(apiKeys.keyHash, keyHash));
        if (existing) {
          if (existing.accountId !== accountId) return "conflict";
          return existing.revoked ? "revoked" : "exists";
        }

        const [active] = await tx
          .select({ n: count() })
          .from(apiKeys)
          .where(and(eq(apiKeys.accountId, accountId), eq(apiKeys.revoked, false)));
        if ((active?.n ?? 0) >= this.options.maxKeysPerAccount) return "limit";

        const inserted = await tx
          .insert(apiKeys)
          .values({ keyHash, accountId })
          .onConflictDoNothing()
          .returning({ keyHash: apiKeys.keyHash });
        // Lost a race with another registration of the same hash.
        return inserted.length > 0 ? "created" : "conflict";
      })
    );
    if (outcome === "created") {
      // Drop a cached "unknown" so the key works immediately.
      await this.r(() => this.redis.del(this.cacheKey(keyHash)));
    }
    return outcome;
  }

  /** Revoke one of the account's keys. False if it isn't the account's key. */
  async revokeKey(accountId: string, keyHash: string): Promise<boolean> {
    const updated = await dbOp(() =>
      this.db
        .update(apiKeys)
        .set({ revoked: true })
        .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.accountId, accountId)))
        .returning({ keyHash: apiKeys.keyHash })
    );
    if (updated.length === 0) return false;
    await this.r(() => this.redis.del(this.cacheKey(keyHash)));
    return true;
  }
}
