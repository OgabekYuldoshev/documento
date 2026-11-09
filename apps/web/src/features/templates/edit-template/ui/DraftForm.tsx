import {
  Button,
  Group,
  NumberInput,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Textarea,
  Tooltip,
} from "@mantine/core";
import { IconDeviceFloppy, IconRocket, IconWand } from "@tabler/icons-react";
import type { TemplateDraft } from "@/entities/template";
import { ConfirmModal } from "@/shared/ui";
import { SchemaBuilder } from "@/widgets/schema-builder";
import { useDraftEditor } from "../model/useDraftEditor";
import { AssetsPanel } from "./AssetsPanel";
import { PreviewPanel } from "./PreviewPanel";
import { SourceEditor } from "./SourceEditor";

type Props = { projectId: string; templateId: string; draft: TemplateDraft };

export function DraftForm({ projectId, templateId, draft }: Props) {
  const ed = useDraftEditor(projectId, templateId, draft);
  const { form, patch } = ed;

  return (
    <Stack>
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Qoralama v{draft.number}
          {ed.dirty && " · saqlanmagan o'zgarishlar bor"}
        </Text>
        <Group gap="xs">
          <Button
            variant="default"
            leftSection={<IconDeviceFloppy size={16} />}
            disabled={!ed.dirty}
            loading={ed.saving}
            onClick={ed.save}
          >
            Saqlash
          </Button>
          <Button
            leftSection={<IconRocket size={16} />}
            loading={ed.publishing}
            onClick={() => ed.publish()}
          >
            Publish
          </Button>
        </Group>
      </Group>

      <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="lg">
        <Tabs defaultValue="source" keepMounted>
          <Tabs.List mb="md">
            <Tabs.Tab value="source">Kod (Typst)</Tabs.Tab>
            <Tabs.Tab value="schema">Schema</Tabs.Tab>
            <Tabs.Tab value="sample">Namuna ma'lumot</Tabs.Tab>
            <Tabs.Tab value="assets">Fayllar</Tabs.Tab>
            <Tabs.Tab value="limits">Limitlar</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="source">
            <SourceEditor value={form.source} onChange={(source) => patch({ source })} />
            <Text size="xs" c="dimmed" mt={6}>
              Ma'lumot <code>#let data = json("data.json")</code> orqali o'qiladi. Sahifa o'lchami
              va shriftlar shu kodda belgilanadi.
            </Text>
          </Tabs.Panel>

          <Tabs.Panel value="schema">
            <SchemaBuilder value={form.schema} onChange={(schema) => patch({ schema })} />
          </Tabs.Panel>

          <Tabs.Panel value="sample">
            <Stack gap="xs">
              <Group justify="flex-end">
                <Tooltip label="Schemadan avtomatik namuna yaratadi (hozirgi matnni almashtiradi)">
                  <Button
                    size="xs"
                    variant="light"
                    leftSection={<IconWand size={14} />}
                    onClick={ed.fillSample}
                  >
                    Schemadan namuna
                  </Button>
                </Tooltip>
              </Group>
              <Textarea
                aria-label="Namuna ma'lumot"
                autosize
                minRows={14}
                maxRows={32}
                spellCheck={false}
                styles={{
                  input: { fontFamily: "var(--mantine-font-family-monospace)", fontSize: 13 },
                }}
                value={form.sampleText}
                onChange={(e) => patch({ sampleText: e.currentTarget.value })}
              />
              <Text size="xs" c="dimmed">
                Publish paytida namuna ma'lumot schemaga mos kelishi tekshiriladi.
              </Text>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="assets">
            <AssetsPanel projectId={projectId} templateId={templateId} />
          </Tabs.Panel>

          <Tabs.Panel value="limits">
            <Stack maw={360}>
              <NumberInput
                label="Render vaqt limiti (soniya)"
                min={1}
                max={300}
                allowDecimal={false}
                value={form.renderTimeoutSec}
                onChange={(v) => typeof v === "number" && patch({ renderTimeoutSec: v })}
              />
              <NumberInput
                label="Kiruvchi ma'lumot limiti (KB)"
                description="Katta jadvalli hujjatlar uchun oshiring (10240 gacha)"
                min={1}
                max={10240}
                allowDecimal={false}
                value={form.maxPayloadKb}
                onChange={(v) => typeof v === "number" && patch({ maxPayloadKb: v })}
              />
            </Stack>
          </Tabs.Panel>
        </Tabs>
        <PreviewPanel state={ed.preview} loading={ed.previewing} onRun={ed.runPreview} />
      </SimpleGrid>

      <ConfirmModal
        opened={ed.breaking !== null}
        onClose={ed.dismissBreaking}
        title="Buzuvchi o'zgarishlar"
        message={`${ed.breaking ?? ""}. Mavjud integratsiyalar eski versiyada qoladi. Baribir publish qilinsinmi?`}
        confirmLabel="Publish qilish"
        color="blue"
        loading={ed.publishing}
        onConfirm={() => ed.publish(true)}
      />
    </Stack>
  );
}
