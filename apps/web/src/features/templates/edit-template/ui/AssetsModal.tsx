import {
  ActionIcon,
  Badge,
  Button,
  CopyButton,
  FileButton,
  Group,
  Loader,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import {
  IconCheck,
  IconCopy,
  IconFile,
  IconTrash,
  IconTypography,
  IconUpload,
} from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
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
    <Modal opened={opened} onClose={onClose} title="Fayllar" size="xl">
      <Stack gap="md">
        <Group justify="space-between" wrap="nowrap" align="center">
          <Text size="sm" c="dimmed">
            Rasm va shriftlar. Nusxalash tugmasi Typst kodini ko'chiradi.
          </Text>
          {!readOnly && (
            <FileButton
              onChange={(f) => f && upload.mutate(f)}
              accept=".png,.jpg,.jpeg,.webp,.svg,.ttf,.otf"
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
          <Text size="sm" c="dimmed" ta="center" py="xl">
            Fayl yo'q. PNG, JPG, SVG, TTF yoki OTF yuklang.
          </Text>
        )}

        <SimpleGrid
          cols={{ base: 2, sm: 3, md: 4 }}
          spacing="sm"
          mah="60dvh"
          style={{ overflowY: "auto" }}
        >
          {assets?.map((asset) => {
            const snippet = asset.kind === "image" ? `#image("assets/${asset.name}")` : asset.name;
            return (
              <Paper key={asset.id} withBorder radius="md" style={{ overflow: "hidden" }}>
                <AssetPreview templateId={templateId} asset={asset} />
                <Group gap={4} wrap="nowrap" px="xs" py={6}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text size="sm" fw={500} lineClamp={1} title={asset.name}>
                      {asset.name}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {formatSize(asset.size)}
                    </Text>
                  </div>
                  <CopyButton value={snippet}>
                    {({ copied, copy }) => (
                      <Tooltip label={copied ? "Nusxalandi" : `Nusxalash: ${snippet}`}>
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
        </SimpleGrid>
      </Stack>
    </Modal>
  );
}

type AssetItem = NonNullable<ReturnType<typeof useAssetList>["data"]>[number];
const useAssetList = (ids: { projectId: string; templateId: string }) =>
  useQuery(trpc.templateAssets.list.queryOptions(ids));

const extensionOf = (name: string) => name.split(".").pop()?.toUpperCase() ?? "";

/** Images show their picture; everything else (fonts, ...) shows a tile with the file extension. */
function AssetPreview({ templateId, asset }: { templateId: string; asset: AssetItem }) {
  const [failed, setFailed] = useState(false);
  const frame = {
    height: 120,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--app-subtle)",
    borderBottom: "1px solid var(--app-border)",
  } as const;

  if (asset.kind === "image" && !failed) {
    return (
      <div style={frame}>
        <img
          src={`/api/templates/${templateId}/assets/${asset.id}/file`}
          alt={asset.name}
          loading="lazy"
          onError={() => setFailed(true)}
          style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
        />
      </div>
    );
  }
  const Icon = asset.kind === "font" ? IconTypography : IconFile;
  return (
    <div style={{ ...frame, flexDirection: "column", gap: 6 }}>
      <Icon size={28} stroke={1.4} color="var(--mantine-color-dimmed)" />
      <Badge variant="light" color="gray" radius="sm">
        {extensionOf(asset.name)}
      </Badge>
    </div>
  );
}
