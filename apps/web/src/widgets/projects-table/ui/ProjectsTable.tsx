import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { CreateProjectButton } from "@/features/projects/create-project";
import { trpc } from "@/shared/api";
import { ROUTES } from "@/shared/config";
import { DataTable } from "@/shared/ui";
import { useProjectsColumns } from "../model/use-projects-columns";

export function ProjectsTable() {
  const navigate = useNavigate();
  const columns = useProjectsColumns();
  const { data, isPending, error } = useQuery(trpc.projects.list.queryOptions());

  return (
    <DataTable
      columns={columns}
      data={data}
      getRowId={(project) => project.id}
      isLoading={isPending}
      error={error?.message}
      searchPlaceholder="Nomi yoki tavsif bo'yicha qidirish..."
      initialSorting={[{ id: "createdAt", desc: true }]}
      emptyTitle="Hozircha project yo'q"
      emptyDescription="Shablonlar va API kalitlar project ichida saqlanadi"
      emptyAction={<CreateProjectButton />}
      onRowClick={(project) => navigate(ROUTES.project(project.id))}
    />
  );
}
