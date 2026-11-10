import { createApiKeySchema, revokeApiKeySchema } from "@documento/shared";
import { router } from "../../trpc/init";
import { projectProcedure } from "../projects/project-procedure";
import { apiKeysService } from "./api-keys.service";

export const apiKeysRouter = router({
  list: projectProcedure.query(({ ctx }) => apiKeysService.list(ctx.project)),

  create: projectProcedure
    .input(createApiKeySchema)
    .mutation(({ ctx, input }) => apiKeysService.create(ctx.actor.id, ctx.project, input)),

  revoke: projectProcedure
    .input(revokeApiKeySchema)
    .mutation(({ ctx, input }) => apiKeysService.revoke(ctx.actor.id, ctx.project, input.apiKeyId)),
});
