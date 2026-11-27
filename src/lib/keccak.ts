/**
 * Ethereum Keccak-256 helpers for account ids, API key hashes and payment
 * memos. This is Ethereum's Keccak (as in Solidity's `keccak256`), NOT NIST
 * SHA3-256 — they pad differently and give different digests.
 *
 * All hex is lowercase and 0x-prefixed, like Ethereum tooling prints it.
 *
 *   account id = keccak256("zxstim-rpc/account/v1" ‖ account_secret)
 *   key hash   = keccak256(api_key)
 *   memo       = keccak256(payment_secret)       ← what goes on-chain
 *
 * Secrets, keys and payment secrets are all 32 bytes. The server stores only
 * the digests.
 */

import { keccak_256 } from "@noble/hashes/sha3.js";
import { bytesToHex, concatBytes, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";

const ACCOUNT_TAG = utf8ToBytes("zxstim-rpc/account/v1");

/** 32 bytes as hex (with or without 0x, any case) → bytes; anything else → null. */
export const parseHex32 = (value: string | null | undefined): Uint8Array | null => {
  if (typeof value !== "string") return null;
  const hex = value.startsWith("0x") || value.startsWith("0X") ? value.slice(2) : value;
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) return null;
  return hexToBytes(hex.toLowerCase());
};

/** 32 bytes of hex in any accepted form → canonical 0x-lowercase hex, or null. */
export const normalizeHex32 = (value: string | null | undefined): `0x${string}` | null => {
  const bytes = parseHex32(value);
  return bytes ? `0x${bytesToHex(bytes)}` : null;
};

/** keccak256 of the concatenated parts, as 0x-prefixed lowercase hex. */
export const keccakHex = (...parts: Uint8Array[]): `0x${string}` =>
  `0x${bytesToHex(keccak_256(concatBytes(...parts)))}`;

export const accountIdOf = (accountSecret: Uint8Array) => keccakHex(ACCOUNT_TAG, accountSecret);
export const keyHashOf = (apiKey: Uint8Array) => keccakHex(apiKey);
export const memoOf = (paymentSecret: Uint8Array) => keccakHex(paymentSecret);
