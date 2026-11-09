import { migrate } from "drizzle-orm/libsql/migrator";
import { db, sqlite } from "./client";

await migrate(db, { migrationsFolder: new URL("./migrations", import.meta.url).pathname });
console.log("✔ migrations applied");
sqlite.close();
