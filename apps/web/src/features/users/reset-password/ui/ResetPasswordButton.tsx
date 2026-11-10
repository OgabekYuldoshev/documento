import { resetPasswordSchema } from "@documento/shared";
import {
  ActionIcon,
  Button,
  CopyButton,
  Group,
  Modal,
  PasswordInput,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useDisclosure } from "@mantine/hooks";
import { IconCheck, IconCopy, IconDice5, IconKey } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { zod4Resolver } from "mantine-form-zod-resolver";
import { useState } from "react";
import { getErrorMessage, trpc } from "@/shared/api";
import { notify } from "@/shared/lib";
import { generatePassword } from "../model/generate-password";

type Props = { id: string; name: string };

const formSchema = resetPasswordSchema.pick({ newPassword: true });

/** Admin sets a new password for a user below them; the user is signed out everywhere. */
export function ResetPasswordButton({ id, name }: Props) {
  const [opened, { open, close }] = useDisclosure(false);
  const [visible, setVisible] = useState(false);
  const form = useForm({
    initialValues: { newPassword: "" },
    validate: zod4Resolver(formSchema),
  });

  const closeAndReset = () => {
    form.reset();
    setVisible(false);
    close();
  };

  const mutation = useMutation({
    ...trpc.users.resetPassword.mutationOptions(),
    onSuccess: () => {
      notify.success("Parol yangilandi. Foydalanuvchi qayta kirishi kerak");
      closeAndReset();
    },
    onError: (error) => notify.error(getErrorMessage(error)),
  });

  return (
    <>
      <Tooltip label="Parolni tiklash">
        <ActionIcon variant="subtle" color="gray" onClick={open} aria-label="Parolni tiklash">
          <IconKey size={18} />
        </ActionIcon>
      </Tooltip>
      <Modal opened={opened} onClose={closeAndReset} title="Parolni tiklash" centered>
        <form
          noValidate
          onSubmit={form.onSubmit((values) =>
            mutation.mutate({ id, newPassword: values.newPassword }),
          )}
        >
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              <b>{name}</b> uchun yangi parol belgilanadi va u barcha qurilmalardan chiqariladi.
              Parolni foydalanuvchiga xavfsiz yo'l bilan yetkazing.
            </Text>
            <PasswordInput
              label="Yangi parol"
              placeholder="Kamida 8 ta belgi"
              autoComplete="new-password"
              visible={visible}
              onVisibilityChange={setVisible}
              data-autofocus
              {...form.getInputProps("newPassword")}
            />
            <Group gap="xs">
              <Button
                variant="default"
                size="xs"
                leftSection={<IconDice5 size={14} />}
                onClick={() => {
                  form.setFieldValue("newPassword", generatePassword());
                  setVisible(true);
                }}
              >
                Tasodifiy yaratish
              </Button>
              <CopyButton value={form.values.newPassword}>
                {({ copied, copy }) => (
                  <Button
                    variant="default"
                    size="xs"
                    disabled={!form.values.newPassword}
                    leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                    onClick={copy}
                  >
                    {copied ? "Nusxalandi" : "Nusxalash"}
                  </Button>
                )}
              </CopyButton>
            </Group>
            <Group justify="flex-end">
              <Button variant="default" onClick={closeAndReset} disabled={mutation.isPending}>
                Bekor qilish
              </Button>
              <Button type="submit" loading={mutation.isPending}>
                Parolni o'zgartirish
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
