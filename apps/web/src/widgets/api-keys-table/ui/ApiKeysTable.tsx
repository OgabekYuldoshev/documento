import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/shared/api";
import { DataTable } from "@/shared/ui";
import { useApiKeysColumns } from "../model/use-api-keys-columns";

export function ApiKeysTable({ projectId }: { projectId: string }) {
  const columns = useApiKeysColumns(projectId);
  const { data, isPending, error } = useQuery(trpc.apiKeys.list.queryOptions({ projectId }));

  return (
    <DataTable
      columns={columns}
      data={data}
      getRowId={(k) => k.id}
      isLoading={isPending}
      error={error?.message}
      searchPlaceholder="Nomi bo'yicha qidirish..."
      emptyTitle="Hozircha API key yo'q"
      emptyDescription="Tashqi tizim hujjat yaratishi uchun key yarating"
    />
  );
}
