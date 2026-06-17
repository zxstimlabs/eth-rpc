import { Elysia } from "elysia";
import { openapi } from "@elysia/openapi";
import { rpc } from "./modules/rpc";
import { prices } from "./modules/prices";
import { swapagg } from "./modules/swapagg";
import { tokens } from "./modules/tokens";
import { TokensRefresh } from "./modules/tokens/refresh";

// Warm the tokens market cache before accepting traffic. The market-refresh
// cron only fires every ~15 minutes, so without this the first `/tokens`
// responses after a cold boot would be empty. A failure here is logged but
// non-fatal — the next cron tick retries, and we'd rather serve a thin list
// briefly than refuse to start. (Profiles fill in on the daily sweep.)
try {
  await TokensRefresh.refreshMarkets();
} catch (err) {
  console.error("[tokens] cold-start market refresh failed:", err);
}

const app = new Elysia()
  .use(openapi())
  .get("/", () => "Hello, World!")
  .use(rpc)
  .use(prices)
  .use(swapagg)
  .use(tokens)
  .listen(8000);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`
);
