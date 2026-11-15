import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { env } from "../config/env";
import * as schema from "./schema";

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: env.DATABASE_POOL_MAX,
});

// An idle client can error (server restart, network drop). Without a listener Node crashes.
pool.on("error", (error) => console.error("[db] idle client error", error));

export const db = drizzle(pool, { schema });
export type Database = typeof db;
export { schema };
