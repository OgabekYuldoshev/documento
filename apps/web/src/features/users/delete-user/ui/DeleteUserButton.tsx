import { ActionIcon, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconTrash } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { getErrorMessage, trpc } from "@/shared/api";
import { notify } from "@/shared/lib";
import { ConfirmModal } from "@/shared/ui";
import { invalidateUserQueries } from "../../invalidate";

export function DeleteUserButton({ id, name }: { id: string; name: string }) {
  const [opened, { open, close }] = useDisclosure(false);
  const mutation = useMutation({
    ...trpc.users.remove.mutationOptions(),
    onSuccess: async () => {
      await invalidateUserQueries();
      notify.success("Foydalanuvchi o'chirildi");
      close();
    },
    onError: (error) => notify.error(getErrorMessage(error)),
  });

  return (
    <>
      <Tooltip label="O'chirish">
        <ActionIcon variant="subtle" color="red" onClick={open}>
          <IconTrash size={18} />
        </ActionIcon>
      </Tooltip>
      <ConfirmModal
        opened={opened}
        onClose={close}
        title="Foydalanuvchini o'chirish"
        message={`${name} butunlay o'chirilsinmi? Bu amalni qaytarib bo'lmaydi.`}
        confirmLabel="O'chirish"
        loading={mutation.isPending}
        onConfirm={() => mutation.mutate({ id })}
      />
    </>
  );
}
