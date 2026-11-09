import { z } from "zod";
import { router } from "../../trpc/init";
import { templateProcedure } from "../templates/template-procedure";
import { assetsService } from "./assets.service";

export const templateAssetsRouter = router({
  list: templateProcedure.query(({ ctx }) => assetsService.list(ctx.template)),
  delete: templateProcedure
    .input(z.object({ assetId: z.string().min(1) }))
    .mutation(({ ctx, input }) => assetsService.remove(ctx.template, input.assetId)),
});
