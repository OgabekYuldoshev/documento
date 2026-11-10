import { ActionIcon, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconLogout, IconUserMinus } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { getErrorMessage, trpc } from "@/shared/api";
import { notify } from "@/shared/lib";
import { ConfirmModal } from "@/shared/ui";
import { invalidateMemberQueries } from "../model/invalidate";

type Props = {
  projectId: string;
  userId: string;
  name: string;
  /** The signed-in user removes themselves ("leave"). */
  isSelf: boolean;
  onRemoved?: () => void;
};

export function RemoveMemberButton({ projectId, userId, name, isSelf, onRemoved }: Props) {
  const [opened, { open, close }] = useDisclosure(false);
  const remove = useMutation({
    ...trpc.projectMembers.remove.mutationOptions(),
    onSuccess: async () => {
      notify.success(isSelf ? "Project'dan chiqdingiz" : "A'zo olib tashlandi");
      close();
      onRemoved?.();
      await invalidateMemberQueries();
    },
    onError: (error) => notify.error(getErrorMessage(error)),
  });

  return (
    <>
      <Tooltip label={isSelf ? "Project'dan chiqish" : "Olib tashlash"}>
        <ActionIcon variant="subtle" color="red" onClick={open}>
          {isSelf ? <IconLogout size={18} /> : <IconUserMinus size={18} />}
        </ActionIcon>
      </Tooltip>
      <ConfirmModal
        opened={opened}
        onClose={close}
        title={isSelf ? "Project'dan chiqish" : "A'zoni olib tashlash"}
        message={
          isSelf
            ? "Project sizga ko'rinmay qoladi. Qaytish uchun egasi sizni qayta qo'shishi kerak."
            : `${name} project'ni ko'rmay qoladi.`
        }
        confirmLabel={isSelf ? "Chiqish" : "Olib tashlash"}
        loading={remove.isPending}
        onConfirm={() => remove.mutate({ projectId, userId })}
      />
    </>
  );
}
