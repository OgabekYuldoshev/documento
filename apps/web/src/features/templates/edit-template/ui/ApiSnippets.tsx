import {
  ActionIcon,
  Code,
  CopyButton,
  Group,
  SegmentedControl,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { trpc } from "@/shared/api";
import { buildSnippets } from "../model/snippets";
import { CodeBlock } from "./CodeBlock";

type Props = { projectId: string; templateId: string };

/** Integration examples for the published version, filled with sample data from its schema. */
export function ApiSnippets({ projectId, templateId }: Props) {
  const { data } = useQuery(trpc.templates.apiExample.queryOptions({ projectId, templateId }));
  const snippets = useMemo(
    () =>
      data
        ? buildSnippets({ baseUrl: window.location.origin, slug: data.slug, data: data.data })
        : [],
    [data],
  );

  const [lang, setLang] = useState<string | undefined>();
  const active = snippets.find((s) => s.id === lang) ?? snippets[0];

  if (!data) {
    return (
      <Text size="sm" c="dimmed">
        Namunalar shablon publish qilingandan keyin chiqadi.
      </Text>
    );
  }

  return (
    <Stack gap="xs">
      <Text size="sm" c="dimmed">
        v{data.version} uchun. API key'ni <Code>DOCUMENTO_API_KEY</Code> o'zgaruvchisiga qo'ying
        (project sahifasidagi "API keylar" bo'limida yaratiladi).
      </Text>
      <SegmentedControl
        size="xs"
        w="fit-content"
        value={active?.id}
        onChange={setLang}
        data={snippets.map((s) => ({ value: s.id, label: s.label }))}
      />
      {active && (
        <Group align="flex-start" wrap="nowrap" gap="xs">
          <div style={{ flex: 1, minWidth: 0 }}>
            <CodeBlock code={active.code} language={active.language} />
          </div>
          <CopyButton value={active.code}>
            {({ copied, copy }) => (
              <Tooltip label={copied ? "Nusxalandi" : "Nusxalash"}>
                <ActionIcon variant="subtle" onClick={copy} aria-label="Nusxalash">
                  {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                </ActionIcon>
              </Tooltip>
            )}
          </CopyButton>
        </Group>
      )}
    </Stack>
  );
}
