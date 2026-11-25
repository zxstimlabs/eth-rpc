import { Elysia } from "elysia";
import { openapi } from "@elysia/openapi";
import { rpc } from "./modules/rpc";
import { connectRedis, redisHealthy } from "./lib/redis";
import { setListeningServer } from "./lib/client-id";

// The rate limiter keeps its counts in Redis and fails closed without it,
// so refuse to start until Redis is reachable (the container supervisor
// restarts us). Same fail-fast idea as the required env vars.
await connectRedis();

const app = new Elysia()
  .use(openapi())
  .get("/", () => "Hello, World!")
  // For deploy checks and monitoring: 200 only if Redis answers, since
  // /rpc/* returns 503 without it. Not rate-limited, no client data.
  .get("/health", async ({ set }) => {
    if (await redisHealthy()) return "ok";
    set.status = 503;
    return "redis unavailable";
  })
  .use(rpc)
  .listen(8000);

// Sub-apps (the /rpc rate limiter) can't see the server themselves.
setListeningServer(app.server);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`
);
