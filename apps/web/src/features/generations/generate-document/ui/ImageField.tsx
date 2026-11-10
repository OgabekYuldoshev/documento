import { ActionIcon, Button, FileButton, Group, Text } from "@mantine/core";
import { IconPhoto, IconUpload, IconX } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { getErrorMessage } from "@/shared/api";
import { notify } from "@/shared/lib";
import { imageAccept, type SchemaNode } from "../model/schema-form";

type Props = {
  projectId: string;
  node: SchemaNode;
  /** Upload id (`upl_…`) or empty. */
  value: unknown;
  onChange: (value: string) => void;
};

/** Uploads the picked file right away; the form value is the upload id the API expects. */
export function ImageField({ projectId, node, value, onChange }: Props) {
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview.url);
    },
    [preview],
  );

  async function pick(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/uploads`, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      const data = (await res.json().catch(() => null)) as {
        uploadId?: string;
        message?: string;
      } | null;
      if (!res.ok || !data?.uploadId) throw new Error(data?.message ?? "Yuklab bo'lmadi");
      onChange(data.uploadId);
      setPreview({ url: URL.createObjectURL(file), name: file.name });
    } catch (error) {
      notify.error(getErrorMessage(error));
    } finally {
      setUploading(false);
    }
  }

  const has = typeof value === "string" && value !== "";

  return (
    <Group gap="sm" wrap="nowrap">
      {has && preview ? (
        <img
          src={preview.url}
          alt={preview.name}
          style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 6 }}
        />
      ) : (
        <IconPhoto size={28} stroke={1.4} color="var(--mantine-color-dimmed)" />
      )}
      <Text size="sm" c={has ? undefined : "dimmed"} style={{ flex: 1 }} lineClamp={1}>
        {has ? (preview?.name ?? "Rasm yuklangan") : "Rasm tanlanmagan"}
      </Text>
      <FileButton onChange={pick} accept={imageAccept(node)}>
        {(props) => (
          <Button
            {...props}
            size="xs"
            variant="light"
            leftSection={<IconUpload size={14} />}
            loading={uploading}
          >
            {has ? "Almashtirish" : "Yuklash"}
          </Button>
        )}
      </FileButton>
      {has && (
        <ActionIcon
          variant="subtle"
          color="gray"
          aria-label="Rasmni olib tashlash"
          onClick={() => {
            setPreview(null);
            onChange("");
          }}
        >
          <IconX size={16} />
        </ActionIcon>
      )}
    </Group>
  );
}
