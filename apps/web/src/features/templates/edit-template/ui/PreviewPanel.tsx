import { Alert, Button, Code, Paper, Stack, Text } from "@mantine/core";
import { IconEye } from "@tabler/icons-react";
import type { PreviewState } from "../model/useDraftEditor";

type Props = { state: PreviewState | null; loading: boolean; onRun: () => void };

export function PreviewPanel({ state, loading, onRun }: Props) {
  return (
    <Stack gap="xs">
      <Button
        variant="light"
        leftSection={<IconEye size={16} />}
        loading={loading}
        onClick={onRun}
        w="fit-content"
      >
        PDF ko'rish
      </Button>

      {state?.kind === "error" && (
        <Alert color="red" variant="light" title={state.title}>
          <Stack gap={4}>
            {state.lines.map((line) => (
              <Code key={line} block>
                {line}
              </Code>
            ))}
          </Stack>
        </Alert>
      )}

      {state?.kind === "ok" && (
        <>
          <Text size="xs" c="dimmed">
            {state.pages} sahifa · {state.durationMs} ms
          </Text>
          <Paper withBorder radius="md" style={{ overflow: "hidden" }}>
            <iframe
              title="PDF preview"
              src={state.url}
              style={{ width: "100%", height: "72dvh", border: 0, display: "block" }}
            />
          </Paper>
        </>
      )}

      {!state && (
        <Text size="sm" c="dimmed">
          Namuna ma'lumot bilan hujjat qanday chiqishini ko'rish uchun tugmani bosing. Saqlash shart
          emas.
        </Text>
      )}
    </Stack>
  );
}
