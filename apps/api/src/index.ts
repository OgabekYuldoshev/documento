import { serve } from "@hono/node-server";
import { app } from "./app";
import { env } from "./config/env";
import { startRetentionCleaner } from "./modules/generations/generations.service";
import { startQueue } from "./modules/generations/queue";
import { startUploadCleaner } from "./modules/uploads/uploads.service";

serve({ fetch: app.fetch, port: env.PORT }, ({ port }) => {
  console.log(`API listening on http://localhost:${port}`);
});

await startQueue();
startUploadCleaner();
startRetentionCleaner();
