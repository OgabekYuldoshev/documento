import { Anchor, Group, Text } from "@mantine/core";
import { useMemo } from "react";
import { Link } from "react-router";
import { canManageProject, type Project } from "@/entities/project";
import { useSession } from "@/entities/session";
import { ArchiveProjectButton } from "@/features/projects/archive-project";
import { ROUTES } from "@/shared/config";
import { formatDate } from "@/shared/lib";
import { createDataTableColumns } from "@/shared/ui";

const col = createDataTableColumns<Project>();

export function useProjectsColumns() {
  const { user } = useSession();
  const userId = user?.id;
  const role = user?.role;
  return useMemo(
    () => [
      // Name + description in one cell: one scan target per row instead of three columns.
      col.accessor((row) => `${row.name} ${row.slug} ${row.description ?? ""}`, {
        id: "project",
        header: "Project",
        cell: ({ row }) => (
          <div>
            <Anchor
              component={Link}
              to={ROUTES.project(row.original.id)}
              size="sm"
              fw={600}
              lh={1.3}
              c="inherit"
            >
              {row.original.name}
            </Anchor>
            <Text size="xs" c="dimmed" lineClamp={1} maw={520}>
              {row.original.description || "Tavsif yo'q"}
            </Text>
          </div>
        ),
      }),
      col.accessor("createdAt", {
        header: "Yaratilgan",
        sortFn: "datetime",
        enableGlobalFilter: false,
        meta: { width: 200 },
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
        cell: ({ row }) =>
          // Members cannot archive: only the owner and the superadmin can.
          canManageProject(row.original, { id: userId ?? "", role }) && (
            // The row is clickable; keep the archive action from also opening the project.
            <Group gap={4} justify="flex-end" wrap="nowrap" onClick={(e) => e.stopPropagation()}>
              <ArchiveProjectButton id={row.original.id} name={row.original.name} />
            </Group>
          ),
      }),
    ],
    [userId, role],
  );
}
