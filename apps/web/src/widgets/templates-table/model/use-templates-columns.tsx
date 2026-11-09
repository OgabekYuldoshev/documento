import { Anchor, Badge, Group, Text } from "@mantine/core";
import { useMemo } from "react";
import { Link } from "react-router";
import type { TemplateListItem } from "@/entities/template";
import { ROUTES } from "@/shared/config";
import { formatDate } from "@/shared/lib";
import { createDataTableColumns } from "@/shared/ui";

const col = createDataTableColumns<TemplateListItem>();

export function useTemplatesColumns(projectId: string) {
  return useMemo(
    () => [
      col.accessor((row) => `${row.name} ${row.slug}`, {
        id: "template",
        header: "Shablon",
        cell: ({ row }) => (
          <div>
            <Anchor
              component={Link}
              to={ROUTES.template(projectId, row.original.id)}
              size="sm"
              fw={500}
              lh={1.3}
            >
              {row.original.name}
            </Anchor>
            <Text size="xs" c="dimmed">
              {row.original.slug}
            </Text>
          </div>
        ),
      }),
      col.display({
        id: "status",
        header: "Holati",
        enableSorting: false,
        cell: ({ row }) => (
          <Group gap={6}>
            {row.original.currentNumber ? (
              <Badge color="teal" variant="light">
                v{row.original.currentNumber}
              </Badge>
            ) : (
              <Badge color="gray" variant="light">
                Publish qilinmagan
              </Badge>
            )}
            {row.original.hasDraft && (
              <Badge color="yellow" variant="light">
                Qoralama
              </Badge>
            )}
          </Group>
        ),
      }),
      col.accessor("updatedAt", {
        header: "Yangilangan",
        sortFn: "datetime",
        enableGlobalFilter: false,
        cell: ({ getValue }) => (
          <Text size="sm" c="dimmed">
            {formatDate(getValue())}
          </Text>
        ),
      }),
    ],
    [projectId],
  );
}
