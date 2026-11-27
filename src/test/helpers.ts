/**
 * Shared test helpers. Tests need a disposable Redis (`REDIS_URL`) and
 * Postgres (`DATABASE_URL`) — see deploy/compose.test.yaml.
 */

import { eq } from "drizzle-orm";
import { db } from "../db";
import { accounts } from "../db/schema";

/** 32 random bytes as 0x-hex. */
export const randomHex32 = (): `0x${string}` =>
  `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex")}`;

/** A fresh account row with `balance` credits; returns its id. */
export const newAccount = async (balance = 0): Promise<string> => {
  const id = randomHex32();
  await db.insert(accounts).values({ id, balance });
  return id;
};

export const accountRow = async (id: string) =>
  (await db.select().from(accounts).where(eq(accounts.id, id)))[0]!;

export const setBalance = (id: string, balance: number) =>
  db.update(accounts).set({ balance }).where(eq(accounts.id, id));
