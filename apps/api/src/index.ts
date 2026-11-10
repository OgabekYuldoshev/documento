import { serve } from "@hono/node-server";
import { app } from "./app";
import { env } from "./config/env";
import { convertLegacySchemas } from "./db/legacy-schema";
import { startAuditCleaner } from "./modules/audit/audit.service";
import { startRetentionCleaner } from "./modules/generations/generations.service";
import { startQueue } from "./modules/generations/queue";
import { startPreviewCleaner } from "./modules/previews/previews.service";
import { startUploadCleaner } from "./modules/uploads/uploads.service";
import { startWebhookWorker } from "./modules/webhooks/webhooks.service";

serve({ fetch: app.fetch, port: env.PORT }, ({ port }) => {
  console.log(`API listening on http://localhost:${port}`);
});

await convertLegacySchemas(); // dev DBs created before the JSON Schema switch
await startQueue();
startUploadCleaner();
startPreviewCleaner();
startRetentionCleaner();
startAuditCleaner();
startWebhookWorker();
