import { ActionIcon, Badge, Group, Paper, Stack, Text, Tooltip } from "@mantine/core";
import { IconRestore } from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getErrorMessage, trpc } from "@/shared/api";
import { formatDate, notify } from "@/shared/lib";
import { invalidateTemplateQueries } from "../../invalidate";

const STATUS: Record<string, { label: string; color: string }> = {
  draft: { label: "Qoralama", color: "yellow" },
  published: { label: "Joriy", color: "teal" },
  archived: { label: "Arxiv", color: "gray" },
};

type Props = { projectId: string; templateId: string; onRestored: () => void };

export function VersionHistory({ projectId, templateId, onRestored }: Props) {
  const { data } = useQuery(trpc.templates.versions.queryOptions({ projectId, templateId }));
  const restore = useMutation({
    ...trpc.templates.restoreVersion.mutationOptions(),
    onSuccess: async () => {
      await invalidateTemplateQueries();
      notify.success("Versiya qoralamaga tiklandi");
      onRestored();
    },
    onError: (error) => notify.error(getErrorMessage(error)),
  });

  return (
    <Stack gap="xs">
      {data?.map((v) => {
        const s = STATUS[v.status] ?? { label: v.status, color: "gray" };
        return (
          <Paper key={v.id} withBorder p="sm" radius="md">
            <Group justify="space-between" wrap="nowrap">
              <Group gap="sm">
                <Text fw={600}>v{v.number}</Text>
                <Badge color={s.color} variant="light">
                  {s.label}
                </Badge>
                <Text size="xs" c="dimmed">
                  {formatDate(v.publishedAt ?? v.createdAt)}
                </Text>
              </Group>
              {v.status !== "draft" && (
                <Tooltip label="Qoralamaga tiklash">
                  <ActionIcon
                    variant="subtle"
                    loading={restore.isPending}
                    onClick={() => restore.mutate({ projectId, templateId, versionId: v.id })}
                  >
                    <IconRestore size={18} />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
          </Paper>
        );
      })}
    </Stack>
  );
}
