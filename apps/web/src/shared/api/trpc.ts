import type { AppRouter } from "@documento/api";
import { createTRPCClient, httpBatchLink, TRPCClientError } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import superjson from "superjson";
import { queryClient } from "./query-client";

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch: (url, options) => fetch(url, { ...options, credentials: "include" }),
    }),
  ],
});

/** Typed query/mutation option factories: `useQuery(trpc.users.list.queryOptions())`. */
export const trpc = createTRPCOptionsProxy<AppRouter>({ client: trpcClient, queryClient });

export const isUnauthorized = (error: unknown) =>
  error instanceof TRPCClientError && error.data?.code === "UNAUTHORIZED";

export const getErrorMessage = (error: unknown, fallback = "Something went wrong") =>
  error instanceof Error && error.message ? error.message : fallback;
