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

// Defaults are journal_mode=DELETE and busy_timeout=0: readers block the writer and any
// contention fails at once with SQLITE_BUSY. The queue, the cleaners and requests all write.
await client.execute("PRAGMA busy_timeout = 5000");
await client.execute("PRAGMA foreign_keys = ON");
if (env.DATABASE_URL.startsWith("file:")) {
  await client.execute("PRAGMA journal_mode = WAL");
  await client.execute("PRAGMA synchronous = NORMAL"); // safe with WAL; far fewer fsyncs
}

export const db = drizzle(client, { schema });
export type Database = typeof db;
export { client as sqlite, schema };
