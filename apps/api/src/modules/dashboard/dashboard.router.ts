import { adminProcedure, protectedProcedure, router } from "../../trpc/init";
import { generationsService } from "../generations/generations.service";
import { usersService } from "../users/users.service";

export const dashboardRouter = router({
  /** Home page data for every signed-in user, scoped to the projects they can access. */
  home: protectedProcedure.query(async ({ ctx }) => ({
    activity: await generationsService.activity(ctx.actor),
    recent: await generationsService.recent(ctx.actor),
  })),

  overview: adminProcedure.query(async () => ({
    stats: await usersService.stats(),
    recentUsers: await usersService.recent(5),
    growth: await usersService.growth(),
  })),
});
