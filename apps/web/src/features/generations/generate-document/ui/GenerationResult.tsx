import { Alert, Badge, Button, Group, List, Loader, Stack, Text } from "@mantine/core";
import { IconArrowLeft, IconDownload, IconRefresh } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { GENERATION_STATUS_META } from "@/entities/generation";
import { trpc } from "@/shared/api";

type Failure = {
  errors?: { path: string; message: string }[];
  diagnostics?: { message: string; line?: number }[];
};

type Props = {
  projectId: string;
  generationId: string;
  onEdit: () => void;
  onRestart: () => void;
};

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** Follows one generation until it settles, then shows the PDF or why it failed. */
export function GenerationResult({ projectId, generationId, onEdit, onRestart }: Props) {
  const { data } = useQuery({
    ...trpc.generations.get.queryOptions({ projectId, generationId }),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return !status || status === "queued" || status === "processing" ? 1_500 : false;
    },
  });

  if (!data || data.status === "queued" || data.status === "processing") {
    return (
      <Stack align="center" gap="xs" py="xl">
        <Loader />
        <Text size="sm" c="dimmed">
          Hujjat yaratilmoqda…
        </Text>
      </Stack>
    );
  }

  const meta = GENERATION_STATUS_META[data.status];
  const failure = data.errorJson as Failure | null;
  const lines = [
    ...(failure?.errors ?? []).map((e) => `${e.path || "/"}: ${e.message}`),
    ...(failure?.diagnostics ?? []).map((d) => (d.line ? `${d.line}-qator: ` : "") + d.message),
  ];

  return (
    <Stack gap="md" h="100%">
      <Group justify="space-between" wrap="nowrap">
        <Group gap="xs">
          <Badge color={meta.color} variant="light">
            {meta.label}
          </Badge>
          {data.status === "ok" && (
            <Text size="xs" c="dimmed">
              {data.pages} sahifa · {formatSize(data.bytes ?? 0)} · {data.durationMs} ms
            </Text>
          )}
        </Group>
        <Group gap="xs" wrap="nowrap">
          <Button
            size="xs"
            variant="default"
            leftSection={<IconArrowLeft size={14} />}
            onClick={onEdit}
          >
            Ma'lumotni tahrirlash
          </Button>
          <Button
            size="xs"
            variant="default"
            leftSection={<IconRefresh size={14} />}
            onClick={onRestart}
          >
            Qayta yaratish
          </Button>
          {data.status === "ok" && (
            <Button
              size="xs"
              component="a"
              href={`/api/generations/${data.id}/file`}
              download
              leftSection={<IconDownload size={14} />}
            >
              Yuklab olish
            </Button>
          )}
        </Group>
      </Group>

      {data.status === "ok" ? (
        <iframe
          title="Hujjat"
          src={`/api/generations/${data.id}/file?inline=1`}
          style={{
            flex: 1,
            minHeight: 480,
            width: "100%",
            border: "1px solid var(--app-border)",
            borderRadius: 8,
            background: "#fff",
          }}
        />
      ) : (
        <Alert color={meta.color} variant="light" title={meta.label}>
          {lines.length > 0 ? (
            <List size="sm" spacing={4}>
              {lines.slice(0, 12).map((line) => (
                <List.Item key={line}>{line}</List.Item>
              ))}
            </List>
          ) : (
            <Text size="sm">Hujjat yaratilmadi.</Text>
          )}
        </Alert>
      )}
    </Stack>
  );
}
