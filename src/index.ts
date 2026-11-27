import { Elysia } from "elysia";
import { openapi } from "@elysia/openapi";
import { rpc, rpcKeyed } from "./modules/rpc";
import { account } from "./modules/account";
import { connectRedis, redisHealthy } from "./lib/redis";
import { dbHealthy, migrateDb } from "./db";
import { leaseStore } from "./lib/billing";
import { setListeningServer } from "./lib/client-id";
import { billingConfig } from "./config/billing";

// The rate limiter and billing fail closed without Redis, and billing keeps
// its balances in Postgres, so refuse to start until both are reachable and
// the schema is current (the container supervisor restarts us). Same
// fail-fast idea as the required env vars.
await connectRedis();
await migrateDb();

const app = new Elysia()
  .use(openapi())
  .get("/", () => "Hello, World!")
  // For deploy checks and monitoring: 200 only if Redis and Postgres both
  // answer. Not rate-limited, no client data.
  .get("/health", async ({ set }) => {
    const [redisOk, dbOk] = await Promise.all([redisHealthy(), dbHealthy()]);
    if (redisOk && dbOk) return "ok";
    set.status = 503;
    return redisOk ? "database unavailable" : "redis unavailable";
  })
  .use(rpc)
  .use(rpcKeyed)
  .use(account)
  .listen(8000);

// Sub-apps (the rate limiters) can't see the server themselves.
setListeningServer(app.server);

// Hand leases that went idle back to Postgres. Failures are retried on the
// next tick; nothing is logged.
setInterval(() => {
  leaseStore.returnIdle().catch(() => {});
}, billingConfig.lease.returnEveryMs);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`
);
