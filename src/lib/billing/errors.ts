/**
 * Billing errors. Controllers map them to HTTP statuses; nothing logs them.
 */

/** Redis or Postgres couldn't answer (in time). Fail closed: 503. */
export class BillingUnavailableError extends Error {
  constructor() {
    super("billing unavailable");
    this.name = "BillingUnavailableError";
  }
}

/** The account can't cover the request. 402. */
export class InsufficientCreditsError extends Error {
  constructor() {
    super("out of credits");
    this.name = "InsufficientCreditsError";
  }
}

/** Run a Redis command with a deadline; any failure → BillingUnavailableError. */
export const redisOp = async <T>(
  connected: boolean,
  command: () => Promise<T>,
  timeoutMs: number
): Promise<T> => {
  if (!connected) throw new BillingUnavailableError();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      command(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new BillingUnavailableError()), timeoutMs);
      }),
    ]);
  } catch {
    throw new BillingUnavailableError();
  } finally {
    clearTimeout(timer);
  }
};

/** Run a Postgres operation; driver/connection failures → BillingUnavailableError. */
export const dbOp = async <T>(operation: () => Promise<T>): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof InsufficientCreditsError || error instanceof BillingUnavailableError) {
      throw error;
    }
    throw new BillingUnavailableError();
  }
};
