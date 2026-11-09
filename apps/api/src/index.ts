import { serve } from "@hono/node-server";
import { app } from "./app";
import { env } from "./config/env";

serve({ fetch: app.fetch, port: env.PORT }, ({ port }) => {
  console.log(`API listening on http://localhost:${port}`);
});
