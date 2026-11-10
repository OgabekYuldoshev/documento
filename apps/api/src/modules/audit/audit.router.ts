import { listAuditSchema } from "@documento/shared";
import { adminProcedure, router } from "../../trpc/init";
import { auditService } from "./audit.service";

export const auditRouter = router({
  list: adminProcedure.input(listAuditSchema).query(({ input }) => auditService.list(input)),
});
