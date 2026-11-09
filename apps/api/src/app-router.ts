import { authRouter } from "./modules/auth/auth.router";
import { dashboardRouter } from "./modules/dashboard/dashboard.router";
import { projectsRouter } from "./modules/projects/projects.router";
import { usersRouter } from "./modules/users/users.router";
import { router } from "./trpc/init";

export const appRouter = router({
  auth: authRouter,
  users: usersRouter,
  dashboard: dashboardRouter,
  projects: projectsRouter,
});

/** Type-only contract consumed by the web app: `import type { AppRouter } from "@documento/api"`. */
export type AppRouter = typeof appRouter;
