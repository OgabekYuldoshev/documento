import { adminProcedure, router } from "../../trpc/init";
import { usersService } from "../users/users.service";

export const dashboardRouter = router({
  overview: adminProcedure.query(async () => ({
    stats: await usersService.stats(),
    recentUsers: await usersService.recent(5),
  })),
});
