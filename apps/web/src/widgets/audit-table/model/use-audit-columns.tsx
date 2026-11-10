import { getAuditActionLabel } from "@documento/shared";
import { Badge, Text } from "@mantine/core";
import { useMemo } from "react";
import { formatDate } from "@/shared/lib";
import { createDataTableColumns } from "@/shared/ui";

export type AuditItem = {
  id: string;
  createdAt: Date;
  actorId: string | null;
  actorLabel: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  targetLabel: string | null;
  detail: string | null;
  ip: string | null;
};

const col = createDataTableColumns<AuditItem>();

const actionColor = (action: string) =>
  action.endsWith("_failed") || action.endsWith("_blocked") || action.endsWith("removed")
    ? "red"
    : action.endsWith("deleted") || action.endsWith("banned") || action.endsWith("revoked")
      ? "orange"
      : action.startsWith("auth.")
        ? "gray"
        : "brand";

const dim = (value: string | null) => (
  <Text size="sm" c={value ? undefined : "dimmed"} lineClamp={2}>
    {value ?? "—"}
  </Text>
);

export function useAuditColumns() {
  return useMemo(
    () => [
      col.accessor((row) => row.createdAt.getTime(), {
        id: "createdAt",
        header: "Vaqt",
        sortFn: "basic",
        enableGlobalFilter: false,
        meta: { width: 190 },
        cell: ({ row }) => (
          <Text size="sm" c="dimmed">
            {formatDate(row.original.createdAt)}
          </Text>
        ),
      }),
      col.accessor((row) => row.actorLabel ?? "", {
        id: "actor",
        header: "Kim",
        cell: ({ row }) => dim(row.original.actorLabel),
      }),
      col.accessor((row) => getAuditActionLabel(row.action), {
        id: "action",
        header: "Amal",
        enableGlobalFilter: false,
        cell: ({ row }) => (
          <Badge variant="light" color={actionColor(row.original.action)}>
            {getAuditActionLabel(row.original.action)}
          </Badge>
        ),
      }),
      col.accessor((row) => `${row.targetLabel ?? ""} ${row.detail ?? ""}`, {
        id: "target",
        header: "Obyekt",
        cell: ({ row }) => (
          <>
            {dim(row.original.targetLabel)}
            {row.original.detail && (
              <Text size="xs" c="dimmed" lineClamp={2}>
                {row.original.detail}
              </Text>
            )}
          </>
        ),
      }),
      col.accessor((row) => row.ip ?? "", {
        id: "ip",
        header: "IP",
        enableGlobalFilter: false,
        cell: ({ row }) => (
          <Text size="xs" c="dimmed" ff="monospace">
            {row.original.ip ?? "—"}
          </Text>
        ),
      }),
    ],
    [],
  );
}
