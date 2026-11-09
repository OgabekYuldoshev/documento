import { queryClient, trpc } from "@/shared/api";

/** Refresh every template query (list, draft, versions) after a template mutation. */
export const invalidateTemplateQueries = () =>
  queryClient.invalidateQueries(trpc.templates.pathFilter());
