import { Button, Group, Select } from "@mantine/core";
import { IconFilterOff } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { GENERATION_STATUS_META } from "@/entities/generation";
import { GenerateDocumentButton } from "@/features/generations/generate-document";
import { trpc } from "@/shared/api";
import { DataTable } from "@/shared/ui";
import {
  applyFilters,
  FAILED,
  type GenerationFilters,
  hasFilters,
  NO_FILTERS,
  PERIOD_OPTIONS,
  SOURCE_OPTIONS,
} from "../model/filters";
import { useGenerationsColumns } from "../model/use-generations-columns";

const POLL_MS = 3000;

const STATUS_OPTIONS = [
  { value: FAILED, label: "Barcha xatolar" },
  ...Object.entries(GENERATION_STATUS_META).map(([value, meta]) => ({ value, label: meta.label })),
];

/** Project generation log; refreshes while something is still rendering. */
export function GenerationsTable({ projectId }: { projectId: string }) {
  const templates = useQuery(trpc.templates.list.queryOptions({ projectId }));
  const names = useMemo(
    () => new Map((templates.data ?? []).map((t) => [t.id, t.name])),
    [templates.data],
  );
  const templateOptions = useMemo(
    () => (templates.data ?? []).map((t) => ({ value: t.id, label: t.name })),
    [templates.data],
  );
  const columns = useGenerationsColumns(names);
  const { data, isPending, error } = useQuery({
    ...trpc.generations.list.queryOptions({ projectId }),
    refetchInterval: (query) =>
      query.state.data?.some((g) => g.status === "queued" || g.status === "processing")
        ? POLL_MS
        : false,
  });

  const [filters, setFilters] = useState<GenerationFilters>(NO_FILTERS);
  const set = (key: keyof GenerationFilters) => (value: string | null) =>
    setFilters((prev) => ({ ...prev, [key]: value }));
  const filtered = useMemo(() => (data ? applyFilters(data, filters) : data), [data, filters]);
  const active = hasFilters(filters);

  const filterSelect = (
    key: keyof GenerationFilters,
    placeholder: string,
    options: { value: string; label: string }[],
    width: number,
  ) => (
    <Select
      aria-label={placeholder}
      placeholder={placeholder}
      data={options}
      value={filters[key]}
      onChange={set(key)}
      clearable
      w={width}
    />
  );

  return (
    <DataTable
      columns={columns}
      data={filtered}
      getRowId={(g) => g.id}
      isLoading={isPending}
      error={error?.message}
      toolbar={
        <Group gap="xs" wrap="wrap">
          {filterSelect("status", "Holati", STATUS_OPTIONS, 150)}
          {filterSelect("templateId", "Shablon", templateOptions, 160)}
          {filterSelect("source", "Manba", SOURCE_OPTIONS, 110)}
          {filterSelect("period", "Davr", PERIOD_OPTIONS, 150)}
          <GenerateDocumentButton projectId={projectId} />
        </Group>
      }
      searchPlaceholder="Shablon yoki manba bo'yicha qidirish..."
      emptyTitle={active ? "Filtrga mos hujjat topilmadi" : "Hozircha hujjat yaratilmagan"}
      emptyDescription={
        active
          ? "Filtrlarni o'zgartiring yoki tozalang"
          : "API yoki sinov orqali yaratilgan hujjatlar shu yerda ko'rinadi"
      }
      emptyAction={
        active ? (
          <Button
            variant="default"
            leftSection={<IconFilterOff size={16} />}
            onClick={() => setFilters(NO_FILTERS)}
          >
            Filtrlarni tozalash
          </Button>
        ) : undefined
      }
      initialSorting={[{ id: "queuedAt", desc: true }]}
    />
  );
}
