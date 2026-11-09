import { Anchor, Group, Text } from "@mantine/core";
import { useMemo } from "react";
import { Link } from "react-router";
import type { Project } from "@/entities/project";
import { ArchiveProjectButton } from "@/features/projects/archive-project";
import { ROUTES } from "@/shared/config";
import { formatDate } from "@/shared/lib";
import { createDataTableColumns } from "@/shared/ui";

const col = createDataTableColumns<Project>();

export function useProjectsColumns() {
  return useMemo(
    () => [
      col.accessor((row) => `${row.name} ${row.slug}`, {
        id: "project",
        header: "Project",
        cell: ({ row }) => (
          <div>
            <Anchor
              component={Link}
              to={ROUTES.project(row.original.id)}
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
      col.accessor((row) => row.description ?? "", {
        id: "description",
        header: "Tavsif",
        cell: ({ getValue }) => (
          <Text size="sm" c="dimmed" lineClamp={1}>
            {getValue() || "—"}
          </Text>
        ),
      }),
      col.accessor("createdAt", {
        header: "Yaratilgan",
        sortFn: "datetime",
        enableGlobalFilter: false,
        cell: ({ getValue }) => (
          <Text size="sm" c="dimmed">
            {formatDate(getValue())}
          </Text>
        ),
      }),
      col.display({
        id: "actions",
        header: "",
        enableSorting: false,
        meta: { align: "right", width: 80 },
        cell: ({ row }) => (
          <Group gap={4} justify="flex-end" wrap="nowrap">
            <ArchiveProjectButton id={row.original.id} name={row.original.name} />
          </Group>
        ),
      }),
    ],
    [],
  );
}
