import { CreateUserButton } from "@/features/users/create-user";
import { PageHeader } from "@/shared/ui";
import { UsersTable } from "@/widgets/users-table";

export function UsersPage() {
  return (
    <>
      <PageHeader
        title="Users"
        description="Create and manage accounts. Sign-up is disabled; only admins add users."
        actions={<CreateUserButton />}
      />
      <UsersTable />
    </>
  );
}
