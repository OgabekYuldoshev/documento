import type { AppRouter } from "@documento/api";
import type { inferRouterOutputs } from "@trpc/server";

export type ApiKeyItem = inferRouterOutputs<AppRouter>["apiKeys"]["list"][number];
