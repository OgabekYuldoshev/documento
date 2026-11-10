import type { AppRouter } from "@documento/api";
import type { inferRouterOutputs } from "@trpc/server";

export type GenerationItem = inferRouterOutputs<AppRouter>["generations"]["list"][number];

/** A row of the dashboard feed: a generation with its template and project names. */
export type RecentGeneration = inferRouterOutputs<AppRouter>["dashboard"]["home"]["recent"][number];
