import { ActionIcon, Code, CopyButton, Group, Stack, Tabs, Text, Tooltip } from "@mantine/core";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { trpc } from "@/shared/api";
import { buildSnippets } from "../model/snippets";

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
      <Tabs defaultValue={snippets[0]?.id}>
        <Tabs.List>
          {snippets.map((s) => (
            <Tabs.Tab key={s.id} value={s.id}>
              {s.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        {snippets.map((s) => (
          <Tabs.Panel key={s.id} value={s.id} pt="sm">
            <Group align="flex-start" wrap="nowrap" gap="xs">
              <Code block style={{ flex: 1, overflowX: "auto" }}>
                {s.code}
              </Code>
              <CopyButton value={s.code}>
                {({ copied, copy }) => (
                  <Tooltip label={copied ? "Nusxalandi" : "Nusxalash"}>
                    <ActionIcon variant="subtle" onClick={copy} aria-label="Nusxalash">
                      {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                    </ActionIcon>
                  </Tooltip>
                )}
              </CopyButton>
            </Group>
          </Tabs.Panel>
        ))}
      </Tabs>
    </Stack>
  );
}
