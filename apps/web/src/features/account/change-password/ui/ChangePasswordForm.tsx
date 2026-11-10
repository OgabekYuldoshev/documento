import { changePasswordSchema } from "@documento/shared";
import { Button, Checkbox, Group, PasswordInput, Stack } from "@mantine/core";
import { useForm } from "@mantine/form";
import { zod4Resolver } from "mantine-form-zod-resolver";
import { SettingsSection } from "@/shared/ui";
import { useChangePassword } from "../model/useChangePassword";

export function ChangePasswordForm() {
  const form = useForm({
    initialValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
      revokeOtherSessions: true,
    },
    validate: zod4Resolver(changePasswordSchema),
  });
  const change = useChangePassword(() => form.reset());

  return (
    <form noValidate onSubmit={form.onSubmit((values) => change.mutate(values))}>
      <Stack gap="md">
        <SettingsSection
          title="Parolni o'zgartirish"
          description="Kamida 8 ta belgi. Xavfsizlik uchun joriy parolni kiriting."
        >
          <PasswordInput
            label="Joriy parol"
            placeholder="Joriy parolingiz"
            autoComplete="current-password"
            required
            {...form.getInputProps("currentPassword")}
          />
          <PasswordInput
            label="Yangi parol"
            placeholder="Kamida 8 ta belgi"
            autoComplete="new-password"
            required
            {...form.getInputProps("newPassword")}
          />
          <PasswordInput
            label="Yangi parolni takrorlang"
            placeholder="Yangi parolni qayta kiriting"
            autoComplete="new-password"
            required
            {...form.getInputProps("confirmPassword")}
          />
          <Checkbox
            label="Boshqa qurilmalardagi sessiyalardan chiqish"
            description="Parol o'zgargach, boshqa brauzer va qurilmalarda qayta kirish talab qilinadi."
            {...form.getInputProps("revokeOtherSessions", { type: "checkbox" })}
          />
        </SettingsSection>
        <Group justify="flex-end">
          <Button type="submit" loading={change.isPending}>
            Parolni o'zgartirish
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
