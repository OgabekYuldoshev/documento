import type { FieldDef } from "@documento/shared";
import { Box, Button, Stack } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { createField, nextFieldName } from "../model/field-factory";
import { FieldEditor } from "./FieldEditor";

type Props = {
  fields: FieldDef[];
  onChange: (fields: FieldDef[]) => void;
  nested?: boolean;
};

export function FieldListEditor({ fields, onChange, nested }: Props) {
  const update = (i: number, field: FieldDef) =>
    onChange(fields.map((f, idx) => (idx === i ? field : f)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= fields.length) return;
    const next = [...fields];
    [next[i], next[j]] = [next[j] as FieldDef, next[i] as FieldDef];
    onChange(next);
  };

  return (
    <Stack gap="xs" pl={nested ? "md" : 0}>
      {fields.map((field, i) => (
        // Index keys: names are user-editable, so they cannot identify a row.
        // biome-ignore lint/suspicious/noArrayIndexKey: see above
        <Box key={i}>
          <FieldEditor
            field={field}
            onChange={(f) => update(i, f)}
            onRemove={() => onChange(fields.filter((_, idx) => idx !== i))}
            onMove={(dir) => move(i, dir)}
          />
        </Box>
      ))}
      <Button
        variant="light"
        size="xs"
        w="fit-content"
        leftSection={<IconPlus size={14} />}
        onClick={() => onChange([...fields, createField("string", nextFieldName(fields))])}
      >
        Maydon qo'shish
      </Button>
    </Stack>
  );
}
