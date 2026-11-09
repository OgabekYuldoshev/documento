import { useQuery } from "@tanstack/react-query";
import { CreateApiKeyButton } from "@/features/api-keys/create-api-key";
import { trpc } from "@/shared/api";
import { DataTable } from "@/shared/ui";
import { useApiKeysColumns } from "../model/use-api-keys-columns";

export function ApiKeysTable({ projectId }: { projectId: string }) {
  const columns = useApiKeysColumns(projectId);
  const { data, isPending, error } = useQuery(trpc.apiKeys.list.queryOptions({ projectId }));

  const hasKeys = (data?.length ?? 0) > 0;
  const createButton = <CreateApiKeyButton projectId={projectId} />;

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
      // Create button shares the search row; when empty it moves into the empty state instead.
      toolbar={hasKeys ? createButton : undefined}
      searchable={hasKeys}
      emptyAction={createButton}
    />
  );
}
