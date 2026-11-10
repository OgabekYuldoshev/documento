import {
  ActionIcon,
  Button,
  CopyButton,
  FileButton,
  Group,
  Loader,
  Modal,
  Paper,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import {
  IconCheck,
  IconCopy,
  IconPhoto,
  IconTrash,
  IconTypography,
  IconUpload,
} from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getErrorMessage, queryClient, trpc } from "@/shared/api";
import { notify } from "@/shared/lib";

type Props = {
  opened: boolean;
  onClose: () => void;
  projectId: string;
  templateId: string;
  /** Published version: assets can be viewed and copied, not changed. */
  readOnly?: boolean;
};

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

/**
 * Template files (images, fonts): upload, list, and copy the Typst snippet that uses a file:
 * `#image("assets/logo.png")` for images, the font name for fonts.
 */
export function AssetsModal({ opened, onClose, projectId, templateId, readOnly }: Props) {
  const ids = { projectId, templateId };
  const { data: assets, isPending } = useQuery({
    ...trpc.templateAssets.list.queryOptions(ids),
    enabled: opened,
  });
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
    <Modal opened={opened} onClose={onClose} title="Fayllar" size="md">
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <Text size="sm" c="dimmed" maw={300}>
            Rasm va shriftlar. Nusxalash tugmasi Typst kodini ko'chiradi.
          </Text>
          {!readOnly && (
            <FileButton
              onChange={(f) => f && upload.mutate(f)}
              accept=".png,.jpg,.jpeg,.svg,.ttf,.otf"
            >
              {(props) => (
                <Button
                  {...props}
                  size="xs"
                  variant="light"
                  leftSection={<IconUpload size={14} />}
                  loading={upload.isPending}
                >
                  Yuklash
                </Button>
              )}
            </FileButton>
          )}
        </Group>

        {isPending && <Loader size="sm" mx="auto" my="md" />}
        {assets?.length === 0 && (
          <Text size="sm" c="dimmed" ta="center" py="lg">
            Fayl yo'q. PNG, JPG, SVG, TTF yoki OTF yuklang.
          </Text>
        )}

        <Stack gap={6} mah={420} style={{ overflowY: "auto" }}>
          {assets?.map((asset) => {
            const snippet = asset.kind === "image" ? `#image("assets/${asset.name}")` : asset.name;
            const Icon = asset.kind === "image" ? IconPhoto : IconTypography;
            return (
              <Paper key={asset.id} withBorder px="sm" py={8} radius="md">
                <Group gap="sm" wrap="nowrap">
                  <Icon size={18} stroke={1.6} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text size="sm" fw={500} lineClamp={1} title={asset.name}>
                      {asset.name}
                    </Text>
                    <Text size="xs" c="dimmed" ff="monospace" lineClamp={1}>
                      {snippet} · {formatSize(asset.size)}
                    </Text>
                  </div>
                  <CopyButton value={snippet}>
                    {({ copied, copy }) => (
                      <Tooltip label={copied ? "Nusxalandi" : "Kodni nusxalash"}>
                        <ActionIcon
                          variant="subtle"
                          color={copied ? "teal" : "gray"}
                          onClick={copy}
                          aria-label={`${asset.name} kodini nusxalash`}
                        >
                          {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </CopyButton>
                  {!readOnly && (
                    <Tooltip label="O'chirish">
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        aria-label={`${asset.name} ni o'chirish`}
                        loading={remove.isPending && remove.variables?.assetId === asset.id}
                        onClick={() => remove.mutate({ ...ids, assetId: asset.id })}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Group>
              </Paper>
            );
          })}
        </Stack>
      </Stack>
    </Modal>
  );
}
