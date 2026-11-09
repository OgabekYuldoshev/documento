import { ActionIcon, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconArchive } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { getErrorMessage, trpc } from "@/shared/api";
import { notify } from "@/shared/lib";
import { ConfirmModal } from "@/shared/ui";
import { invalidateProjectQueries } from "../../invalidate";

type ArchiveProjectButtonProps = {
  id: string;
  name: string;
  /** Custom trigger (e.g. a danger-zone button). Defaults to a small icon button. */
  renderTrigger?: (open: () => void) => ReactNode;
  onArchived?: () => void;
};

export function ArchiveProjectButton({
  id,
  name,
  renderTrigger,
  onArchived,
}: ArchiveProjectButtonProps) {
  const [opened, { open, close }] = useDisclosure(false);
  const mutation = useMutation({
    ...trpc.projects.archive.mutationOptions(),
    onSuccess: async () => {
      await invalidateProjectQueries();
      notify.success("Project arxivlandi");
      close();
      onArchived?.();
    },
    onError: (error) => notify.error(getErrorMessage(error)),
  });

  return (
    <>
      {renderTrigger ? (
        renderTrigger(open)
      ) : (
        <Tooltip label="Arxivlash">
          <ActionIcon variant="subtle" color="red" onClick={open}>
            <IconArchive size={18} />
          </ActionIcon>
        </Tooltip>
      )}
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
