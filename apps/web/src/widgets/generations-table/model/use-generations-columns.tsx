import { ActionIcon, Badge, Text, Tooltip } from "@mantine/core";
import { IconDownload } from "@tabler/icons-react";
import { useMemo } from "react";
import {
  GENERATION_STATUS_META,
  type GenerationItem,
  getGenerationError,
} from "@/entities/generation";
import { formatDate } from "@/shared/lib";
import { createDataTableColumns } from "@/shared/ui";

const col = createDataTableColumns<GenerationItem>();

const formatBytes = (n: number | null) =>
  n === null
    ? "—"
    : n < 1024 * 1024
      ? `${Math.max(1, Math.round(n / 1024))} KB`
      : `${(n / 1024 / 1024).toFixed(1)} MB`;

const formatDuration = (ms: number | null) =>
  ms === null ? "—" : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;

export function useGenerationsColumns(templateNames: Map<string, string>) {
  return useMemo(
    () => [
      col.accessor((row) => row.queuedAt.getTime(), {
        id: "queuedAt",
        header: "Vaqt",
        sortFn: "basic",
        enableGlobalFilter: false,
        cell: ({ row }) => (
          <Text size="sm" c="dimmed">
            {formatDate(row.original.queuedAt)}
          </Text>
        ),
      }),
      col.accessor((row) => templateNames.get(row.templateId) ?? "—", {
        id: "template",
        header: "Shablon",
        cell: ({ getValue }) => <Text size="sm">{getValue()}</Text>,
      }),
      col.accessor((row) => (row.source === "api" ? "API" : "UI"), {
        id: "source",
        header: "Manba",
        cell: ({ getValue }) => (
          <Badge variant="light" color="gray">
            {getValue()}
          </Badge>
        ),
      }),
      col.accessor("status", {
        header: "Holati",
        enableGlobalFilter: false,
        cell: ({ row }) => {
          const meta = GENERATION_STATUS_META[row.original.status];
          const reason = getGenerationError(row.original);
          const badge = (
            <Badge variant="dot" color={meta.color}>
              {meta.label}
            </Badge>
          );
          return reason ? (
            <Tooltip label={reason} multiline maw={360}>
              {badge}
            </Tooltip>
          ) : (
            badge
          );
        },
      }),
      col.accessor((row) => row.pages ?? 0, {
        id: "pages",
        header: "Sahifa",
        sortFn: "basic",
        enableGlobalFilter: false,
        cell: ({ row }) => <Text size="sm">{row.original.pages ?? "—"}</Text>,
      }),
      col.accessor((row) => row.bytes ?? 0, {
        id: "bytes",
        header: "Hajm",
        sortFn: "basic",
        enableGlobalFilter: false,
        cell: ({ row }) => <Text size="sm">{formatBytes(row.original.bytes)}</Text>,
      }),
      col.accessor((row) => row.durationMs ?? 0, {
        id: "duration",
        header: "Davomiyligi",
        sortFn: "basic",
        enableGlobalFilter: false,
        cell: ({ row }) => <Text size="sm">{formatDuration(row.original.durationMs)}</Text>,
      }),
      col.display({
        id: "actions",
        header: "",
        enableSorting: false,
        meta: { align: "right", width: 60 },
        cell: ({ row }) =>
          row.original.status === "ok" && (
            <Tooltip label="PDF yuklab olish">
              <ActionIcon
                variant="subtle"
                component="a"
                href={`/api/generations/${row.original.id}/file`}
                download
                aria-label="PDF yuklab olish"
              >
                <IconDownload size={16} />
              </ActionIcon>
            </Tooltip>
          ),
      }),
    ],
    [templateNames],
  );
}
