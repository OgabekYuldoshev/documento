import { queryClient, trpc } from "@/shared/api";

/** Refresh every project query (list + detail) after a project mutation. */
export const invalidateProjectQueries = () =>
  queryClient.invalidateQueries(trpc.projects.pathFilter());
