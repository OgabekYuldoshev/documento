import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { GENERATION_STATUSES } from "../../db/schema";
import { protectedProcedure, router } from "../../trpc/init";
import { projectProcedure } from "../projects/project-procedure";
import { generationsService, toPublicGeneration } from "./generations.service";

const MAX_WAIT_MS = 25_000;

export const generationsRouter = router({
  activity: protectedProcedure.query(({ ctx }) => generationsService.activity(ctx.actor)),

  list: projectProcedure
    .input(
      z.object({
        templateId: z.string().min(1).optional(),
        status: z.enum(GENERATION_STATUSES).optional(),
      }),
    )
    .query(({ ctx, input }) => generationsService.list(ctx.project, input)),

  get: projectProcedure
    .input(z.object({ generationId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const row = await generationsService.get(ctx.actor, input.generationId);
      if (row.projectId !== ctx.project.id)
        throw new TRPCError({ code: "NOT_FOUND", message: "Generatsiya topilmadi" });
      return toPublicGeneration(row);
    }),

  /** Test run from the UI: queues a render of a published version and optionally waits for it. */
  create: projectProcedure
    .input(
      z.object({
        templateId: z.string().min(1),
        data: z.record(z.string(), z.unknown()),
        versionNumber: z.number().int().positive().optional(),
        waitMs: z.number().int().min(0).max(MAX_WAIT_MS).default(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const created = await generationsService.create(
        { source: "ui", userId: ctx.actor.id },
        ctx.project,
        input,
      );
      if (input.waitMs === 0) return created;
      const done = await generationsService.waitFor(created.id, input.waitMs);
      return done ? toPublicGeneration(done) : created;
    }),
});
