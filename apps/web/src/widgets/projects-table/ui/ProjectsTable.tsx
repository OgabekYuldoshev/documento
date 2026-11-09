import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/shared/api";
import { DataTable } from "@/shared/ui";
import { useProjectsColumns } from "../model/use-projects-columns";

export function ProjectsTable() {
  const columns = useProjectsColumns();
  const { data, isPending, error } = useQuery(trpc.projects.list.queryOptions());

  return (
    <DataTable
      columns={columns}
      data={data}
      getRowId={(project) => project.id}
      isLoading={isPending}
      error={error?.message}
      searchPlaceholder="Nomi bo'yicha qidirish..."
      initialSorting={[{ id: "createdAt", desc: true }]}
      emptyTitle="Hozircha project yo'q"
      emptyDescription="Birinchi projectni yaratib boshlang"
    />
  );
}
