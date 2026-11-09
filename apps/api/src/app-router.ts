import { authRouter } from "./modules/auth/auth.router";
import { dashboardRouter } from "./modules/dashboard/dashboard.router";
import { usersRouter } from "./modules/users/users.router";
import { router } from "./trpc/init";

export const appRouter = router({
  auth: authRouter,
  users: usersRouter,
  dashboard: dashboardRouter,
});

/** Type-only contract consumed by the web app: `import type { AppRouter } from "@documento/api"`. */
export type AppRouter = typeof appRouter;
