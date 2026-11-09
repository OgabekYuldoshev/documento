import type { AppRouter } from "@documento/api";
import type { inferRouterOutputs } from "@trpc/server";

export type GenerationItem = inferRouterOutputs<AppRouter>["generations"]["list"][number];
