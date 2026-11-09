import {
  Box,
  Center,
  Group,
  Pagination,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import {
  IconArrowDown,
  IconArrowsSort,
  IconArrowUp,
  IconInbox,
  IconSearch,
} from "@tabler/icons-react";
import { type Row, type SortingState, useTable } from "@tanstack/react-table";
import { type ReactNode, useState } from "react";
import classes from "./data-table.module.scss";
import { type DataTableColumn, dataTableFeatures } from "./features";

// Stable fallback: a new `[]` per render would invalidate TanStack's row models.
const EMPTY: never[] = [];
const DEFAULT_PAGE_SIZES = [10, 25, 50];

export type DataTableProps<TData extends object> = {
  columns: DataTableColumn<TData>[];
  data: TData[] | undefined;
  /** Stable unique id per row (recommended). */
  getRowId?: (row: TData, index: number) => string;
  isLoading?: boolean;
  error?: string | null;
  /** Global text search across string/number columns. Default: true. */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Rendered at the right side of the toolbar (e.g. a "create" button). */
  toolbar?: ReactNode;
  pageSize?: number;
  pageSizeOptions?: number[];
  initialSorting?: SortingState;
  emptyTitle?: string;
  emptyDescription?: string;
  minWidth?: number;
  onRowClick?: (row: TData) => void;
};

export function DataTable<TData extends object>({
  columns,
  data,
  getRowId,
  isLoading,
  error,
  searchable = true,
  searchPlaceholder = "Qidirish...",
  toolbar,
  pageSize = 10,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  initialSorting,
  emptyTitle = "Ma'lumot topilmadi",
  emptyDescription,
  minWidth = 720,
  onRowClick,
}: DataTableProps<TData>) {
  const [search, setSearch] = useState("");

  const table = useTable({
    features: dataTableFeatures,
    columns,
    data: data ?? EMPTY,
    getRowId,
    globalFilterFn: "includesString",
    initialState: {
      pagination: { pageIndex: 0, pageSize },
      sorting: initialSorting ?? [],
    },
  });

  const rows = table.getRowModel().rows;
  const totalRows = table.getRowCount();
  const { pageIndex, pageSize: currentPageSize } = table.state.pagination;
  const from = totalRows === 0 ? 0 : pageIndex * currentPageSize + 1;
  const to = Math.min((pageIndex + 1) * currentPageSize, totalRows);
  const showToolbar = searchable || toolbar;

  return (
    <Stack gap="md">
      {showToolbar && (
        <Group justify="space-between" wrap="wrap">
          {searchable ? (
            <TextInput
              w={{ base: "100%", sm: 320 }}
              placeholder={searchPlaceholder}
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(event) => {
                setSearch(event.currentTarget.value);
                table.setGlobalFilter(event.currentTarget.value);
              }}
              aria-label={searchPlaceholder}
            />
          ) : (
            <span />
          )}
          {toolbar}
        </Group>
      )}

      <Paper withBorder radius="md" style={{ overflow: "hidden" }}>
        <Table.ScrollContainer minWidth={minWidth}>
          <Table verticalSpacing="sm" highlightOnHover={!!onRowClick}>
            <Table.Thead>
              {table.getHeaderGroups().map((group) => (
                <Table.Tr key={group.id}>
                  {group.headers.map((header) => {
                    const meta = header.column.columnDef.meta;
                    const sorted = header.column.getIsSorted();
                    return (
                      <Table.Th
                        key={header.id}
                        ta={meta?.align}
                        w={meta?.width}
                        aria-sort={
                          sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"
                        }
                      >
                        {header.isPlaceholder ? null : header.column.getCanSort() ? (
                          <UnstyledButton
                            className={classes.sortButton}
                            data-sorted={sorted || undefined}
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            <table.FlexRender header={header} />
                            {sorted === "asc" ? (
                              <IconArrowUp size={14} className={classes.sortIcon} />
                            ) : sorted === "desc" ? (
                              <IconArrowDown size={14} className={classes.sortIcon} />
                            ) : (
                              <IconArrowsSort size={14} className={classes.sortIcon} />
                            )}
                          </UnstyledButton>
                        ) : (
                          <table.FlexRender header={header} />
                        )}
                      </Table.Th>
                    );
                  })}
                </Table.Tr>
              ))}
            </Table.Thead>

            <Table.Tbody>
              {isLoading ? (
                <SkeletonRows columns={columns.length} rows={Math.min(pageSize, 5)} />
              ) : (
                rows.map((row: Row<typeof dataTableFeatures, TData>) => (
                  <Table.Tr
                    key={row.id}
                    className={classes.row}
                    data-clickable={onRowClick ? "" : undefined}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  >
                    {row.getAllCells().map((cell) => (
                      <Table.Td key={cell.id} ta={cell.column.columnDef.meta?.align}>
                        <table.FlexRender cell={cell} />
                      </Table.Td>
                    ))}
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>

        {error && (
          <Center p="xl">
            <Text c="red" size="sm">
              {error}
            </Text>
          </Center>
        )}

        {!isLoading && !error && rows.length === 0 && (
          <Center p="xl">
            <Stack align="center" gap={4}>
              <IconInbox size={32} stroke={1.4} color="var(--mantine-color-dimmed)" />
              <Text fw={600}>{emptyTitle}</Text>
              {emptyDescription && (
                <Text c="dimmed" size="sm">
                  {emptyDescription}
                </Text>
              )}
            </Stack>
          </Center>
        )}

        {!isLoading && !error && totalRows > 0 && (
          <Box
            p="sm"
            px="md"
            style={{ borderTop: "1px solid var(--app-border)", background: "var(--app-subtle)" }}
          >
            <Group justify="space-between" wrap="wrap" gap="sm">
              <Group gap="sm">
                <Text size="sm" c="dimmed">
                  {from}–{to} / {totalRows}
                </Text>
                <Select
                  size="xs"
                  w={96}
                  allowDeselect={false}
                  aria-label="Sahifadagi qatorlar soni"
                  data={pageSizeOptions.map((n) => ({ value: String(n), label: `${n} ta` }))}
                  value={String(currentPageSize)}
                  onChange={(value) => value && table.setPageSize(Number(value))}
                />
              </Group>
              {table.getPageCount() > 1 && (
                <Pagination
                  size="sm"
                  total={table.getPageCount()}
                  value={pageIndex + 1}
                  onChange={(page) => table.setPageIndex(page - 1)}
                  withEdges
                />
              )}
            </Group>
          </Box>
        )}
      </Paper>
    </Stack>
  );
}

function SkeletonRows({ columns, rows }: { columns: number; rows: number }) {
  return Array.from({ length: rows }, (_, r) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
    <Table.Tr key={r}>
      {Array.from({ length: columns }, (_, c) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder cells
        <Table.Td key={c}>
          <Skeleton h={18} />
        </Table.Td>
      ))}
    </Table.Tr>
  ));
}
