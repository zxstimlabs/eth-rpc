/**
 * Claims: turning on-chain payments into credits
 * ----------------------------------------------
 * A payment's memo is keccak256(payment_secret). The payment indexer
 * records `Paid` events (memo → credits) with no account attached. The
 * wallet then presents payment_secret together with its API key; whoever
 * knows the secret can claim, and a memo seen on-chain is useless alone.
 *
 * One transaction marks every unclaimed payment with that memo claimed and
 * adds their credits to the account. Concurrent claims of the same memo
 * serialize on the payment rows: exactly one credits, the other sees
 * "already-claimed". The payment ↔ account link exists only in this
 * request; it is never stored.
 */

import { and, eq, sql } from "drizzle-orm";
import type { Db } from "../../db";
import { accounts, payments } from "../../db/schema";
import { dbOp } from "./errors";

export type ClaimResult =
  | { status: "credited"; credits: number }
  /** No payment with this memo yet (not mined, or not past confirmations). Retry. */
  | { status: "pending" }
  | { status: "already-claimed" };

export const claimPayment = async (
  db: Db,
  accountId: string,
  memo: string
): Promise<ClaimResult> =>
  dbOp(() =>
    db.transaction(async (tx): Promise<ClaimResult> => {
      const claimed = await tx
        .update(payments)
        .set({ claimed: true })
        .where(and(eq(payments.memo, memo), eq(payments.claimed, false)))
        .returning({ credits: payments.credits });

      if (claimed.length > 0) {
        const credits = claimed.reduce((sum, row) => sum + row.credits, 0);
        const updated = await tx
          .update(accounts)
          .set({ balance: sql`${accounts.balance} + ${credits}` })
          .where(eq(accounts.id, accountId))
          .returning({ id: accounts.id });
        if (updated.length === 0) throw new Error("account missing"); // rolls back
        return { status: "credited", credits };
      }

      const [seen] = await tx
        .select({ memo: payments.memo })
        .from(payments)
        .where(eq(payments.memo, memo))
        .limit(1);
      return seen ? { status: "already-claimed" } : { status: "pending" };
    })
  );
