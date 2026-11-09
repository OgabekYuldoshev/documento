import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { trpc } from "@/shared/api";
import { DataTable } from "@/shared/ui";
import { useGenerationsColumns } from "../model/use-generations-columns";

const POLL_MS = 3000;

/** Project generation log; refreshes while something is still rendering. */
export function GenerationsTable({ projectId }: { projectId: string }) {
  const templates = useQuery(trpc.templates.list.queryOptions({ projectId }));
  const names = useMemo(
    () => new Map((templates.data ?? []).map((t) => [t.id, t.name])),
    [templates.data],
  );
  const columns = useGenerationsColumns(names);
  const { data, isPending, error } = useQuery({
    ...trpc.generations.list.queryOptions({ projectId }),
    refetchInterval: (query) =>
      query.state.data?.some((g) => g.status === "queued" || g.status === "processing")
        ? POLL_MS
        : false,
  });

  return (
    <DataTable
      columns={columns}
      data={data}
      getRowId={(g) => g.id}
      isLoading={isPending}
      error={error?.message}
      searchPlaceholder="Shablon yoki manba bo'yicha qidirish..."
      emptyTitle="Hozircha hujjat yaratilmagan"
      emptyDescription="API yoki sinov orqali yaratilgan hujjatlar shu yerda ko'rinadi"
      initialSorting={[{ id: "queuedAt", desc: true }]}
    />
  );
}
