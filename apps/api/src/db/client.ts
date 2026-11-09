import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { env } from "../config/env";
import * as schema from "./schema";

// Fresh clones have no data/ dir; libSQL will not create it.
if (env.DATABASE_URL.startsWith("file:")) {
  mkdirSync(dirname(env.DATABASE_URL.slice("file:".length)), { recursive: true });
}

const client = createClient({ url: env.DATABASE_URL });

export const db = drizzle(client, { schema });
export type Database = typeof db;
export { client as sqlite, schema };
