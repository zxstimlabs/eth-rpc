/**
 * Postgres schema (Drizzle). Migrations are generated from this file with
 * `bun run db:generate` into ./drizzle and applied by the app at startup.
 *
 * Privacy: no IPs, no timestamps, no request records, and nothing links a
 * payment to an account. An account is an opaque id derived from a secret
 * only its owner holds (see lib/keccak.ts).
 */

import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
} from "drizzle-orm/pg-core";

/**
 * One row per account. Credits live either here (`balance`) or in a Redis
 * lease; `leased` is how many were moved into the lease, under Redis
 * incarnation `lease_epoch`. See lib/billing/leases.ts.
 */
export const accounts = pgTable(
  "accounts",
  {
    /** keccak256("zxstim-rpc/account/v1" ‖ account_secret), 0x-hex. */
    id: text("id").primaryKey(),
    balance: bigint("balance", { mode: "number" }).notNull().default(0),
    leased: bigint("leased", { mode: "number" }).notNull().default(0),
    leaseEpoch: text("lease_epoch"),
  },
  (t) => [
    check("accounts_balance_nonnegative", sql`${t.balance} >= 0`),
    check("accounts_leased_nonnegative", sql`${t.leased} >= 0`),
  ]
);

/** API keys, stored only as keccak256(key). Keys are derived by the wallet. */
export const apiKeys = pgTable(
  "api_keys",
  {
    keyHash: text("key_hash").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id),
    revoked: boolean("revoked").notNull().default(false),
  },
  (t) => [index("api_keys_account_id_idx").on(t.accountId)]
);

/**
 * On-chain payments (`Paid` events), recorded by the payment indexer with the
 * credits they're worth. Deliberately no account column: a claim marks a
 * payment `claimed` and adds its credits to the claimer's balance, and the
 * link between the two is never written down.
 */
export const payments = pgTable(
  "payments",
  {
    chainId: integer("chain_id").notNull(),
    txHash: text("tx_hash").notNull(),
    logIndex: integer("log_index").notNull(),
    /** keccak256(payment_secret), 0x-hex — the event's indexed memo. */
    memo: text("memo").notNull(),
    /** Token address, or 0x000…000 for ETH. */
    token: text("token").notNull(),
    /** Raw on-chain amount (wei / token units). */
    amount: numeric("amount", { precision: 78, scale: 0 }).notNull(),
    credits: bigint("credits", { mode: "number" }).notNull(),
    claimed: boolean("claimed").notNull().default(false),
  },
  (t) => [
    primaryKey({ columns: [t.chainId, t.txHash, t.logIndex] }),
    index("payments_memo_idx").on(t.memo),
    check("payments_credits_nonnegative", sql`${t.credits} >= 0`),
  ]
);

/** Last fully processed block per chain, for the payment indexer. */
export const indexerState = pgTable("indexer_state", {
  chainId: integer("chain_id").primaryKey(),
  lastBlock: bigint("last_block", { mode: "number" }).notNull(),
});
