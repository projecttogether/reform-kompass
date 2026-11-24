import { defineConfig } from "drizzle-kit";

// Generates SQL migrations into ./drizzle. The application applies them at startup.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
});
