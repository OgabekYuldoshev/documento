import { Badge, Group, Text } from "@mantine/core";
import { useMemo } from "react";
import { useSession } from "@/entities/session";
import { type User, UserCell, UserRoleBadge } from "@/entities/user";
import { DeleteUserButton } from "@/features/users/delete-user";
import { ToggleBanButton } from "@/features/users/toggle-ban";
import { formatDate } from "@/shared/lib";
import { createDataTableColumns } from "@/shared/ui";

const col = createDataTableColumns<User>();

/** Rank-based: you may manage roles strictly below yours (mirrors the API rules). */
const canManage = (meId: string | undefined, meRole: string | undefined, target: User) =>
  target.id !== meId &&
  (meRole === "superadmin" ? target.role !== "superadmin" : target.role === "user");

export function useUsersColumns() {
  const { user: me } = useSession();
  const meId = me?.id;
  const meRole = me?.role;

  return useMemo(
    () => [
      // Combined accessor: search & sort work on name + email together.
      col.accessor((row) => `${row.name} ${row.email}`, {
        id: "user",
        header: "Foydalanuvchi",
        cell: ({ row }) => <UserCell name={row.original.name} email={row.original.email} />,
      }),
      col.accessor("role", {
        header: "Rol",
        cell: ({ getValue }) => <UserRoleBadge role={getValue()} />,
      }),
      col.accessor("banned", {
        header: "Holati",
        sortFn: "basic",
        enableGlobalFilter: false,
        cell: ({ getValue }) => (
          <Badge variant="dot" color={getValue() ? "orange" : "teal"}>
            {getValue() ? "Bloklangan" : "Faol"}
          </Badge>
        ),
      }),
      col.accessor("createdAt", {
        header: "Qo'shilgan",
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
        meta: { align: "right", width: 100 },
        cell: ({ row }) =>
          canManage(meId, meRole, row.original) && (
            <Group gap={4} justify="flex-end" wrap="nowrap">
              <ToggleBanButton
                id={row.original.id}
                name={row.original.name}
                banned={row.original.banned}
              />
              <DeleteUserButton id={row.original.id} name={row.original.name} />
            </Group>
          ),
      }),
    ],
    [meId, meRole],
  );
}
