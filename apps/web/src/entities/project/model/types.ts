import type { AppRouter } from "@documento/api";
import type { inferRouterOutputs } from "@trpc/server";

export type Project = inferRouterOutputs<AppRouter>["projects"]["list"][number];
