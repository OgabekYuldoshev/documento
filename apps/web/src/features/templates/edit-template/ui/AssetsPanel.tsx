import {
  ActionIcon,
  Badge,
  Button,
  CopyButton,
  FileButton,
  Group,
  Paper,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { IconCheck, IconCopy, IconTrash, IconUpload } from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getErrorMessage, queryClient, trpc } from "@/shared/api";
import { notify } from "@/shared/lib";

type Props = { projectId: string; templateId: string };

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

async function uploadAsset(templateId: string, file: File) {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(`/api/templates/${templateId}/assets`, { method: "POST", body });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(data?.message ?? "Yuklab bo'lmadi");
  }
}

/** Template files (images, fonts). In Typst: `#image("assets/logo.png")`; fonts are picked up by name. */
export function AssetsPanel({ projectId, templateId }: Props) {
  const ids = { projectId, templateId };
  const { data } = useQuery(trpc.templateAssets.list.queryOptions(ids));
  const refresh = () => queryClient.invalidateQueries(trpc.templateAssets.pathFilter());

  const upload = useMutation({
    mutationFn: (file: File) => uploadAsset(templateId, file),
    onSuccess: async () => {
      await refresh();
      notify.success("Fayl yuklandi");
    },
    onError: (error) => notify.error(getErrorMessage(error)),
  });
  const remove = useMutation({
    ...trpc.templateAssets.delete.mutationOptions(),
    onSuccess: refresh,
    onError: (error) => notify.error(getErrorMessage(error)),
  });

  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Rasm (png, jpg, svg) va shrift (ttf, otf). Kodda: <code>#image("assets/nom.png")</code>
        </Text>
        <FileButton onChange={(f) => f && upload.mutate(f)} accept=".png,.jpg,.jpeg,.svg,.ttf,.otf">
          {(props) => (
            <Button
              {...props}
              size="xs"
              leftSection={<IconUpload size={14} />}
              loading={upload.isPending}
            >
              Fayl yuklash
            </Button>
          )}
        </FileButton>
      </Group>

      {data?.length === 0 && (
        <Text size="sm" c="dimmed">
          Hozircha fayl yo'q.
        </Text>
      )}
      {data?.map((asset) => {
        const snippet = asset.kind === "image" ? `#image("assets/${asset.name}")` : asset.name;
        return (
          <Paper key={asset.id} withBorder p="sm" radius="md">
            <Group justify="space-between" wrap="nowrap">
              <Group gap="sm">
                <Text fw={500} size="sm">
                  {asset.name}
                </Text>
                <Badge variant="light" color={asset.kind === "image" ? "indigo" : "grape"}>
                  {asset.kind === "image" ? "Rasm" : "Shrift"}
                </Badge>
                <Text size="xs" c="dimmed">
                  {formatSize(asset.size)}
                  {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ""}
                </Text>
              </Group>
              <Group gap={2}>
                <CopyButton value={snippet}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? "Nusxalandi" : "Kod nusxalash"}>
                      <ActionIcon variant="subtle" onClick={copy}>
                        {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
                <Tooltip label="O'chirish">
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    loading={remove.isPending}
                    onClick={() => remove.mutate({ ...ids, assetId: asset.id })}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Group>
          </Paper>
        );
      })}
    </Stack>
  );
}
