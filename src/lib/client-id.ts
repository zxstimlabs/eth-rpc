/**
 * Client identification for rate limiting
 * ---------------------------------------
 * Turns a request into an opaque identifier that rate-limit stores can
 * bucket on without keeping IPs anywhere.
 *
 * The salt is generated once per process and never persisted. Restart =
 * new salt, so cached hashes from a previous run cannot be correlated.
 * The rate-limit store only ever sees the hex digest.
 */

import { createHash, randomBytes } from "node:crypto";
import type { Elysia } from "elysia";

const IP_HASH_SALT = randomBytes(32);

/**
 * SHA-256(salt || ip) as a hex string. Salt is prepended for domain
 * separation (output cannot be confused with a plain SHA-256(ip) lookup
 * against a precomputed table of known IPs).
 */
export const hashClientIp = (ip: string): string =>
  createHash("sha256").update(IP_HASH_SALT).update(ip).digest("hex");

type AppServer = Elysia["server"];

/**
 * The client's IP, or undefined if it can't be determined.
 *
 * With `trustProxy`, the `X-Real-IP` header wins. Only enable that when
 * the app is reachable solely through a reverse proxy that **overwrites**
 * the header with the real peer address (our nginx does
 * `proxy_set_header X-Real-IP $remote_addr;`, and the container port is
 * bound to 127.0.0.1). Otherwise a client could send its own header and
 * pick its own bucket.
 *
 * Without the header (or without trust), falls back to the direct TCP peer.
 */
export const clientIp = (
  request: Request,
  server: AppServer | null | undefined,
  trustProxy: boolean
): string | undefined => {
  if (trustProxy) {
    const real = request.headers.get("x-real-ip")?.trim();
    if (real) return real;
  }
  return server?.requestIP(request)?.address ?? undefined;
};

/**
 * The listening server, for code that runs inside sub-apps. Elysia only
 * sets `.server` on the app that called `.listen()`; a plugin mounted on a
 * sub-app (like the rate limiter on `/rpc`) sees `null` there. `src/index.ts`
 * registers the real server here after `.listen()`.
 */
let listeningServer: AppServer | null = null;
export const setListeningServer = (server: AppServer | null | undefined): void => {
  listeningServer = server ?? null;
};
export const getListeningServer = (): AppServer | null => listeningServer;
