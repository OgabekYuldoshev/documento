import { Badge, Group, Text } from "@mantine/core";
import { useMemo } from "react";
import { RemoveMemberButton } from "@/features/projects/members";
import { formatDate } from "@/shared/lib";
import { createDataTableColumns } from "@/shared/ui";

export type PersonRow = {
  userId: string;
  name: string;
  email: string;
  kind: "owner" | "member";
  addedAt: Date | null;
};

const col = createDataTableColumns<PersonRow>();

type Options = { projectId: string; currentUserId?: string; canManage: boolean };

export function useMembersColumns({ projectId, currentUserId, canManage }: Options) {
  return useMemo(
    () => [
      col.accessor((row) => `${row.name} ${row.email}`, {
        id: "person",
        header: "Foydalanuvchi",
        cell: ({ row }) => (
          <div>
            <Text size="sm" fw={500} lh={1.3}>
              {row.original.name}
              {row.original.userId === currentUserId ? " (siz)" : ""}
            </Text>
            <Text size="xs" c="dimmed">
              {row.original.email}
            </Text>
          </div>
        ),
      }),
      col.accessor("kind", {
        header: "Roli",
        enableGlobalFilter: false,
        cell: ({ getValue }) =>
          getValue() === "owner" ? (
            <Badge variant="light">Ega</Badge>
          ) : (
            <Badge variant="light" color="gray">
              A'zo
            </Badge>
          ),
      }),
      col.accessor((row) => row.addedAt?.getTime() ?? 0, {
        id: "addedAt",
        header: "Qo'shilgan",
        sortFn: "basic",
        enableGlobalFilter: false,
        cell: ({ row }) => (
          <Text size="sm" c="dimmed">
            {row.original.addedAt ? formatDate(row.original.addedAt) : "—"}
          </Text>
        ),
      }),
      col.display({
        id: "actions",
        header: "",
        enableSorting: false,
        meta: { align: "right", width: 80 },
        cell: ({ row }) => {
          const person = row.original;
          if (person.kind === "owner") return null;
          const isSelf = person.userId === currentUserId;
          // Managers remove anyone; a member can only leave on their own.
          if (!canManage && !isSelf) return null;
          return (
            <Group gap={4} justify="flex-end" wrap="nowrap">
              <RemoveMemberButton
                projectId={projectId}
                userId={person.userId}
                name={person.name}
                isSelf={isSelf}
              />
            </Group>
          );
        },
      }),
    ],
    [projectId, currentUserId, canManage],
  );
}
