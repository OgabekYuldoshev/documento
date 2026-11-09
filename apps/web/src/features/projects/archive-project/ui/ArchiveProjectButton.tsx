import { ActionIcon, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconArchive } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { getErrorMessage, trpc } from "@/shared/api";
import { notify } from "@/shared/lib";
import { ConfirmModal } from "@/shared/ui";
import { invalidateProjectQueries } from "../../invalidate";

export function ArchiveProjectButton({ id, name }: { id: string; name: string }) {
  const [opened, { open, close }] = useDisclosure(false);
  const mutation = useMutation({
    ...trpc.projects.archive.mutationOptions(),
    onSuccess: async () => {
      await invalidateProjectQueries();
      notify.success("Project arxivlandi");
      close();
    },
    onError: (error) => notify.error(getErrorMessage(error)),
  });

  return (
    <>
      <Tooltip label="Arxivlash">
        <ActionIcon variant="subtle" color="red" onClick={open}>
          <IconArchive size={18} />
        </ActionIcon>
      </Tooltip>
      <ConfirmModal
        opened={opened}
        onClose={close}
        title="Projectni arxivlash"
        message={`"${name}" arxivlansinmi? U ro'yxatdan yo'qoladi`}
        confirmLabel="Arxivlash"
        loading={mutation.isPending}
        onConfirm={() => mutation.mutate({ projectId: id })}
      />
    </>
  );
}
