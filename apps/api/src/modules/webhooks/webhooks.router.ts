import {
  listWebhookDeliveriesSchema,
  retryWebhookDeliverySchema,
  saveWebhookSchema,
} from "@documento/shared";
import { router } from "../../trpc/init";
import { managedProjectProcedure } from "../projects/project-procedure";
import { webhooksService } from "./webhooks.service";

/** Webhook secrets and logs: owner / superadmin only. */
export const webhooksRouter = router({
  get: managedProjectProcedure.query(({ ctx }) => webhooksService.get(ctx.project)),

  save: managedProjectProcedure
    .input(saveWebhookSchema)
    .mutation(({ ctx, input }) => webhooksService.save(ctx.actor.id, ctx.project, input)),

  rotateSecret: managedProjectProcedure.mutation(({ ctx }) =>
    webhooksService.rotateSecret(ctx.actor.id, ctx.project),
  ),

  test: managedProjectProcedure.mutation(({ ctx }) => webhooksService.sendPing(ctx.project)),

  deliveries: managedProjectProcedure
    .input(listWebhookDeliveriesSchema.omit({ projectId: true }))
    .query(({ ctx, input }) => webhooksService.deliveries(ctx.project, input.status, input.limit)),

  retry: managedProjectProcedure
    .input(retryWebhookDeliverySchema.omit({ projectId: true }))
    .mutation(({ ctx, input }) => webhooksService.retry(ctx.project, input.deliveryId)),
});
