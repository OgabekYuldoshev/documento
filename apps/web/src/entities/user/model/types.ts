import type { AppRouter } from "@documento/api";
import type { inferRouterOutputs } from "@trpc/server";

export type User = inferRouterOutputs<AppRouter>["users"]["list"][number];
