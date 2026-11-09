import { type FieldDef, type FieldType, IMAGE_FORMATS, STRING_FORMATS } from "@documento/shared";
import {
  ActionIcon,
  Checkbox,
  Group,
  MultiSelect,
  NumberInput,
  Paper,
  Select,
  Stack,
  TagsInput,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { IconArrowDown, IconArrowUp, IconTrash } from "@tabler/icons-react";
import { changeFieldType, FIELD_TYPE_OPTIONS } from "../model/field-factory";
import { FieldListEditor } from "./FieldListEditor";

type Props = {
  field: FieldDef;
  onChange: (field: FieldDef) => void;
  /** Omit for array item definitions: they have no name or required flag. */
  onRemove?: () => void;
  onMove?: (direction: -1 | 1) => void;
  isItem?: boolean;
};

const num = (v: number | string) => (typeof v === "number" ? v : undefined);

export function FieldEditor({ field, onChange, onRemove, onMove, isItem }: Props) {
  const patch = (p: Record<string, unknown>) => onChange({ ...field, ...p } as FieldDef);

  return (
    <Paper withBorder p="sm" radius="md">
      <Stack gap="xs">
        <Group gap="xs" align="flex-end" wrap="wrap">
          {!isItem && (
            <TextInput
              label="Nomi"
              w={170}
              size="xs"
              value={field.name}
              onChange={(e) => patch({ name: e.currentTarget.value })}
            />
          )}
          <Select
            label={isItem ? "Element turi" : "Turi"}
            w={180}
            size="xs"
            allowDeselect={false}
            data={FIELD_TYPE_OPTIONS}
            value={field.type}
            onChange={(v) => v && onChange(changeFieldType(field, v as FieldType))}
          />
          <TextInput
            label="Sarlavha"
            w={180}
            size="xs"
            value={field.title ?? ""}
            onChange={(e) => patch({ title: e.currentTarget.value || undefined })}
          />
          {!isItem && (
            <Checkbox
              label="Majburiy"
              size="xs"
              mb={6}
              checked={Boolean(field.required)}
              onChange={(e) => patch({ required: e.currentTarget.checked || undefined })}
            />
          )}
          {onRemove && (
            <Group gap={2} ml="auto" mb={2}>
              {onMove && (
                <>
                  <Tooltip label="Yuqoriga">
                    <ActionIcon variant="subtle" color="gray" onClick={() => onMove(-1)}>
                      <IconArrowUp size={16} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Pastga">
                    <ActionIcon variant="subtle" color="gray" onClick={() => onMove(1)}>
                      <IconArrowDown size={16} />
                    </ActionIcon>
                  </Tooltip>
                </>
              )}
              <Tooltip label="O'chirish">
                <ActionIcon variant="subtle" color="red" onClick={onRemove}>
                  <IconTrash size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
          )}
        </Group>

        {field.type === "string" && (
          <Group gap="xs" align="flex-end" wrap="wrap">
            <NumberInput
              label="Min uzunlik"
              size="xs"
              w={110}
              min={0}
              allowDecimal={false}
              value={field.minLength ?? ""}
              onChange={(v) => patch({ minLength: num(v) })}
            />
            <NumberInput
              label="Max uzunlik"
              size="xs"
              w={110}
              min={0}
              allowDecimal={false}
              value={field.maxLength ?? ""}
              onChange={(v) => patch({ maxLength: num(v) })}
            />
            <Select
              label="Format"
              size="xs"
              w={130}
              clearable
              data={[...STRING_FORMATS]}
              value={field.format ?? null}
              onChange={(v) => patch({ format: v ?? undefined })}
            />
            <TextInput
              label="Pattern (regex)"
              size="xs"
              w={200}
              value={field.pattern ?? ""}
              onChange={(e) => patch({ pattern: e.currentTarget.value || undefined })}
            />
          </Group>
        )}

        {(field.type === "number" || field.type === "integer") && (
          <Group gap="xs">
            <NumberInput
              label="Minimum"
              size="xs"
              w={120}
              value={field.minimum ?? ""}
              onChange={(v) => patch({ minimum: num(v) })}
            />
            <NumberInput
              label="Maksimum"
              size="xs"
              w={120}
              value={field.maximum ?? ""}
              onChange={(v) => patch({ maximum: num(v) })}
            />
          </Group>
        )}

        {field.type === "enum" && (
          <TagsInput
            label="Qiymatlar"
            size="xs"
            value={field.values}
            onChange={(values) => patch({ values })}
          />
        )}

        {field.type === "image" && (
          <Group gap="xs" align="flex-end" wrap="wrap">
            <MultiSelect
              label="Formatlar"
              size="xs"
              w={240}
              data={[...IMAGE_FORMATS]}
              value={field.formats ?? []}
              onChange={(v) => patch({ formats: v.length ? v : undefined })}
              placeholder="Hammasi"
            />
            <NumberInput
              label="Max MB"
              size="xs"
              w={100}
              min={0}
              value={field.maxSizeMb ?? ""}
              onChange={(v) => patch({ maxSizeMb: num(v) })}
            />
            <NumberInput
              label="Max megapiksel"
              size="xs"
              w={130}
              min={0}
              value={field.maxMegapixels ?? ""}
              onChange={(v) => patch({ maxMegapixels: num(v) })}
            />
          </Group>
        )}

        {field.type === "array" && (
          <>
            <Group gap="xs">
              <NumberInput
                label="Min elementlar"
                size="xs"
                w={130}
                min={0}
                allowDecimal={false}
                value={field.minItems ?? ""}
                onChange={(v) => patch({ minItems: num(v) })}
              />
              <NumberInput
                label="Max elementlar"
                size="xs"
                w={130}
                min={0}
                allowDecimal={false}
                value={field.maxItems ?? ""}
                onChange={(v) => patch({ maxItems: num(v) })}
              />
            </Group>
            <FieldEditor isItem field={field.items} onChange={(items) => patch({ items })} />
          </>
        )}

        {field.type === "object" && (
          <FieldListEditor fields={field.fields} onChange={(fields) => patch({ fields })} nested />
        )}
      </Stack>
    </Paper>
  );
}
