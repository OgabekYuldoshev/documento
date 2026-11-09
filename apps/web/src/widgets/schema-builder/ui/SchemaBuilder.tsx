import { type TemplateSchema, templateSchemaSchema } from "@documento/shared";
import { Alert, List, Stack } from "@mantine/core";
import { useMemo } from "react";
import { FieldListEditor } from "./FieldListEditor";

type Props = { value: TemplateSchema; onChange: (value: TemplateSchema) => void };

const pointer = (path: PropertyKey[]) =>
  path.filter((p) => p !== "fields" && p !== "items").join(".");

/** Visual editor for the strict field schema; shows the same rules the API enforces. */
export function SchemaBuilder({ value, onChange }: Props) {
  const issues = useMemo(() => {
    const r = templateSchemaSchema.safeParse(value);
    return r.success ? [] : r.error.issues.slice(0, 5);
  }, [value]);

  return (
    <Stack gap="sm">
      <FieldListEditor fields={value.fields} onChange={(fields) => onChange({ fields })} />
      {issues.length > 0 && (
        <Alert color="red" variant="light" title="Schemada xatolar bor">
          <List size="sm">
            {issues.map((i) => (
              <List.Item key={`${i.path.join("/")}:${i.message}`}>
                {pointer(i.path)}: {i.message}
              </List.Item>
            ))}
          </List>
        </Alert>
      )}
    </Stack>
  );
}
