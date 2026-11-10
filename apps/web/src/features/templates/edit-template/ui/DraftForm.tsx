import { EditorView } from "@codemirror/view";
import {
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Modal,
  NumberInput,
  Popover,
  SegmentedControl,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import {
  IconDeviceFloppy,
  IconInfoCircle,
  IconLock,
  IconPencil,
  IconPhoto,
  IconRocket,
  IconWand,
} from "@tabler/icons-react";
import type { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { type ReactNode, useRef, useState } from "react";
import type { TemplateDraft } from "@/entities/template";
import { ConfirmModal } from "@/shared/ui";
import { useDraftEditor } from "../model/useDraftEditor";
import { AssetsModal } from "./AssetsModal";
import { EditorSplit } from "./editor-split";
import { TEMPLATE_FILES, type TemplateFile } from "./files";
import { JsonEditor } from "./JsonEditor";
import { PreviewViewer } from "./PreviewViewer";
import { type Panel, PanelButtons, ReferenceDrawers } from "./ReferencePanels";
import { SchemaEditor } from "./SchemaEditor";
import { SourceEditor } from "./SourceEditor";
import { WorkspaceFrame } from "./WorkspaceFrame";

type Props = {
  projectId: string;
  templateId: string;
  draft: TemplateDraft;
  title: string;
  description?: string;
  breadcrumbs: { label: string; to: string }[];
  apiPanel: ReactNode;
  versionsPanel: ReactNode;
  endSlot?: ReactNode;
  startSlot?: ReactNode;
  /** Published version: viewable, not editable. `onStartEditing` creates a draft from it. */
  readOnly?: boolean;
  onStartEditing?: () => void;
  startingEdit?: boolean;
};

const SOURCE_HINT =
  "Ma'lumot #let data = json(\"data.json\") orqali o'qiladi. Sahifa o'lchami va shriftlar shu kodda belgilanadi.";

export function DraftForm({
  projectId,
  templateId,
  draft,
  title,
  description,
  breadcrumbs,
  apiPanel,
  versionsPanel,
  endSlot,
  startSlot,
  readOnly = false,
  onStartEditing,
  startingEdit,
}: Props) {
  const ed = useDraftEditor(projectId, templateId, draft);
  const { form, patch } = ed;
  const [assetsOpen, setAssetsOpen] = useState(false);
  const [file, setFile] = useState<TemplateFile>("source");
  const [panel, setPanel] = useState<Panel | null>(null);
  const sourceRef = useRef<ReactCodeMirrorRef>(null);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const blockedTimer = useRef<number | undefined>(undefined);

  /** Explains why typing does nothing in the published version; closes itself. */
  function notifyBlocked() {
    setBlockedOpen(true);
    window.clearTimeout(blockedTimer.current);
    blockedTimer.current = window.setTimeout(() => setBlockedOpen(false), 3500);
  }

  /** Opens main.typ and puts the cursor on `line` (from a Typst diagnostic). */
  function jumpToLine(line: number) {
    setFile("source");
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

  // All three editors stay mounted (cursor, undo history, scroll) and are shown one at a time.
  const pane = (id: TemplateFile, content: ReactNode) => (
    <Box
      style={{
        flex: 1,
        minHeight: 0,
        display: file === id ? "flex" : "none",
        flexDirection: "column",
      }}
    >
      {content}
    </Box>
  );

  const editor = (
    <Box h="100%" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <Popover
        opened={readOnly && blockedOpen}
        onChange={setBlockedOpen}
        position="bottom-start"
        withArrow
        shadow="md"
        offset={4}
      >
        <Popover.Target>
          <Group justify="space-between" wrap="nowrap" h={32} style={{ flexShrink: 0 }}>
            <Group gap={6} wrap="nowrap">
              <SegmentedControl
                size="xs"
                value={file}
                onChange={(v) => setFile(v as TemplateFile)}
                data={TEMPLATE_FILES.map((f) => ({ value: f.id, label: f.name }))}
                styles={{ label: { fontFamily: "var(--mantine-font-family-monospace)" } }}
              />
              {file === "source" && (
                <Tooltip multiline w={260} label={SOURCE_HINT}>
                  <IconInfoCircle size={15} color="var(--mantine-color-dimmed)" />
                </Tooltip>
              )}
            </Group>
            <Group gap={4} wrap="nowrap">
              {file === "sample" && !readOnly && (
                <Tooltip label="Schemadan avtomatik namuna yaratadi (hozirgi matnni almashtiradi)">
                  <Button
                    size="compact-xs"
                    variant="subtle"
                    leftSection={<IconWand size={14} />}
                    onClick={ed.fillSample}
                  >
                    Schemadan namuna
                  </Button>
                </Tooltip>
              )}
              <Tooltip label="Rasm va shriftlar">
                <Button
                  size="compact-xs"
                  variant="subtle"
                  color="gray"
                  leftSection={<IconPhoto size={14} />}
                  onClick={() => setAssetsOpen(true)}
                >
                  Fayllar
                </Button>
              </Tooltip>
            </Group>
          </Group>
        </Popover.Target>
        <Popover.Dropdown>
          <Group gap="xs" wrap="nowrap" align="flex-start" maw={300}>
            <IconLock size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <Stack gap={2}>
              <Text size="sm" fw={600}>
                Tahrirlab bo'lmaydi
              </Text>
              <Text size="xs" c="dimmed">
                Joriy versiya o'zgarmas. O'zgartirish uchun "Tahrirlashni boshlash" tugmasini
                bosing.
              </Text>
            </Stack>
          </Group>
        </Popover.Dropdown>
      </Popover>

      {pane(
        "source",
        <SourceEditor
          editorRef={sourceRef}
          value={form.source}
          readOnly={readOnly}
          onBlockedEdit={notifyBlocked}
          onChange={(source) => patch({ source })}
        />,
      )}
      {pane(
        "schema",
        <SchemaEditor
          value={form.schemaText}
          readOnly={readOnly}
          onBlockedEdit={notifyBlocked}
          onChange={(schemaText) => patch({ schemaText })}
        />,
      )}
      {pane(
        "sample",
        <Stack gap={6} h="100%">
          <JsonEditor
            label="Namuna ma'lumot"
            value={form.sampleText}
            readOnly={readOnly}
            onBlockedEdit={notifyBlocked}
            onChange={(sampleText) => patch({ sampleText })}
          />
          <Text size="xs" c="dimmed">
            Publish paytida namuna ma'lumot schemaga mos kelishi tekshiriladi.
          </Text>
        </Stack>,
      )}
    </Box>
  );

  const split = (
    <EditorSplit
      left={editor}
      right={
        <PreviewViewer
          preview={ed.preview}
          problem={ed.problem}
          rendering={ed.previewing}
          onJumpToLine={jumpToLine}
          onDownload={() => ed.downloadPdf(title)}
          downloading={ed.downloading}
        />
      }
    />
  );

  return (
    <>
      <WorkspaceFrame
        breadcrumbs={breadcrumbs}
        title={title}
        description={description}
        endSlot={endSlot}
        startSlot={startSlot}
        badges={
          readOnly ? (
            <Badge color="teal" variant="light">
              v{draft.number} faol
            </Badge>
          ) : (
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
          )
        }
        actions={
          <Group gap="xs" wrap="nowrap">
            <PanelButtons onOpen={setPanel} showLimits={!readOnly} />
            <Divider orientation="vertical" my={6} />
            {readOnly ? (
              <Button
                leftSection={<IconPencil size={16} />}
                loading={startingEdit}
                onClick={onStartEditing}
              >
                Tahrirlashni boshlash
              </Button>
            ) : (
              <>
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
              </>
            )}
          </Group>
        }
      >
        {split}
      </WorkspaceFrame>

      <Modal opened={panel === "limits"} onClose={() => setPanel(null)} title="Limitlar" centered>
        <Stack>
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
          <Text size="xs" c="dimmed">
            O'zgarishlar "Saqlash" bosilgach kuchga kiradi.
          </Text>
        </Stack>
      </Modal>

      <AssetsModal
        opened={assetsOpen}
        onClose={() => setAssetsOpen(false)}
        projectId={projectId}
        templateId={templateId}
        readOnly={readOnly}
      />

      <ReferenceDrawers
        open={panel}
        onClose={() => setPanel(null)}
        apiPanel={apiPanel}
        versionsPanel={versionsPanel}
      />

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
