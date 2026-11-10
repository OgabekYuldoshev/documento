import {
  ActionIcon,
  Badge,
  Box,
  Center,
  Collapse,
  Group,
  Loader,
  Text,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import {
  IconAlertTriangle,
  IconChevronDown,
  IconChevronUp,
  IconDownload,
  IconFileOff,
  IconZoomIn,
  IconZoomOut,
} from "@tabler/icons-react";
import { useRef, useState } from "react";
import type { PreviewPages, PreviewProblem } from "../model/useDraftEditor";

type Props = {
  preview: PreviewPages | null;
  problem: PreviewProblem | null;
  rendering: boolean;
  /** Called when the author clicks a problem that points to a source line. */
  onJumpToLine: (line: number) => void;
  onDownload: () => void;
  downloading: boolean;
};

// Scale is relative to the viewer width: 1 = page fits the width.
const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const STEP = 0.25;

/** Typst page viewer: stacked SVG pages on a canvas, zoom, page counter and a problems drawer. */
export function PreviewViewer({
  preview,
  problem,
  rendering,
  onJumpToLine,
  onDownload,
  downloading,
}: Props) {
  const [scale, setScale] = useState(1);
  const [page, setPage] = useState(1);
  const [problemsOpen, setProblemsOpen] = useState(true);
  const canvas = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Width / height of the first page: reserves room for pages that are not loaded yet.
  const [ratio, setRatio] = useState<number | null>(null);

  const pageCount = preview?.urls.length ?? 0;
  const zoom = (delta: number) =>
    setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round((s + delta) * 100) / 100)));

  /** The current page is the last one whose top edge is above a third of the viewport. */
  function trackPage() {
    const el = canvas.current;
    if (!el) return;
    const probe = el.scrollTop + el.clientHeight / 3;
    let current = 1;
    pageRefs.current.forEach((img, i) => {
      if (img && img.offsetTop <= probe) current = i + 1;
    });
    setPage(current);
  }

  return (
    <Box
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        border: "1px solid var(--app-border)",
        borderRadius: "var(--mantine-radius-md)",
        overflow: "hidden",
        background: "var(--app-surface)",
      }}
    >
      <Group
        justify="space-between"
        wrap="nowrap"
        px="sm"
        h={36}
        style={{ flexShrink: 0, borderBottom: "1px solid var(--app-border)" }}
      >
        <Group gap={8} wrap="nowrap" miw={0}>
          {rendering ? (
            <>
              <Loader size={14} />
              <Text size="xs" c="dimmed">
                Yangilanmoqda…
              </Text>
            </>
          ) : problem ? (
            <Badge color="red" variant="light" leftSection={<IconAlertTriangle size={12} />}>
              Xato
            </Badge>
          ) : preview ? (
            <Text size="xs" c="dimmed" truncate>
              Tayyor · {preview.durationMs} ms
            </Text>
          ) : null}
        </Group>

        <Text size="xs" fw={500} aria-live="polite">
          {pageCount > 0 ? `${Math.min(page, pageCount)} / ${pageCount}` : ""}
        </Text>

        <Group gap={4} wrap="nowrap">
          <Tooltip label="Kichraytirish">
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label="Kichraytirish"
              disabled={scale <= MIN_SCALE}
              onClick={() => zoom(-STEP)}
            >
              <IconZoomOut size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Kenglikka moslash">
            <UnstyledButton
              onClick={() => setScale(1)}
              aria-label="Kenglikka moslash"
              style={{ minWidth: 44, textAlign: "center", fontSize: 12, fontWeight: 500 }}
            >
              {Math.round(scale * 100)}%
            </UnstyledButton>
          </Tooltip>
          <Tooltip label="Kattalashtirish">
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label="Kattalashtirish"
              disabled={scale >= MAX_SCALE}
              onClick={() => zoom(STEP)}
            >
              <IconZoomIn size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="PDF yuklab olish">
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label="PDF yuklab olish"
              loading={downloading}
              disabled={!preview}
              onClick={onDownload}
            >
              <IconDownload size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      <Box
        ref={canvas}
        onScroll={trackPage}
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          padding: 16,
          background: "light-dark(var(--mantine-color-gray-1), var(--mantine-color-dark-8))",
          opacity: rendering && preview ? 0.7 : 1,
          transition: "opacity 120ms ease",
        }}
      >
        {preview ? (
          <Box style={{ width: `${scale * 100}%`, margin: "0 auto" }}>
            {preview.urls.map((url, i) => (
              <PageImage
                key={url}
                url={url}
                index={i}
                // Until page 1 reports its size, only page 1 loads (it sets the placeholder size).
                ratio={ratio}
                disabled={i > 0 && !ratio}
                onRatio={i === 0 ? setRatio : undefined}
                innerRef={(el) => {
                  pageRefs.current[i] = el;
                }}
              />
            ))}
          </Box>
        ) : (
          <Center h="100%" mih={200}>
            {rendering ? (
              <Loader size="sm" />
            ) : (
              <Box ta="center">
                <IconFileOff size={32} stroke={1.4} color="var(--mantine-color-dimmed)" />
                <Text size="sm" c="dimmed" mt={4}>
                  {problem ? "Xatolarni tuzating" : "Ko'rinish hali tayyor emas"}
                </Text>
              </Box>
            )}
          </Center>
        )}
      </Box>

      {problem && (
        <Box style={{ flexShrink: 0, borderTop: "1px solid var(--app-border)" }}>
          <UnstyledButton
            onClick={() => setProblemsOpen((o) => !o)}
            aria-expanded={problemsOpen}
            w="100%"
            px="sm"
            py={8}
          >
            <Group justify="space-between" wrap="nowrap">
              <Group gap={8} wrap="nowrap">
                <IconAlertTriangle size={16} color="var(--mantine-color-red-filled)" />
                <Text size="sm" fw={600}>
                  {problem.title}
                </Text>
                <Badge size="xs" color="red" variant="light" circle>
                  {problem.items.length}
                </Badge>
              </Group>
              {problemsOpen ? <IconChevronDown size={16} /> : <IconChevronUp size={16} />}
            </Group>
          </UnstyledButton>
          <Collapse expanded={problemsOpen}>
            <Box mah={200} px="sm" pb="sm" style={{ overflow: "auto" }}>
              {problem.items.map((item) => {
                const line = item.line;
                return line ? (
                  <UnstyledButton
                    key={item.text}
                    onClick={() => onJumpToLine(line)}
                    w="100%"
                    p={6}
                    style={{ borderRadius: "var(--mantine-radius-sm)", textAlign: "left" }}
                    title="Kodda ko'rsatish"
                  >
                    <ProblemText>{item.text}</ProblemText>
                  </UnstyledButton>
                ) : (
                  <Box key={item.text} p={6}>
                    <ProblemText>{item.text}</ProblemText>
                  </Box>
                );
              })}
            </Box>
          </Collapse>
        </Box>
      )}
    </Box>
  );
}

