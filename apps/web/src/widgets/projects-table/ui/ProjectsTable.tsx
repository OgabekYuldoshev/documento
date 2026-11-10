import { useDebouncedValue } from "@mantine/hooks";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";
import { CreateProjectButton } from "@/features/projects/create-project";
import { trpc } from "@/shared/api";
import { ROUTES } from "@/shared/config";
import { DataTable } from "@/shared/ui";
import { useProjectsColumns } from "../model/use-projects-columns";

export function ProjectsTable() {
  const navigate = useNavigate();
  const columns = useProjectsColumns();
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search.trim(), 300);

  const { data, isPending, error } = useQuery(
    trpc.projects.page.queryOptions(
      { limit: pageSize, offset: pageIndex * pageSize, search: debouncedSearch || undefined },
      { placeholderData: keepPreviousData },
    ),
  );

  return (
    <DataTable
      columns={columns}
      data={data?.items}
      getRowId={(project) => project.id}
      isLoading={isPending}
      error={error?.message}
      searchPlaceholder="Nomi yoki tavsif bo'yicha qidirish..."
      emptyTitle="Hozircha project yo'q"
      emptyDescription="Shablonlar va API kalitlar project ichida saqlanadi"
      emptyAction={<CreateProjectButton />}
      onRowClick={(project) => navigate(ROUTES.project(project.id))}
      serverSide={{
        rowCount: data?.total ?? 0,
        pageIndex,
        pageSize,
        onPageIndexChange: setPageIndex,
        onPageSizeChange: (n) => {
          setPageSize(n);
          setPageIndex(0);
        },
        search,
        onSearchChange: (value) => {
          setSearch(value);
          setPageIndex(0);
        },
      }}
    />
  );
}
