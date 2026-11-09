import { EditorView } from "@codemirror/view";
import { Badge, Box, Button, Group, NumberInput, Stack, Tabs, Text, Tooltip } from "@mantine/core";
import { IconDeviceFloppy, IconRocket, IconWand } from "@tabler/icons-react";
import type { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { Fragment, useRef, useState } from "react";
import type { TemplateDraft } from "@/entities/template";
import { ConfirmModal } from "@/shared/ui";
import { useDraftEditor } from "../model/useDraftEditor";
import { AssetsPanel } from "./AssetsPanel";
import { EditorSplit } from "./editor-split";
import { JsonEditor } from "./JsonEditor";
import { PreviewViewer } from "./PreviewViewer";
import { SchemaEditor } from "./SchemaEditor";
import { SourceEditor } from "./SourceEditor";
import { WorkspaceFrame, type WorkspaceTab } from "./WorkspaceFrame";

type Props = {
  projectId: string;
  templateId: string;
  draft: TemplateDraft;
  title: string;
  description?: string;
  breadcrumbs: { label: string; to: string }[];
  /** Tabs shown after the editor (API snippets, version history). */
  extraTabs: WorkspaceTab[];
};

export function DraftForm({
  projectId,
  templateId,
  draft,
  title,
  description,
  breadcrumbs,
  extraTabs,
}: Props) {
  const ed = useDraftEditor(projectId, templateId, draft);
  const { form, patch } = ed;
  const [tab, setTab] = useState<string | null>("source");
  const sourceRef = useRef<ReactCodeMirrorRef>(null);

  /** Switches to the code tab and puts the cursor on `line` (from a Typst diagnostic). */
  function jumpToLine(line: number) {
    setTab("source");
    requestAnimationFrame(() => {
      const view = sourceRef.current?.view;
      if (!view) return;
      const target = view.state.doc.line(Math.min(Math.max(line, 1), view.state.doc.lines));
      view.dispatch({
        selection: { anchor: target.from },
        effects: EditorView.scrollIntoView(target.from, { y: "center" }),
      });
      view.focus();
    });
  }

  // One tab bar for everything: editing tabs first, API/Versiyalar pushed to the right.
  const editor = (
    <Tabs value={tab} onChange={setTab} keepMounted h="100%">
      <EditorSplit
        left={
          <Box h="100%" style={{ display: "flex", flexDirection: "column" }}>
            <Tabs.List mb="sm" style={{ flexWrap: "nowrap", overflowX: "auto", flexShrink: 0 }}>
              <Tabs.Tab value="source">Kod</Tabs.Tab>
              <Tabs.Tab value="schema">Schema</Tabs.Tab>
              <Tabs.Tab value="sample">Namuna</Tabs.Tab>
              <Tabs.Tab value="assets">Fayllar</Tabs.Tab>
              <Tabs.Tab value="limits">Limitlar</Tabs.Tab>
              {extraTabs.map((t, i) => (
                <Fragment key={t.value}>
                  {i === 0 && (
                    // Thin separator between the editing tabs and the reference tabs.
                    <Box
                      aria-hidden
                      w={1}
                      h={16}
                      mx="xs"
                      style={{ alignSelf: "center", background: "var(--app-border)" }}
                    />
                  )}
                  <Tabs.Tab value={t.value}>{t.label}</Tabs.Tab>
                </Fragment>
              ))}
            </Tabs.List>

            <Tabs.Panel value="source" style={{ flex: 1, minHeight: 0 }}>
              <Stack gap="xs" h="100%">
                <SourceEditor
                  editorRef={sourceRef}
                  value={form.source}
                  onChange={(source) => patch({ source })}
                />
                <Text size="xs" c="dimmed">
                  Ma'lumot <code>#let data = json("data.json")</code> orqali o'qiladi. Sahifa
                  o'lchami va shriftlar shu kodda belgilanadi.
                </Text>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="schema" style={{ flex: 1, minHeight: 0 }}>
              <SchemaEditor
                value={form.schemaText}
                onChange={(schemaText) => patch({ schemaText })}
              />
            </Tabs.Panel>

            <Tabs.Panel value="sample" style={{ flex: 1, minHeight: 0 }}>
              <Stack gap="xs" h="100%">
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
                <JsonEditor
                  label="Namuna ma'lumot"
                  value={form.sampleText}
                  onChange={(sampleText) => patch({ sampleText })}
                />
                <Text size="xs" c="dimmed">
                  Publish paytida namuna ma'lumot schemaga mos kelishi tekshiriladi.
                </Text>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="assets" style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
              <AssetsPanel projectId={projectId} templateId={templateId} />
            </Tabs.Panel>

            <Tabs.Panel value="limits" style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
              <Stack maw={360}>
                <NumberInput
                  label="Render vaqt limiti (soniya)"
                  placeholder="Masalan: 30"
                  min={1}
                  max={300}
                  allowDecimal={false}
                  value={form.renderTimeoutSec}
                  onChange={(v) => typeof v === "number" && patch({ renderTimeoutSec: v })}
                />
                <NumberInput
                  label="Kiruvchi ma'lumot limiti (KB)"
                  placeholder="Masalan: 512"
                  description="Katta jadvalli hujjatlar uchun oshiring (10240 gacha)"
                  min={1}
                  max={10240}
                  allowDecimal={false}
                  value={form.maxPayloadKb}
                  onChange={(v) => typeof v === "number" && patch({ maxPayloadKb: v })}
                />
              </Stack>
            </Tabs.Panel>
            {extraTabs.map((t) => (
              <Tabs.Panel
                key={t.value}
                value={t.value}
                style={{ flex: 1, minHeight: 0, overflow: "auto" }}
              >
                {t.content}
              </Tabs.Panel>
            ))}
          </Box>
        }
        right={
          <PreviewViewer
            preview={ed.preview}
            problem={ed.problem}
            rendering={ed.previewing}
            onJumpToLine={jumpToLine}
          />
        }
      />
    </Tabs>
  );

  return (
    <>
      <WorkspaceFrame
        breadcrumbs={breadcrumbs}
        title={title}
        description={description}
        badges={
          <Group gap={6} wrap="nowrap">
            <Badge color="yellow" variant="light">
              Qoralama v{draft.number}
            </Badge>
            {ed.dirty && (
              <Badge color="gray" variant="dot">
                Saqlanmagan
              </Badge>
            )}
          </Group>
        }
        actions={
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
        }
      >
        {editor}
      </WorkspaceFrame>

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
    </>
  );
}
