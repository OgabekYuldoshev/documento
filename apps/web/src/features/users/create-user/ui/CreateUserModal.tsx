import { ASSIGNABLE_ROLES, createUserSchema, type Role } from "@documento/shared";
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
        New user
      </Button>
      <Modal opened={opened} onClose={close} title="Create user" centered>
        <form
          onSubmit={form.onSubmit((values) =>
            create.mutate({ ...values, role: values.role as "admin" | "user" }),
          )}
          noValidate
        >
          <Stack>
            <TextInput label="Full name" data-autofocus {...form.getInputProps("name")} />
            <TextInput label="Email" autoComplete="off" {...form.getInputProps("email")} />
            <PasswordInput
              label="Temporary password"
              description="Min. 8 characters. Share it securely with the user."
              autoComplete="new-password"
              {...form.getInputProps("password")}
            />
            <Select
              label="Role"
              allowDeselect={false}
              data={roles.map((r) => ({ value: r, label: r[0]?.toUpperCase() + r.slice(1) }))}
              {...form.getInputProps("role")}
            />
            <Button type="submit" loading={create.isPending}>
              Create user
            </Button>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
