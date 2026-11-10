import { PageHeader } from "@/shared/ui";
import { AuditTable } from "@/widgets/audit-table";

export function AuditPage() {
  return (
    <>
      <PageHeader
        title="Audit log"
        description="Kim, qachon va nima qilgani: kirishlar, foydalanuvchilar, project'lar va API keylar. Oxirgi 500 ta yozuv."
      />
      <AuditTable />
    </>
  );
}
