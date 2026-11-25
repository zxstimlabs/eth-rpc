import { Elysia } from "elysia";
import { openapi } from "@elysia/openapi";
import { rpc } from "./modules/rpc";

const app = new Elysia()
  .use(openapi())
  .get("/", () => "Hello, World!")
  .use(rpc)
  .listen(8000);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`
);
