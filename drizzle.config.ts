import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// RUN THIS TO GENERATE EXISTING DB SCHEMA:
// NODE_TLS_REJECT_UNAUTHORIZED=0 npx drizzle-kit introspect

export default defineConfig({
  schema: "./app/lib/db/schema.ts",
  out: "./app/lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.POSTGRES_URL!,
    ssl: {
      rejectUnauthorized: false,
    },
  },
});
