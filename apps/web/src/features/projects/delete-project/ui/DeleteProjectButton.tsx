import { Alert, Button, Group, Modal, Stack, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconAlertTriangle, IconTrash } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { getErrorMessage, trpc } from "@/shared/api";
import { notify } from "@/shared/lib";
import { invalidateProjectQueries } from "../../invalidate";

type Props = { id: string; name: string; onDeleted: () => void };

/** Permanent delete: the user has to type the exact project name (GitHub style). */
export function DeleteProjectButton({ id, name, onDeleted }: Props) {
  const [opened, { open, close }] = useDisclosure(false);
  const [typed, setTyped] = useState("");
  const mutation = useMutation({
    ...trpc.projects.delete.mutationOptions(),
    onSuccess: async () => {
      notify.success("Project o'chirildi");
      close();
      onDeleted();
      await invalidateProjectQueries();
    },
    onError: (error) => notify.error(getErrorMessage(error)),
  });

  const close_ = () => {
    setTyped("");
    close();
  };

  return (
    <>
      <Button color="red" leftSection={<IconTrash size={16} />} onClick={open}>
        O'chirish
      </Button>
      <Modal opened={opened} onClose={close_} title="Projectni o'chirish">
        <Stack gap="md">
          <Alert color="red" variant="light" icon={<IconAlertTriangle size={18} />}>
            Bu amalni qaytarib bo'lmaydi. Project bilan birga hamma shablonlar, versiyalar, API
            keylar, yaratilgan hujjatlar va yuklangan fayllar butunlay o'chadi.
          </Alert>
          <Text size="sm">
            Tasdiqlash uchun project nomini yozing: <b>{name}</b>
          </Text>
          <TextInput
            placeholder={name}
            value={typed}
            onChange={(e) => setTyped(e.currentTarget.value)}
            data-autofocus
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={close_} disabled={mutation.isPending}>
              Bekor qilish
            </Button>
            <Button
              color="red"
              disabled={typed.trim() !== name}
              loading={mutation.isPending}
              onClick={() => mutation.mutate({ projectId: id, confirmName: typed })}
            >
              Butunlay o'chirish
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
