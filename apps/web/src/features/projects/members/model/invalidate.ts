import { queryClient, trpc } from "@/shared/api";

/** Membership changes who sees which project: refresh members, project lists and dashboards. */
export const invalidateMemberQueries = () =>
  Promise.all([
    queryClient.invalidateQueries(trpc.projectMembers.pathFilter()),
    queryClient.invalidateQueries(trpc.projects.pathFilter()),
    queryClient.invalidateQueries(trpc.templates.pathFilter()),
    queryClient.invalidateQueries(trpc.dashboard.pathFilter()),
  ]);
