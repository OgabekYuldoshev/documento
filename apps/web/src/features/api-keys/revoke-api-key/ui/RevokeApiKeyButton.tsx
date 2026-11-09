import { ActionIcon, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconBan } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { getErrorMessage, trpc } from "@/shared/api";
import { notify } from "@/shared/lib";
import { ConfirmModal } from "@/shared/ui";
import { invalidateApiKeyQueries } from "../../invalidate";

type Props = { projectId: string; apiKeyId: string; name: string };

export function RevokeApiKeyButton({ projectId, apiKeyId, name }: Props) {
  const [opened, { open, close }] = useDisclosure(false);
  const revoke = useMutation({
    ...trpc.apiKeys.revoke.mutationOptions(),
    onSuccess: async () => {
      await invalidateApiKeyQueries();
      notify.success("Key bekor qilindi");
      close();
    },
    onError: (error) => notify.error(getErrorMessage(error)),
  });

  return (
    <>
      <Tooltip label="Bekor qilish">
        <ActionIcon variant="subtle" color="red" onClick={open}>
          <IconBan size={18} />
        </ActionIcon>
      </Tooltip>
      <ConfirmModal
        opened={opened}
        onClose={close}
        title="Keyni bekor qilish"
        message={`"${name}" darhol ishlamay qoladi. Bu amalni qaytarib bo'lmaydi.`}
        confirmLabel="Bekor qilish"
        loading={revoke.isPending}
        onConfirm={() => revoke.mutate({ projectId, apiKeyId })}
      />
    </>
  );
}