type PageImageProps = {
  url: string;
  index: number;
  ratio: number | null;
  disabled: boolean;
  onRatio?: (ratio: number) => void;
  innerRef: (el: HTMLDivElement | null) => void;
};

/** One lazily loaded page: keeps its slot sized so scrolling and the page counter stay stable. */
function PageImage({ url, index, ratio, disabled, onRatio, innerRef }: PageImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div
      ref={innerRef}
      style={{
        marginBottom: 16,
        background: "#fff",
        borderRadius: 2,
        boxShadow: "var(--mantine-shadow-sm)",
        aspectRatio: loaded || !ratio ? undefined : String(ratio),
        overflow: "hidden",
      }}
    >
      {!disabled && !failed && (
        <img
          src={url}
          alt={`${index + 1}-sahifa`}
          loading={index === 0 ? "eager" : "lazy"}
          onLoad={(e) => {
            setLoaded(true);
            const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
            if (onRatio && w && h) onRatio(w / h);
          }}
          onError={() => setFailed(true)}
          style={{ display: "block", width: "100%", height: "auto" }}
        />
      )}
      {failed && (
        <Text size="xs" c="dimmed" ta="center" p="md">
          Sahifa yuklanmadi, qayta render qiling
        </Text>
      )}
    </div>
  );
}

function ProblemText({ children }: { children: string }) {
  return (
    <Text ff="monospace" size="xs" style={{ wordBreak: "break-word" }}>
      {children}
    </Text>
  );
}
