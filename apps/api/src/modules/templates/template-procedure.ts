import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { projectProcedure } from "../projects/project-procedure";
import { templatesRepository } from "./templates.repository";

/** projectProcedure + `{ templateId }`; the template must belong to the project and be active. */
export const templateProcedure = projectProcedure
  .input(z.object({ templateId: z.string().min(1) }))
  .use(async ({ ctx, input, next }) => {
    const template = await templatesRepository.findTemplate(input.templateId);
    if (!template || template.projectId !== ctx.project.id || template.archivedAt) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Shablon topilmadi" });
    }
    return next({ ctx: { template } });
  });
