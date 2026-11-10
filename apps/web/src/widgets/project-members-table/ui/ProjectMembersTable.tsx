import { Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { canManageProject } from "@/entities/project";
import { useSession } from "@/entities/session";
import { AddMemberForm } from "@/features/projects/members";
import { trpc } from "@/shared/api";
import { DataTable } from "@/shared/ui";
import { useMembersColumns } from "../model/use-members-columns";

type Props = { projectId: string; ownerId: string };

/** Everyone who can open the project; owner and superadmin can add and remove members. */
export function ProjectMembersTable({ projectId, ownerId }: Props) {
  const { user } = useSession();
  const canManage = canManageProject({ ownerId }, user);
  const columns = useMembersColumns({ projectId, currentUserId: user?.id, canManage });
  const { data, isPending, error } = useQuery(trpc.projectMembers.list.queryOptions({ projectId }));

  return (
    <Stack gap="md">
      {canManage ? (
        <AddMemberForm projectId={projectId} />
      ) : (
        <Text size="sm" c="dimmed">
          A'zolarni faqat project egasi yoki superadmin boshqaradi.
        </Text>
      )}
      <DataTable
        columns={columns}
        data={data}
        getRowId={(p) => p.userId}
        isLoading={isPending}
        error={error?.message}
        searchable={(data?.length ?? 0) > 8}
        searchPlaceholder="Ism yoki email bo'yicha..."
        emptyTitle="A'zolar yo'q"
      />
    </Stack>
  );
}
