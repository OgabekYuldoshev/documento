import {
  type ColumnDef,
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
} from "@tanstack/react-table";

export type DataTableColumnMeta = {
  /** Cell/header text alignment. Default: "left". */
  align?: "left" | "center" | "right";
  /** Fixed column width (CSS value), e.g. 120 or "20%". */
  width?: number | string;
};

/**
 * Client-side sorting + global search + pagination. Stable module-level object:
 * TanStack Table v9 requires `features` to keep a constant identity.
 */
export const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  globalFilteringFeature,
  rowPaginationFeature,
  sortedRowModel: createSortedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
  filterFns: { includesString: filterFn_includesString },
  columnMeta: {} as DataTableColumnMeta,
});

export type DataTableFeatures = typeof dataTableFeatures;

/** Typed column helper for any row type: `const helper = createDataTableColumns<User>()`. */
export const createDataTableColumns = <TData extends object>() =>
  createColumnHelper<DataTableFeatures, TData>();

// biome-ignore lint/suspicious/noExplicitAny: column value types differ per column
export type DataTableColumn<TData extends object> = ColumnDef<DataTableFeatures, TData, any>;
