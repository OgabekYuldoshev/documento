import { apiKeysRouter } from "./modules/api-keys/api-keys.router";
import { templateAssetsRouter } from "./modules/assets/assets.router";
import { auditRouter } from "./modules/audit/audit.router";
import { authRouter } from "./modules/auth/auth.router";
import { dashboardRouter } from "./modules/dashboard/dashboard.router";
import { generationsRouter } from "./modules/generations/generations.router";
import { projectsRouter } from "./modules/projects/projects.router";
import { templatesRouter } from "./modules/templates/templates.router";
import { usersRouter } from "./modules/users/users.router";
import { router } from "./trpc/init";

export const appRouter = router({
  auth: authRouter,
  users: usersRouter,
  dashboard: dashboardRouter,
  projects: projectsRouter,
  templates: templatesRouter,
  templateAssets: templateAssetsRouter,
  generations: generationsRouter,
  apiKeys: apiKeysRouter,
  audit: auditRouter,
});

/** Type-only contract consumed by the web app: `import type { AppRouter } from "@documento/api"`. */
export type AppRouter = typeof appRouter;
