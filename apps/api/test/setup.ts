import { migrate } from "drizzle-orm/libsql/migrator";
import { beforeAll } from "vitest";
import { db } from "../src/db/client";

beforeAll(async () => {
  await migrate(db, {
    migrationsFolder: new URL("../src/db/migrations", import.meta.url).pathname,
  });
});
