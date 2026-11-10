import {
  ActionIcon,
  Box,
  Button,
  Group,
  NumberInput,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { emptyValue, isImage, nodeType, type SchemaNode } from "../model/schema-form";
import { ImageField } from "./ImageField";

type Props = {
  projectId: string;
  node: SchemaNode;
  label: string;
  required: boolean;
  value: unknown;
  onChange: (value: unknown) => void;
};

const toLocalInput = (iso: unknown) => {
  if (typeof iso !== "string" || !iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** One form control for a JSON Schema node; objects and arrays recurse. */
export function SchemaField({ projectId, node, label, required, value, onChange }: Props) {
  const common = {
    label,
    description: node.description,
    withAsterisk: required,
  };
  const type = nodeType(node);

  if (type === "object" && node.properties) {
    const current = (value as Record<string, unknown> | undefined) ?? {};
    return (
      <Box
        pl="sm"
        style={{ borderLeft: "2px solid var(--app-border)" }}
        role="group"
        aria-label={label}
      >
        <Text size="sm" fw={600} mb={6}>
          {label}
        </Text>
        <Stack gap="sm">
          {Object.entries(node.properties).map(([key, child]) => (
            <SchemaField
              key={key}
              projectId={projectId}
              node={child}
              label={child.title ?? key}
              required={node.required?.includes(key) ?? false}
              value={current[key]}
              onChange={(v) => onChange({ ...current, [key]: v })}
            />
          ))}
        </Stack>
      </Box>
    );
  }

  if (type === "array" && node.items) {
    const items = Array.isArray(value) ? value : [];
    const item = node.items;
    return (
      <Box>
        <Text size="sm" fw={500}>
          {label}
          {required && <span style={{ color: "var(--mantine-color-red-filled)" }}> *</span>}
        </Text>
        {node.description && (
          <Text size="xs" c="dimmed">
            {node.description}
          </Text>
        )}
        <Stack gap="sm" mt={6}>
          {items.map((entry, i) => (
            // Items have no identity of their own: the index is the key.
            // biome-ignore lint/suspicious/noArrayIndexKey: see above
            <Group key={i} align="flex-start" wrap="nowrap" gap="xs">
              <Box style={{ flex: 1, minWidth: 0 }}>
                <SchemaField
                  projectId={projectId}
                  node={item}
                  label={`${item.title ?? "Element"} ${i + 1}`}
                  required
                  value={entry}
                  onChange={(v) => onChange(items.map((old, j) => (j === i ? v : old)))}
                />
              </Box>
              <ActionIcon
                variant="subtle"
                color="red"
                mt={24}
                aria-label={`${i + 1}-elementni o'chirish`}
                onClick={() => onChange(items.filter((_, j) => j !== i))}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          ))}
          <Button
            size="xs"
            variant="light"
            w="fit-content"
            leftSection={<IconPlus size={14} />}
            onClick={() => onChange([...items, emptyValue(item)])}
          >
            Element qo'shish
          </Button>
        </Stack>
      </Box>
    );
  }

  if (type === "boolean") {
    return (
      <Switch
        label={label}
        description={node.description}
        checked={value === true}
        onChange={(e) => onChange(e.currentTarget.checked)}
      />
    );
  }

  if (type === "number" || type === "integer") {
    return (
      <NumberInput
        {...common}
        placeholder="Son kiriting"
        value={typeof value === "number" ? value : ""}
        min={node.minimum}
        max={node.maximum}
        allowDecimal={type === "number"}
        onChange={(v) => onChange(typeof v === "number" ? v : undefined)}
      />
    );
  }

  // Strings from here on.
  if (node.enum?.length) {
    return (
      <Select
        {...common}
        placeholder="Tanlang"
        data={node.enum.map(String)}
        value={typeof value === "string" ? value : null}
        clearable={!required}
        onChange={(v) => onChange(v ?? "")}
      />
    );
  }

  if (isImage(node)) {
    return (
      <Box>
        <Text size="sm" fw={500} mb={4}>
          {label}
          {required && <span style={{ color: "var(--mantine-color-red-filled)" }}> *</span>}
        </Text>
        <ImageField projectId={projectId} node={node} value={value} onChange={onChange} />
      </Box>
    );
  }

  if (node.format === "date" || node.format === "time") {
    return (
      <TextInput
        {...common}
        type={node.format}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.currentTarget.value)}
      />
    );
  }

  if (node.format === "date-time") {
    return (
      <TextInput
        {...common}
        type="datetime-local"
        value={toLocalInput(value)}
        onChange={(e) => {
          const d = new Date(e.currentTarget.value);
          onChange(Number.isNaN(d.getTime()) ? "" : d.toISOString());
        }}
      />
    );
  }

  if ((node.maxLength ?? 0) > 200) {
    return (
      <Textarea
        {...common}
        placeholder="Matn kiriting"
        autosize
        minRows={3}
        maxRows={10}
        maxLength={node.maxLength}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.currentTarget.value)}
      />
    );
  }

  return (
    <TextInput
      {...common}
      placeholder="Matn kiriting"
      type={node.format === "email" ? "email" : node.format === "uri" ? "url" : "text"}
      maxLength={node.maxLength}
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onChange(e.currentTarget.value)}
    />
  );
}
