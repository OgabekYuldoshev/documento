import { AUDIT_ACTIONS } from "@documento/shared";
import { Select } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { trpc } from "@/shared/api";
import { DataTable } from "@/shared/ui";
import { useAuditColumns } from "../model/use-audit-columns";

const ACTION_OPTIONS = Object.entries(AUDIT_ACTIONS).map(([value, label]) => ({ value, label }));

export function AuditTable() {
  const columns = useAuditColumns();
  const [action, setAction] = useState<string | null>(null);
  const { data, isPending, error } = useQuery({
    ...trpc.audit.list.queryOptions({
      action: action ? (action as keyof typeof AUDIT_ACTIONS) : undefined,
      limit: 500,
    }),
    // Keep rows on screen while a filter change refetches.
    placeholderData: (prev) => prev,
  });

  return (
    <DataTable
      columns={columns}
      data={data}
      getRowId={(row) => row.id}
      isLoading={isPending}
      error={error?.message}
      searchPlaceholder="Foydalanuvchi, obyekt yoki izoh bo'yicha qidirish..."
      toolbar={
        <Select
          aria-label="Amal turi"
          placeholder="Barcha amallar"
          data={ACTION_OPTIONS}
          value={action}
          onChange={setAction}
          clearable
          searchable
          w={260}
        />
      }
      initialSorting={[{ id: "createdAt", desc: true }]}
      emptyTitle="Yozuvlar topilmadi"
      emptyDescription="Muhim amallar (kirish, foydalanuvchi, project, API key) shu yerda qayd etiladi"
    />
  );
}
