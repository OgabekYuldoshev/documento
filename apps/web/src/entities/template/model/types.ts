import type { AppRouter } from "@documento/api";
import type { inferRouterOutputs } from "@trpc/server";

type Outputs = inferRouterOutputs<AppRouter>["templates"];

export type TemplateListItem = Outputs["list"][number];
export type TemplateDraft = NonNullable<Outputs["draft"]>;
export type TemplateVersionItem = Outputs["versions"][number];
