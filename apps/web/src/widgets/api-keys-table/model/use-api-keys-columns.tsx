import { Badge, Code, Group, Text } from "@mantine/core";
import { useMemo } from "react";
import type { ApiKeyItem } from "@/entities/api-key";
import { RevokeApiKeyButton } from "@/features/api-keys/revoke-api-key";
import { formatDate } from "@/shared/lib";
import { createDataTableColumns } from "@/shared/ui";

const col = createDataTableColumns<ApiKeyItem>();

function statusOf(k: ApiKeyItem) {
  if (k.revokedAt) return { label: "Bekor qilingan", color: "gray" };
  if (k.expiresAt && k.expiresAt.getTime() <= Date.now())
    return { label: "Muddati o'tgan", color: "orange" };
  return { label: "Faol", color: "teal" };
}

export function useApiKeysColumns(projectId: string) {
  return useMemo(
    () => [
      col.accessor((row) => `${row.name} ${row.prefix}`, {
        id: "key",
        header: "Key",
        cell: ({ row }) => (
          <div>
            <Text size="sm" fw={500} lh={1.3}>
              {row.original.name}
            </Text>
            <Code>{`dk_live_${row.original.prefix}…`}</Code>
          </div>
        ),
      }),
      col.display({
        id: "scope",
        header: "Doira",
        enableSorting: false,
        cell: ({ row }) => (
          <Text size="sm">
            {row.original.scope === "project"
              ? "Butun project"
              : `${row.original.allowedTemplateIds?.length ?? 0} ta shablon`}
          </Text>
        ),
      }),
      col.accessor("rateLimitPerMin", {
        header: "Limit",
        sortFn: "basic",
        enableGlobalFilter: false,
        cell: ({ getValue }) => <Text size="sm">{getValue()}/daq</Text>,
      }),
      col.accessor((row) => row.lastUsedAt?.getTime() ?? 0, {
        id: "lastUsedAt",
        header: "Oxirgi ishlatilgan",
        sortFn: "basic",
        enableGlobalFilter: false,
        cell: ({ row }) => (
          <Text size="sm" c="dimmed">
            {row.original.lastUsedAt ? formatDate(row.original.lastUsedAt) : "Hali yo'q"}
          </Text>
        ),
      }),
      col.display({
        id: "status",
        header: "Holati",
        enableSorting: false,
        cell: ({ row }) => {
          const s = statusOf(row.original);
          return (
            <Badge variant="dot" color={s.color}>
              {s.label}
            </Badge>
          );
        },
      }),
      col.display({
        id: "actions",
        header: "",
        enableSorting: false,
        meta: { align: "right", width: 80 },
        cell: ({ row }) =>
          !row.original.revokedAt && (
            <Group gap={4} justify="flex-end" wrap="nowrap">
              <RevokeApiKeyButton
                projectId={projectId}
                apiKeyId={row.original.id}
                name={row.original.name}
              />
            </Group>
          ),
      }),
    ],
    [projectId],
  );
}
