import { ActionIcon, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconLock, IconLockOpen } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { getErrorMessage, trpc } from "@/shared/api";
import { notify } from "@/shared/lib";
import { ConfirmModal } from "@/shared/ui";
import { invalidateUserQueries } from "../../invalidate";

type Props = { id: string; name: string; banned: boolean };

export function ToggleBanButton({ id, name, banned }: Props) {
  const [opened, { open, close }] = useDisclosure(false);
  const mutation = useMutation({
    ...trpc.users.setBanned.mutationOptions(),
    onSuccess: async () => {
      await invalidateUserQueries();
      notify.success(banned ? "User unblocked" : "User blocked");
      close();
    },
    onError: (error) => notify.error(getErrorMessage(error)),
  });

  return (
    <>
      <Tooltip label={banned ? "Unblock" : "Block"}>
        <ActionIcon variant="subtle" color={banned ? "teal" : "orange"} onClick={open}>
          {banned ? <IconLockOpen size={18} /> : <IconLock size={18} />}
        </ActionIcon>
      </Tooltip>
      <ConfirmModal
        opened={opened}
        onClose={close}
        title={banned ? "Unblock user" : "Block user"}
        message={
          banned
            ? `Allow ${name} to sign in again?`
            : `${name} will be signed out and unable to sign in.`
        }
        confirmLabel={banned ? "Unblock" : "Block"}
        color={banned ? "teal" : "orange"}
        loading={mutation.isPending}
        onConfirm={() => mutation.mutate({ id, banned: !banned })}
      />
    </>
  );
}
