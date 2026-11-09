import { CreateUserButton } from "@/features/users/create-user";
import { PageHeader } from "@/shared/ui";
import { UsersTable } from "@/widgets/users-table";

export function UsersPage() {
  return (
    <>
      <PageHeader
        title="Foydalanuvchilar"
        description="Hisoblarni yaratish va boshqarish. Ro'yxatdan o'tish yopiq, foydalanuvchilarni faqat adminlar qo'shadi."
        actions={<CreateUserButton />}
      />
      <UsersTable />
    </>
  );
}
