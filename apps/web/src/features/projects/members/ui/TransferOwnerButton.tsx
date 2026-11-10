import { Alert, Button, Group, Modal, Select, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconInfoCircle, IconUserShare } from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getErrorMessage, trpc } from "@/shared/api";
import { notify } from "@/shared/lib";
import { invalidateMemberQueries } from "../model/invalidate";

type Props = { projectId: string; projectName: string };

/** Hands the project to one of its members; the previous owner stays on as a member. */
export function TransferOwnerButton({ projectId, projectName }: Props) {
  const [opened, { open, close }] = useDisclosure(false);
  const [target, setTarget] = useState<string | null>(null);
  const people = useQuery({
    ...trpc.projectMembers.list.queryOptions({ projectId }),
    enabled: opened,
  });
  const candidates = (people.data ?? []).filter((p) => p.kind === "member");

  const transfer = useMutation({
    ...trpc.projects.transferOwner.mutationOptions(),
    onSuccess: async () => {
      notify.success("Project egasi almashtirildi");
      close();
      setTarget(null);
      await invalidateMemberQueries();
    },
    onError: (error) => notify.error(getErrorMessage(error)),
  });

  return (
    <>
      <Button variant="light" leftSection={<IconUserShare size={16} />} onClick={open}>
        Egasini almashtirish
      </Button>
      <Modal opened={opened} onClose={close} title="Project egasini almashtirish" centered>
        <Stack gap="md">
          <Text size="sm">
            <b>{projectName}</b> yangi egasiga o'tadi. Siz a'zo bo'lib qolasiz, lekin a'zolarni
            boshqarish, arxivlash va o'chirish huquqini yo'qotasiz.
          </Text>
          {people.isPending ? null : candidates.length === 0 ? (
            <Alert variant="light" icon={<IconInfoCircle size={18} />}>
              Avval "A'zolar" bo'limida kimnidir qo'shing, keyin egalikni unga o'tkazing.
            </Alert>
          ) : (
            <Select
              label="Yangi ega"
              placeholder="A'zoni tanlang"
              data={candidates.map((p) => ({ value: p.userId, label: `${p.name} (${p.email})` }))}
              value={target}
              onChange={setTarget}
              searchable
            />
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={close} disabled={transfer.isPending}>
              Bekor qilish
            </Button>
            <Button
              disabled={!target}
              loading={transfer.isPending}
              onClick={() => target && transfer.mutate({ projectId, newOwnerId: target })}
            >
              Almashtirish
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
