/**
 * AccountService
 * --------------
 * Request-level logic for the /v1 account endpoints, with no Elysia
 * dependency. Storage and the credit rules live in lib/billing.
 *
 * Two credentials, both 32 bytes of hex sent over TLS and never stored:
 *
 *   Authorization: Account <account_secret>   manage keys (the master secret)
 *   Authorization: Bearer <api_key>           balance and claims (what apps hold)
 *
 * The server keeps only their keccak256 digests (lib/keccak.ts).
 */

import { accountStore, claimPayment, leaseStore } from "../../lib/billing";
import type { ClaimResult } from "../../lib/billing/claims";
import type { RegisterOutcome } from "../../lib/billing/accounts";
import { accountIdOf, keyHashOf, memoOf, parseHex32 } from "../../lib/keccak";
import { db } from "../../db";

const credential = (header: string | undefined, scheme: "Account" | "Bearer") => {
  if (!header) return null;
  const [given, value, ...rest] = header.trim().split(/\s+/);
  if (rest.length > 0 || given?.toLowerCase() !== scheme.toLowerCase()) return null;
  return parseHex32(value);
};

export abstract class AccountService {
  /** Account id from `Authorization: Account <secret>`, or null. */
  static accountFromSecret(header: string | undefined): string | null {
    const secret = credential(header, "Account");
    return secret ? accountIdOf(secret) : null;
  }

  /** Account id from `Authorization: Bearer <api key>`, or null if unknown/revoked. */
  static async accountFromKey(header: string | undefined): Promise<string | null> {
    const key = credential(header, "Bearer");
    return key ? accountStore.resolveKey(keyHashOf(key)) : null;
  }

  static registerKey(accountId: string, keyHash: string): Promise<RegisterOutcome> {
    return accountStore.registerKey(accountId, keyHash);
  }

  static revokeKey(accountId: string, keyHash: string): Promise<boolean> {
    return accountStore.revokeKey(accountId, keyHash);
  }

  static balance(accountId: string): Promise<number> {
    return leaseStore.available(accountId);
  }

  /** Claim every unclaimed payment whose memo is keccak256(secret). */
  static async claim(accountId: string, paymentSecret: Uint8Array): Promise<ClaimResult> {
    const result = await claimPayment(db, accountId, memoOf(paymentSecret));
    if (result.status === "credited") {
      await leaseStore.noteCredited(accountId, result.credits).catch(() => {});
    }
    return result;
  }
}
