import { loginSchema } from "@documento/shared";
import { Alert, Button, PasswordInput, Stack, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconAlertCircle, IconAt, IconLock } from "@tabler/icons-react";
import { zod4Resolver } from "mantine-form-zod-resolver";
import { useLogin } from "../model/useLogin";

export function LoginForm() {
  const login = useLogin();
  const form = useForm({
    mode: "uncontrolled",
    initialValues: { email: "", password: "" },
    validate: zod4Resolver(loginSchema),
  });

  return (
    <form onSubmit={form.onSubmit((values) => login.mutate(values))} noValidate>
      <Stack gap="md">
        {login.error && (
          <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />}>
            {login.error.message}
          </Alert>
        )}
        <TextInput
          label="Email"
          placeholder="siz@kompaniya.uz"
          autoComplete="username"
          leftSection={<IconAt size={16} />}
          data-autofocus
          key={form.key("email")}
          {...form.getInputProps("email")}
        />
        <PasswordInput
          label="Parol"
          placeholder="Parolingiz"
          autoComplete="current-password"
          leftSection={<IconLock size={16} />}
          key={form.key("password")}
          {...form.getInputProps("password")}
        />
        <Button type="submit" size="md" fullWidth loading={login.isPending}>
          Kirish
        </Button>
      </Stack>
    </form>
  );
}
