import {
  ActionIcon,
  CopyButton,
  FileButton,
  Group,
  Loader,
  NavLink,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { IconPhoto, IconPlus, IconTrash, IconTypography } from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getErrorMessage, queryClient, trpc } from "@/shared/api";
import { notify } from "@/shared/lib";
import { TEMPLATE_FILES, type TemplateFile } from "./files";

type Props = {
  projectId: string;
  templateId: string;
  active: TemplateFile;
  onSelect: (file: TemplateFile) => void;
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

const compact = { root: { padding: "6px 8px" } };

function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      px={8}
      pt={4}
      fz={11}
      fw={700}
      c="dimmed"
      tt="uppercase"
      style={{ letterSpacing: "0.06em" }}
    >
      {children}
    </Text>
  );
}

/**
 * File explorer: the three template files, plus uploaded assets (images, fonts).
 * Clicking an asset copies how to use it in Typst: `#image("assets/logo.png")`; fonts by name.
 */
export function FileTree({ projectId, templateId, active, onSelect }: Props) {
  const ids = { projectId, templateId };
  const { data: assets, isPending } = useQuery(trpc.templateAssets.list.queryOptions(ids));
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
    <Stack gap={2} p="xs">
      <SectionLabel>Shablon</SectionLabel>
      {TEMPLATE_FILES.map((file) => (
        <NavLink
          key={file.id}
          active={active === file.id}
          label={file.name}
          leftSection={<file.icon size={16} stroke={1.6} />}
          onClick={() => onSelect(file.id)}
          styles={{
            ...compact,
            label: { fontFamily: "var(--mantine-font-family-monospace)", fontSize: 13 },
          }}
        />
      ))}

      <Group justify="space-between" mt="xs" pr={4} wrap="nowrap">
        <SectionLabel>Assets</SectionLabel>
        <FileButton onChange={(f) => f && upload.mutate(f)} accept=".png,.jpg,.jpeg,.svg,.ttf,.otf">
          {(props) => (
            <Tooltip label="Fayl yuklash (png, jpg, svg, ttf, otf)">
              <ActionIcon
                {...props}
                size="sm"
                variant="subtle"
                color="gray"
                loading={upload.isPending}
                aria-label="Fayl yuklash"
              >
                <IconPlus size={14} />
              </ActionIcon>
            </Tooltip>
          )}
        </FileButton>
      </Group>

      {isPending && <Loader size="xs" mx={8} my={4} />}
      {assets?.length === 0 && (
        <Text size="xs" c="dimmed" px={8}>
          Fayl yo'q. Rasm yoki shrift yuklang.
        </Text>
      )}
      {assets?.map((asset) => {
        const snippet = asset.kind === "image" ? `#image("assets/${asset.name}")` : asset.name;
        const Icon = asset.kind === "image" ? IconPhoto : IconTypography;
        return (
          <Group key={asset.id} gap={2} wrap="nowrap">
            <CopyButton value={snippet}>
              {({ copied, copy }) => (
                <Tooltip
                  label={copied ? "Nusxalandi" : `Kod nusxalash: ${snippet}`}
                  position="right"
                  openDelay={300}
                >
                  <NavLink
                    component="button"
                    label={asset.name}
                    description={formatSize(asset.size)}
                    leftSection={<Icon size={16} stroke={1.6} />}
                    onClick={copy}
                    style={{ flex: 1, minWidth: 0 }}
                    styles={{
                      ...compact,
                      label: { overflow: "hidden", textOverflow: "ellipsis", fontSize: 13 },
                    }}
                  />
                </Tooltip>
              )}
            </CopyButton>
            <Tooltip label="O'chirish">
              <ActionIcon
                size="sm"
                variant="subtle"
                color="red"
                aria-label={`${asset.name} ni o'chirish`}
                loading={remove.isPending && remove.variables?.assetId === asset.id}
                onClick={() => remove.mutate({ ...ids, assetId: asset.id })}
              >
                <IconTrash size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
        );
      })}
    </Stack>
  );
}
