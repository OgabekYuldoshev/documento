import { queryClient, trpc } from "@/shared/api";

export const invalidateWebhookQueries = () =>
  queryClient.invalidateQueries(trpc.webhooks.pathFilter());
