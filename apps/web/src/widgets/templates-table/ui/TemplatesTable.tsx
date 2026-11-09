import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/shared/api";
import { DataTable } from "@/shared/ui";
import { useTemplatesColumns } from "../model/use-templates-columns";

export function TemplatesTable({ projectId }: { projectId: string }) {
  const columns = useTemplatesColumns(projectId);
  const { data, isPending, error } = useQuery(trpc.templates.list.queryOptions({ projectId }));

  return (
    <DataTable
      columns={columns}
      data={data}
      getRowId={(t) => t.id}
      isLoading={isPending}
      error={error?.message}
      searchPlaceholder="Nomi bo'yicha qidirish..."
      initialSorting={[{ id: "updatedAt", desc: true }]}
      emptyTitle="Hozircha shablon yo'q"
      emptyDescription="Birinchi hujjat shablonini yarating"
    />
  );
}
