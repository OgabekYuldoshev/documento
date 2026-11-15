import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./client";
import { convertLegacySchemas } from "./legacy-schema";

await migrate(db, { migrationsFolder: new URL("./migrations", import.meta.url).pathname });
console.log("✔ migrations applied");
const converted = await convertLegacySchemas();
if (converted > 0) console.log(`✔ converted ${converted} legacy template schema(s) to JSON Schema`);
await pool.end();
