import { isUnauthorized, queryClient, trpc } from "@/shared/api";

export const sessionQueryOptions = () => ({
  ...trpc.auth.me.queryOptions(),
  retry: false,
  staleTime: 60_000,
});

/** For router loaders: resolves the current user or `null` when signed out. */
export async function getSessionUser() {
  try {
    return await queryClient.ensureQueryData(sessionQueryOptions());
  } catch (error) {
    if (isUnauthorized(error)) return null;
    throw error;
  }
}

export const resetSession = () => queryClient.clear();
