import type { Role } from "@documento/shared";
import { protectedProcedure, router } from "../../trpc/init";

export const authRouter = router({
  /** Current authenticated user. Sign-in/out go through the Better Auth endpoints. */
  me: protectedProcedure.query(({ ctx }) => {
    const { user } = ctx.session;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image ?? null,
      role: (user.role ?? "user") as Role,
    };
  }),
});
