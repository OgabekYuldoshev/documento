import { serve } from "@hono/node-server";
import { app } from "./app";
import { env } from "./config/env";
import { startQueue } from "./modules/generations/queue";

serve({ fetch: app.fetch, port: env.PORT }, ({ port }) => {
  console.log(`API listening on http://localhost:${port}`);
});

await startQueue();
