import { queryClient, trpc } from "@/shared/api";

export const invalidateApiKeyQueries = () =>
  queryClient.invalidateQueries(trpc.apiKeys.pathFilter());
