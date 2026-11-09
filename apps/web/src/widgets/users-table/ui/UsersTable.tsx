import { Badge, Group, Paper, Skeleton, Stack, Table, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/entities/session";
import { UserCell, UserRoleBadge } from "@/entities/user";
import { DeleteUserButton } from "@/features/users/delete-user";
import { ToggleBanButton } from "@/features/users/toggle-ban";
import { trpc } from "@/shared/api";
import { formatDate } from "@/shared/lib";

export function UsersTable() {
  const { user: me } = useSession();
  const { data, isPending, error } = useQuery(trpc.users.list.queryOptions());

  if (isPending) {
    return (
      <Stack>
        {Array.from({ length: 5 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton rows
          <Skeleton key={i} h={48} />
        ))}
      </Stack>
    );
  }
  if (error) return <Text c="red">{error.message}</Text>;

  // Rank-based: you may manage roles strictly below yours (mirrors the API rules).
  const canManage = (role: string, id: string) =>
    id !== me?.id && (me?.role === "superadmin" ? role !== "superadmin" : role === "user");

  return (
    <Paper withBorder radius="md">
      <Table.ScrollContainer minWidth={720}>
        <Table verticalSpacing="sm" highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>User</Table.Th>
              <Table.Th>Role</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Created</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.map((u) => (
              <Table.Tr key={u.id}>
                <Table.Td>
                  <UserCell name={u.name} email={u.email} />
                </Table.Td>
                <Table.Td>
                  <UserRoleBadge role={u.role} />
                </Table.Td>
                <Table.Td>
                  <Badge variant="dot" color={u.banned ? "orange" : "teal"}>
                    {u.banned ? "Blocked" : "Active"}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {formatDate(u.createdAt)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  {canManage(u.role, u.id) && (
                    <Group gap={4} justify="flex-end" wrap="nowrap">
                      <ToggleBanButton id={u.id} name={u.name} banned={u.banned} />
                      <DeleteUserButton id={u.id} name={u.name} />
                    </Group>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Paper>
  );
}
