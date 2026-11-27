import { defineConfig } from "drizzle-kit";

// `bun run db:generate` writes SQL migrations to ./drizzle (committed).
// The app applies them at startup (src/db/index.ts → migrateDb).
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
});
