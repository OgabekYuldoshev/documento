import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/shared/api";
import { DataTable } from "@/shared/ui";
import { useUsersColumns } from "../model/use-users-columns";

export function UsersTable() {
  const columns = useUsersColumns();
  const { data, isPending, error } = useQuery(trpc.users.list.queryOptions());

  return (
    <DataTable
      columns={columns}
      data={data}
      getRowId={(user) => user.id}
      isLoading={isPending}
      error={error?.message}
      searchPlaceholder="Ism yoki email bo'yicha qidirish..."
      initialSorting={[{ id: "createdAt", desc: true }]}
      emptyTitle="Foydalanuvchilar topilmadi"
    />
  );
}
