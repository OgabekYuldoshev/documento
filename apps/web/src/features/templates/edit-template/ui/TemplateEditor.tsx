import { Button, Center, Divider, Loader, Stack, Text, Title } from "@mantine/core";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getErrorMessage, trpc } from "@/shared/api";
import { notify } from "@/shared/lib";
import { invalidateTemplateQueries } from "../../invalidate";
import { ApiSnippets } from "./ApiSnippets";
import { DraftForm } from "./DraftForm";
import { VersionHistory } from "./VersionHistory";

type Props = { projectId: string; templateId: string };

export function TemplateEditor({ projectId, templateId }: Props) {
  const ids = { projectId, templateId };
  const { data: draft, isPending } = useQuery(trpc.templates.draft.queryOptions(ids));
  // Bumped after a restore so the form remounts with the restored content.
  const [epoch, setEpoch] = useState(0);

  const start = useMutation({
    ...trpc.templates.getDraft.mutationOptions(),
    onSuccess: () => invalidateTemplateQueries(),
    onError: (error) => notify.error(getErrorMessage(error)),
  });

  if (isPending) {
    return (
      <Center mih="30dvh">
        <Loader />
      </Center>
    );
  }

  return (
    <Stack gap="xl">
      {draft ? (
        <DraftForm key={`${draft.id}:${epoch}`} {...ids} draft={draft} />
      ) : (
        <Stack align="flex-start" gap="xs">
          <Text c="dimmed" size="sm">
            Qoralama yo'q: joriy versiya o'zgarmas. Tahrirlash uchun undan yangi qoralama yarating.
          </Text>
          <Button loading={start.isPending} onClick={() => start.mutate(ids)}>
            Tahrirlashni boshlash
          </Button>
        </Stack>
      )}
      <Divider />
      <Stack gap="sm">
        <Title order={4}>API orqali ishlatish</Title>
        <ApiSnippets {...ids} />
      </Stack>
      <Divider />
      <Stack gap="sm">
        <Title order={4}>Versiyalar</Title>
        <VersionHistory {...ids} onRestored={() => setEpoch((n) => n + 1)} />
      </Stack>
    </Stack>
  );
}
