import { queryClient, trpc } from "@/shared/api";

/** Everything derived from the users table must refresh after a user mutation. */
export const invalidateUserQueries = () =>
  Promise.all([
    queryClient.invalidateQueries(trpc.users.pathFilter()),
    queryClient.invalidateQueries(trpc.dashboard.pathFilter()),
  ]);
