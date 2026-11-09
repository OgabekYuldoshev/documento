import { sampleFromSchema, templateSchemaSchema } from "@documento/shared";
import { Alert, List, Stack, Text } from "@mantine/core";
import { useMemo } from "react";
import { JsonEditor } from "./JsonEditor";

type Props = { value: string; onChange: (value: string) => void };

const pointer = (path: PropertyKey[]) => path.map(String).join(".") || "(ildiz)";

/** Lists JSON syntax errors and the structural rules the API enforces (full check runs on save). */
export function lintSchemaText(text: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return [`JSON xato: ${error instanceof Error ? error.message : String(error)}`];
  }
  const result = templateSchemaSchema.safeParse(parsed);
  if (result.success) return [];
  return result.error.issues.slice(0, 6).map((i) => `${pointer(i.path)}: ${i.message}`);
}

export const sampleTextFromSchema = (text: string): string | null => {
  try {
    return JSON.stringify(sampleFromSchema(JSON.parse(text)), null, 2);
  } catch {
    return null;
  }
};

export function SchemaEditor({ value, onChange }: Props) {
  const issues = useMemo(() => lintSchemaText(value), [value]);
  return (
    <Stack gap="xs">
      <JsonEditor value={value} onChange={onChange} label="JSON Schema" />
      {issues.length > 0 ? (
        <Alert color="red" variant="light" title="Schemada xatolar bor">
          <List size="sm">
            {issues.map((message) => (
              <List.Item key={message}>{message}</List.Item>
            ))}
          </List>
        </Alert>
      ) : (
        <Text size="xs" c="dimmed">
          JSON Schema (draft-07). Formatlar: email, uuid, uri, hostname, ipv4, ipv6, date, time,
          date-time, duration va boshqalar. Rasm maydoni:{" "}
          <code>{'{ "type": "string", "format": "image" }'}</code>.
        </Text>
      )}
    </Stack>
  );
}
