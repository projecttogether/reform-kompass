import path from "node:path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { schema } from "./schema";

/** Any Drizzle Postgres database with the application schema (node-postgres in production, PGlite in tests). */
export type Datenbank = PgDatabase<PgQueryResultHKT, typeof schema>;

export function verbindeDatenbank(url: string) {
  // Fail fast when the database is down; anonymous pages never wait on it.
  const pool = new Pool({ connectionString: url, max: 10, connectionTimeoutMillis: 3000 });
  pool.on("error", (error) => console.error("Postgres pool error:", error));
  return drizzle(pool, { schema });
}

/** Applies SQL migrations from ./drizzle relative to the server's working directory. */
export async function migriereDatenbank(db: ReturnType<typeof verbindeDatenbank>) {
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
}
