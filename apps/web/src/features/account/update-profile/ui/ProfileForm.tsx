import { getRoleLabel, updateProfileSchema } from "@documento/shared";
import { Button, Collapse, Group, Stack, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { zod4Resolver } from "mantine-form-zod-resolver";
import { SettingsSection } from "@/shared/ui";
import { useUpdateProfile } from "../model/useUpdateProfile";

type Props = { user: { name: string; email: string; role: string } };

/** Own name (editable). Email and role are admin-managed, shown read-only. */
export function ProfileForm({ user }: Props) {
  const form = useForm({
    initialValues: { name: user.name },
    validate: zod4Resolver(updateProfileSchema),
  });
  const update = useUpdateProfile();
  const dirty = form.isDirty();

  return (
    <form
      noValidate
      onSubmit={form.onSubmit((values) =>
        update.mutate(values, { onSuccess: () => form.resetDirty(values) }),
      )}
    >
      <Stack gap="md">
        <SettingsSection
          title="Shaxsiy ma'lumot"
          description="Ismingiz sidebar va xush kelibsiz sahifasida ko'rinadi."
        >
          <TextInput
            label="Ism"
            placeholder="Ism va familiya"
            required
            {...form.getInputProps("name")}
          />
          <TextInput
            label="Email"
            value={user.email}
            readOnly
            description="Emailni administrator o'zgartiradi"
          />
          <TextInput label="Rol" value={getRoleLabel(user.role as never)} readOnly />
        </SettingsSection>

        <Collapse expanded={dirty}>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => form.reset()} disabled={update.isPending}>
              Bekor qilish
            </Button>
            <Button type="submit" loading={update.isPending}>
              Saqlash
            </Button>
          </Group>
        </Collapse>
      </Stack>
    </form>
  );
}
