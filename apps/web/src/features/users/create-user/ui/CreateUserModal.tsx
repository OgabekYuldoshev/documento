import { ASSIGNABLE_ROLES, createUserSchema, getRoleLabel, type Role } from "@documento/shared";
import { Button, Modal, PasswordInput, Select, Stack, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useDisclosure } from "@mantine/hooks";
import { IconUserPlus } from "@tabler/icons-react";
import { zod4Resolver } from "mantine-form-zod-resolver";
import { useSession } from "@/entities/session";
import { useCreateUser } from "../model/useCreateUser";

export function CreateUserButton() {
  const [opened, { open, close }] = useDisclosure(false);
  const { user } = useSession();
  const roles = ASSIGNABLE_ROLES[(user?.role ?? "user") as Role];

  const form = useForm<{ name: string; email: string; password: string; role: string }>({
    initialValues: { name: "", email: "", password: "", role: "user" },
    validate: zod4Resolver(createUserSchema),
  });

  const create = useCreateUser(() => {
    form.reset();
    close();
  });

  return (
    <>
      <Button leftSection={<IconUserPlus size={18} />} onClick={open}>
        Yangi foydalanuvchi
      </Button>
      <Modal opened={opened} onClose={close} title="Foydalanuvchi qo'shish" centered>
        <form
          onSubmit={form.onSubmit((values) =>
            create.mutate({ ...values, role: values.role as "admin" | "user" }),
          )}
          noValidate
        >
          <Stack>
            <TextInput label="Ism familiya" data-autofocus {...form.getInputProps("name")} />
            <TextInput label="Email" autoComplete="off" {...form.getInputProps("email")} />
            <PasswordInput
              label="Vaqtinchalik parol"
              description="Kamida 8 ta belgi. Foydalanuvchiga xavfsiz yo'l bilan yetkazing."
              autoComplete="new-password"
              {...form.getInputProps("password")}
            />
            <Select
              label="Rol"
              allowDeselect={false}
              data={roles.map((r) => ({ value: r, label: getRoleLabel(r) }))}
              {...form.getInputProps("role")}
            />
            <Button type="submit" loading={create.isPending}>
              Qo'shish
            </Button>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
