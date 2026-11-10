import { WEBHOOK_EVENTS } from "@documento/shared";
import { Badge, Group, Text, Tooltip } from "@mantine/core";
import { useMemo } from "react";
import { WEBHOOK_STATUS_META, type WebhookDeliveryItem } from "@/entities/webhook";
import { RetryDeliveryButton } from "@/features/webhooks/retry-delivery";
import { formatDate } from "@/shared/lib";
import { createDataTableColumns } from "@/shared/ui";

const col = createDataTableColumns<WebhookDeliveryItem>();

export function useDeliveriesColumns(projectId: string) {
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
      col.accessor((row) => (WEBHOOK_EVENTS as Record<string, string>)[row.event] ?? row.event, {
        id: "event",
        header: "Hodisa",
        cell: ({ getValue }) => <Text size="sm">{getValue()}</Text>,
      }),
      col.accessor("status", {
        header: "Holati",
        enableGlobalFilter: false,
        cell: ({ row }) => {
          const meta = WEBHOOK_STATUS_META[row.original.status];
          const retryAt = row.original.nextAttemptAt;
          const badge = (
            <Badge variant="dot" color={meta.color}>
              {meta.label}
            </Badge>
          );
          if (row.original.status === "pending" && retryAt) {
            return (
              <Tooltip label={`Keyingi urinish: ${formatDate(retryAt)}`}>
                <span>{badge}</span>
              </Tooltip>
            );
          }
          return row.original.lastError ? (
            <Tooltip label={row.original.lastError} multiline maw={320}>
              <span>{badge}</span>
            </Tooltip>
          ) : (
            badge
          );
        },
      }),
      col.accessor((row) => row.lastStatusCode ?? 0, {
        id: "code",
        header: "HTTP",
        sortFn: "basic",
        enableGlobalFilter: false,
        cell: ({ row }) => (
          <Text size="sm" c="dimmed">
            {row.original.lastStatusCode ?? "—"}
          </Text>
        ),
      }),
      col.accessor("attempts", {
        header: "Urinish",
        sortFn: "basic",
        enableGlobalFilter: false,
        cell: ({ getValue }) => <Text size="sm">{getValue()}</Text>,
      }),
      col.accessor((row) => row.durationMs ?? 0, {
        id: "duration",
        header: "Davomiyligi",
        sortFn: "basic",
        enableGlobalFilter: false,
        cell: ({ row }) => (
          <Text size="sm" c="dimmed">
            {row.original.durationMs === null ? "—" : `${row.original.durationMs} ms`}
          </Text>
        ),
      }),
      col.display({
        id: "actions",
        header: "",
        enableSorting: false,
        meta: { align: "right", width: 70 },
        cell: ({ row }) =>
          row.original.status === "failed" && row.original.event !== "ping" ? (
            <Group justify="flex-end">
              <RetryDeliveryButton projectId={projectId} deliveryId={row.original.id} />
            </Group>
          ) : null,
      }),
    ],
    [projectId],
  );
}
