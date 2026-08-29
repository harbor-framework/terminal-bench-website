'use client';

import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  ArrowUpDownIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type {
  Column,
  ColumnDef,
  OnChangeFn,
  VisibilityState,
} from '@tanstack/react-table';
import { useQueryState } from 'nuqs';
import { useMemo } from 'react';

import { LeaderboardSkeleton } from '@/components/leaderboard/leaderboard-skeleton';
import {
  applyLeaderboardFilters,
  buildFilterFacets,
  LeaderboardToolbar,
  type LeaderboardFilters,
} from '@/components/leaderboard/leaderboard-toolbar';
import { DataTable } from '@/components/ui/data-table';
import { ViewExportActions } from '@/components/view-export-actions';
import {
  BenchmarkSelect,
  useHomeBenchmark,
} from '@/components/leaderboard/benchmark-select';
import {
  TERMINAL_BENCH_DATASET_VERSION,
  TERMINAL_BENCH_LEADERBOARD,
  TERMINAL_BENCH_PACKAGE,
  fetchLeaderboard,
  formatLeaderboardCell,
  getAccessorValue,
  harborLeaderboardRowUrl,
  leaderboardQueryKey,
  parseLeaderboardLink,
  type LeaderboardColumn,
  type LeaderboardColumnType,
  type LeaderboardRow,
} from '@/lib/leaderboard';
import { harborJobUrl, useRowJobIds } from '@/lib/row-jobs';
import {
  fromUrlFilters,
  hiddenColumnsParser,
  leaderboardFiltersParser,
  toUrlFilters,
} from '@/lib/leaderboard-url-state';
import { cn } from '@/lib/utils';

const SORTABLE_COLUMN_IDS = new Set([
  'accuracy',
  'date',
  'release_date',
  'total_tokens',
  'total_cost_usd',
]);

function alignClass(align?: LeaderboardColumn['align']) {
  switch (align) {
    case 'center':
      return 'text-center';
    case 'right':
      return 'text-right';
    case 'left':
    case undefined:
      return 'text-left';
    default: {
      const _exhaustive: never = align;
      return _exhaustive;
    }
  }
}

function renderMarkdownInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    const match = /^\*\*([^*]+)\*\*$/.exec(part);
    if (match) {
      return <strong key={index}>{match[1]}</strong>;
    }
    return <span key={index}>{part}</span>;
  });
}

function LeaderboardCell({
  value,
  type,
}: {
  value: unknown;
  type: LeaderboardColumnType;
}) {
  if (value == null || value === '') return '—';

  switch (type) {
    case 'link': {
      const link = parseLeaderboardLink(value);
      if (!link) return formatLeaderboardCell(value, type);
      return (
        <a
          href={link.url}
          target="_blank"
          rel="noreferrer"
          className="hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          {link.label}
        </a>
      );
    }
    case 'markdown':
      return <>{renderMarkdownInline(String(value))}</>;
    case 'boolean':
    case 'number':
    case 'date':
    case 'text':
      return formatLeaderboardCell(value, type);
    default: {
      const _exhaustive: never = type;
      return String(_exhaustive);
    }
  }
}

const Z_95 = 1.96;

function AccuracyBarCell({ row }: { row: LeaderboardRow }) {
  const accuracy = getAccessorValue(row, 'metrics.accuracy');
  const stderr = getAccessorValue(row, 'metrics.accuracy_stderr');
  const ci95HalfWidth = getAccessorValue(
    row,
    'metrics.accuracy_ci95_half_width',
  );
  const display = getAccessorValue(row, 'metrics.display_accuracy');

  const value =
    typeof accuracy === 'number' && !Number.isNaN(accuracy) ? accuracy : null;
  const se =
    typeof stderr === 'number' && !Number.isNaN(stderr) ? stderr : 0;
  const half =
    typeof ci95HalfWidth === 'number' && !Number.isNaN(ci95HalfWidth)
      ? ci95HalfWidth
      : Z_95 * se;
  const ciLower = value != null ? Math.max(0, value - half) : 0;
  const ciUpper = value != null ? Math.min(100, value + half) : 0;

  if (value == null) {
    return (
      <LeaderboardCell value={display ?? accuracy} type="markdown" />
    );
  }

  return (
    <div className="flex items-center gap-3 xl:min-w-52">
      <div className="w-28 shrink-0 tabular-nums">
        <LeaderboardCell value={display ?? accuracy} type="markdown" />
      </div>
      <div className="relative hidden h-3 min-w-0 max-w-[30vw] flex-1 rounded-none bg-muted xl:block">
        <div
          className="absolute inset-y-0 left-0 bg-foreground"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
        {ciUpper > ciLower ? (
          <>
            <div
              className="absolute top-1/2 h-px -translate-y-1/2 bg-muted-foreground"
              style={{
                left: `${ciLower}%`,
                width: `${ciUpper - ciLower}%`,
              }}
            />
            <div
              className="absolute top-1/2 h-1.5 w-px -translate-x-1/2 -translate-y-1/2 bg-muted-foreground"
              style={{ left: `${ciLower}%` }}
            />
            <div
              className="absolute top-1/2 h-1.5 w-px -translate-x-1/2 -translate-y-1/2 bg-muted-foreground"
              style={{ left: `${ciUpper}%` }}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

function SortableHeader({
  column,
  label,
  align,
}: {
  column: Column<LeaderboardRow, unknown>;
  label: string;
  align?: LeaderboardColumn['align'];
}) {
  const sorted = column.getIsSorted();
  const icon =
    sorted === 'asc'
      ? ArrowUp01Icon
      : sorted === 'desc'
        ? ArrowDown01Icon
        : ArrowUpDownIcon;

  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center gap-1.5 font-medium uppercase hover:text-foreground',
        align === 'right' && 'ml-auto',
        align === 'center' && 'mx-auto',
      )}
      onClick={() => column.toggleSorting(sorted === 'asc')}
    >
      <span>{label}</span>
      <HugeiconsIcon
        icon={icon}
        strokeWidth={2}
        className="size-3.5 text-muted-foreground"
      />
    </button>
  );
}

const HIDDEN_TABLE_COLUMN_IDS = new Set(['reasoning_effort']);
const EXPORT_FILE_BASENAME = 'terminal-bench-4-leaderboard';
const LEADERBOARD_EXPORT_TARGET_ID = 'terminal-bench-leaderboard-export';

function displayColumnHeader(column: LeaderboardColumn): string {
  const label = column.id === 'accuracy' ? 'Resolution Rate' : column.header;
  return label.toUpperCase();
}

/** Prefer Model before Agent until Hub column order is updated. */
function orderLeaderboardColumns(
  columns: LeaderboardColumn[],
): LeaderboardColumn[] {
  const byId = new Map(columns.map((column) => [column.id, column]));
  if (!byId.has('agent_display') || !byId.has('model_display')) {
    return columns;
  }

  const ordered: LeaderboardColumn[] = [];
  let emittedPair = false;
  for (const column of columns) {
    if (
      column.id === 'agent_display' ||
      column.id === 'model_display'
    ) {
      if (emittedPair) continue;
      emittedPair = true;
      const model = byId.get('model_display');
      const agent = byId.get('agent_display');
      if (model) ordered.push(model);
      if (agent) ordered.push(agent);
      continue;
    }
    ordered.push(column);
  }
  return ordered;
}

type ExportColumn = {
  id: string;
  header: string;
  align: 'left' | 'right' | 'center';
  value: (row: LeaderboardRow) => string;
};

function escapeMarkdownCell(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('|', '\\|')
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

function normalizeExportValue(value: string): string {
  return value.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/[\r\n]+/g, ' ');
}

function formatExportCell(
  row: LeaderboardRow,
  column: LeaderboardColumn,
): string {
  if (column.id === 'accuracy') {
    const display = getAccessorValue(row, 'metrics.display_accuracy');
    return normalizeExportValue(
      formatLeaderboardCell(
        display ?? getAccessorValue(row, column.accessor),
        'markdown',
      ),
    );
  }

  const value = column.display_accessor
    ? getAccessorValue(row, column.display_accessor)
    : getAccessorValue(row, column.accessor);
  const formatted = formatLeaderboardCell(
    value,
    column.display_type ?? column.type,
  );

  if (column.id === 'model_display') {
    const effort = getAccessorValue(row, 'metadata.reasoning_effort');
    const effortLabel =
      typeof effort === 'string' && effort.trim() ? effort.trim() : null;
    return effortLabel ? `${formatted} (${effortLabel})` : formatted;
  }

  return normalizeExportValue(formatted);
}

function buildExportColumns(
  columns: LeaderboardColumn[],
  columnVisibility: VisibilityState,
): ExportColumn[] {
  const result: ExportColumn[] = [];

  if (columnVisibility.rank !== false) {
    result.push({
      id: 'rank',
      header: 'Rank',
      align: 'right',
      value: (row) => String(row.rank ?? '-'),
    });
  }

  for (const column of orderLeaderboardColumns(columns)) {
    if (
      HIDDEN_TABLE_COLUMN_IDS.has(column.id) ||
      columnVisibility[column.id] === false
    ) {
      continue;
    }

    // Hub configs are inconsistent across leaderboards (3.0's release_date
    // has no align); default date columns to right like TB 4.0.
    const align =
      column.id === 'accuracy'
        ? 'left'
        : (column.align ?? (column.type === 'date' ? 'right' : 'left'));
    result.push({
      id: column.id,
      header: displayColumnHeader(column),
      align,
      value: (row) => formatExportCell(row, column),
    });
  }

  return result;
}

function buildMarkdownTable(
  rows: LeaderboardRow[],
  columns: LeaderboardColumn[],
  columnVisibility: VisibilityState,
): string {
  const exportColumns = buildExportColumns(columns, columnVisibility);
  const header = exportColumns.map((column) => escapeMarkdownCell(column.header));
  const divider = exportColumns.map((column) =>
    column.align === 'right'
      ? '---:'
      : column.align === 'center'
        ? ':---:'
        : '---',
  );
  const body = rows.map((row) =>
    exportColumns.map((column) => escapeMarkdownCell(column.value(row))),
  );

  return [header, divider, ...body]
    .map((line) => `| ${line.join(' | ')} |`)
    .join('\n');
}

/** Max natural width per column across all selectable benchmarks. */
const STABLE_COLUMN_MIN_WIDTHS: Record<string, string> = {
  model_display: 'min-w-[233px]',
  agent_display: 'min-w-[224px]',
  date: 'min-w-[169px]',
  release_date: 'min-w-[169px]',
  total_tokens: 'min-w-[118px]',
  total_cost_usd: 'min-w-[124px]',
};

function buildColumns(
  columns: LeaderboardColumn[],
): ColumnDef<LeaderboardRow>[] {
  const rankColumn: ColumnDef<LeaderboardRow> = {
    id: 'rank',
    header: 'RANK',
    accessorFn: (row) => row.rank,
    cell: ({ row }) => (
      <span className="tabular-nums text-muted-foreground">
        {row.original.rank ?? '—'}
      </span>
    ),
    enableSorting: false,
    meta: {
      headerClassName: 'w-12 text-right',
      cellClassName: 'text-right',
    },
  };

  const dataColumns = orderLeaderboardColumns(columns)
    .filter((column) => !HIDDEN_TABLE_COLUMN_IDS.has(column.id))
    .map((column): ColumnDef<LeaderboardRow> => {
      const displayType = column.display_type ?? column.type;
      const columnAlign =
        column.id === 'accuracy'
          ? 'left'
          : (column.align ?? (column.type === 'date' ? 'right' : undefined));
      const align = alignClass(columnAlign);
      const sortable = SORTABLE_COLUMN_IDS.has(column.id);
      const headerLabel = displayColumnHeader(column);
      return {
        id: column.id,
        accessorFn: (row) => getAccessorValue(row, column.accessor),
        header: sortable
          ? ({ column: tableColumn }) => (
              <SortableHeader
                column={tableColumn}
                label={headerLabel}
                align={columnAlign}
              />
            )
          : headerLabel,
        cell: ({ row }) => {
          const value = column.display_accessor
            ? getAccessorValue(row.original, column.display_accessor)
            : getAccessorValue(row.original, column.accessor);

          if (column.id === 'model_display') {
            const effort = getAccessorValue(
              row.original,
              'metadata.reasoning_effort',
            );
            const effortLabel =
              typeof effort === 'string' && effort.trim()
                ? effort.trim()
                : null;
            return (
              <span className="inline-flex items-baseline gap-1">
                <LeaderboardCell value={value} type={displayType} />
                {effortLabel ? (
                  <span className="text-xs text-muted-foreground">
                    ({effortLabel})
                  </span>
                ) : null}
              </span>
            );
          }

          if (column.id === 'accuracy') {
            return <AccuracyBarCell row={row.original} />;
          }

          // Uniform units across benchmarks: tokens in billions, cost in
          // thousands of dollars, one decimal each.
          if (column.id === 'total_tokens') {
            const raw = getAccessorValue(row.original, 'metrics.total_tokens');
            return typeof raw === 'number' && raw > 0
              ? `${(raw / 1e9).toFixed(1)}B`
              : '—';
          }
          if (column.id === 'total_cost_usd') {
            const raw = getAccessorValue(
              row.original,
              'metrics.total_cost_usd',
            );
            return typeof raw === 'number' && raw > 0
              ? `$${(raw / 1000).toFixed(1)}k`
              : '—';
          }

          return <LeaderboardCell value={value} type={displayType} />;
        },
        enableSorting: sortable,
        meta: {
          headerClassName: align,
          cellClassName: cn(
            align,
            column.type === 'number' && 'tabular-nums',
            // Content columns pin to 1px (nowrap keeps them content-sized)
            // so extra table width widens the bar, not the gaps.
            column.id === 'accuracy' ? 'xl:min-w-56' : 'xl:w-px',
            column.id === 'release_date' && 'xl:pl-2',
            // Fixed min widths (max natural width across every benchmark in
            // the selector) so switching versions never shifts columns.
            STABLE_COLUMN_MIN_WIDTHS[column.id],
          ),
        },
      };
    });

  // Placeholder columns for canonical TB 4.0 columns a benchmark lacks, so
  // switching benchmarks never adds or removes columns (no layout shift).
  const presentIds = new Set(dataColumns.map((column) => column.id));
  const placeholders: ColumnDef<LeaderboardRow>[] = (
    [
      ['total_tokens', 'TOKENS'],
      ['total_cost_usd', 'COST'],
    ] as const
  )
    .filter(([id]) => !presentIds.has(id))
    .map(([id, header]) => ({
      id,
      // Keep the sort icon so headers match the sortable versions of these
      // columns and switching benchmarks causes no shift.
      header: () => (
        <span className="ml-auto inline-flex items-center gap-1.5 font-medium uppercase">
          <span>{header}</span>
          <HugeiconsIcon
            icon={ArrowUpDownIcon}
            strokeWidth={2}
            className="size-3.5 text-muted-foreground"
          />
        </span>
      ),
      accessorFn: () => null,
      cell: () => <span className="text-muted-foreground">—</span>,
      enableSorting: false,
      meta: {
        headerClassName: 'text-right',
        cellClassName: cn(
          'text-right tabular-nums xl:w-px',
          STABLE_COLUMN_MIN_WIDTHS[id],
        ),
      },
    }));

  const CANONICAL_ORDER = [
    'model_display',
    'agent_display',
    'reasoning_effort',
    'accuracy',
    'date',
    'release_date',
    'agent_org',
    'model_org',
    'pr_url',
    'reward_hacks',
    'total_tokens',
    'total_cost_usd',
  ];
  const orderIndex = (id: string | undefined) => {
    const index = CANONICAL_ORDER.indexOf(id ?? '');
    return index === -1 ? CANONICAL_ORDER.length : index;
  };
  const ordered = [...dataColumns, ...placeholders].sort(
    (a, b) => orderIndex(a.id) - orderIndex(b.id),
  );

  return [rankColumn, ...ordered];
}

export function LeaderboardTable() {
  const { benchmark } = useHomeBenchmark();

  const { data, error, isPending } = useQuery({
    queryKey: leaderboardQueryKey(benchmark.package, benchmark.leaderboard),
    queryFn: () => fetchLeaderboard(benchmark.package, benchmark.leaderboard),
    // Keep showing the previous benchmark's rows while the next one loads
    // so switching doesn't flash the skeleton or shift the layout.
    placeholderData: keepPreviousData,
  });

  const facets = useMemo(() => {
    if (!data) {
      return {
        numberBounds: {},
        dateBounds: {},
        setOptions: {},
      };
    }
    return buildFilterFacets(data.leaderboard.columns, data.rows);
  }, [data]);

  const [urlFilters, setUrlFilters] = useQueryState(
    'filters',
    leaderboardFiltersParser,
  );
  const [hiddenColumns, setHiddenColumns] = useQueryState(
    'hide',
    hiddenColumnsParser,
  );

  const filters = useMemo(
    () => fromUrlFilters(urlFilters, facets.numberBounds),
    [facets.numberBounds, urlFilters],
  );

  const columnVisibility = useMemo(() => {
    const visibility: VisibilityState = {};
    for (const id of hiddenColumns) {
      visibility[id] = false;
    }
    return visibility;
  }, [hiddenColumns]);

  function handleFiltersChange(next: LeaderboardFilters) {
    void setUrlFilters(toUrlFilters(next, facets.numberBounds));
  }

  const handleColumnVisibilityChange: OnChangeFn<VisibilityState> = (
    updater,
  ) => {
    const next =
      typeof updater === 'function' ? updater(columnVisibility) : updater;
    const hidden = Object.entries(next)
      .filter(([, visible]) => visible === false)
      .map(([id]) => id);
    // Persist [] when everything is visible so defaults don't snap back on.
    void setHiddenColumns(hidden);
  };

  const filteredRows = useMemo(() => {
    if (!data) return [];
    return applyLeaderboardFilters(
      data.rows,
      data.leaderboard.columns,
      filters,
      facets.numberBounds,
    );
  }, [data, facets.numberBounds, filters]);

  const rowIds = useMemo(
    () => (data ? data.rows.map((row) => row.id) : []),
    [data],
  );
  const jobIdByRow = useRowJobIds(rowIds);

  const tableColumns = useMemo(
    () => (data ? buildColumns(data.leaderboard.columns) : []),
    [data],
  );

  const columnOptions = useMemo(() => {
    if (!data) return [];
    return [
      { id: 'rank', label: 'RANK', canHide: true },
      ...orderLeaderboardColumns(data.leaderboard.columns)
        .filter((column) => !HIDDEN_TABLE_COLUMN_IDS.has(column.id))
        .map((column) => ({
          id: column.id,
          label: displayColumnHeader(column),
          canHide: true,
        })),
    ];
  }, [data]);

  const toolbarColumns = useMemo(() => {
    if (!data) return [];
    return data.leaderboard.columns.map((column) => ({
      ...column,
      header: displayColumnHeader(column),
    }));
  }, [data]);

  if (isPending) {
    return <LeaderboardSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="-mx-4 rounded-none border border-x-0 border-destructive/30 bg-destructive/5 px-4 py-10 text-center text-sm text-destructive md:mx-0 md:rounded-xl md:border-x">
        {error?.message ?? 'Failed to load leaderboard'}
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 text-left">
      <DataTable
        columns={tableColumns}
        data={filteredRows}
        emptyMessage="No leaderboard rows match the current filters."
        getRowId={(row) => row.id}
        getRowHref={(row) => {
          // Rows are 1-1 with Hub jobs; link straight to the job when resolved.
          const jobId = jobIdByRow[row.id];
          return jobId
            ? harborJobUrl(jobId)
            : harborLeaderboardRowUrl(
                TERMINAL_BENCH_PACKAGE,
                TERMINAL_BENCH_LEADERBOARD,
                row.id,
                TERMINAL_BENCH_DATASET_VERSION,
              );
        }}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={handleColumnVisibilityChange}
        tableContainerId={LEADERBOARD_EXPORT_TARGET_ID}
        toolbar={
          <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-1.5">
            <ViewExportActions
              targetId={LEADERBOARD_EXPORT_TARGET_ID}
              fileBaseName={EXPORT_FILE_BASENAME}
              getMarkdown={() =>
                buildMarkdownTable(
                  filteredRows,
                  data.leaderboard.columns,
                  columnVisibility,
                )
              }
            />
            <div className="flex min-w-0 items-center gap-1.5">
              <BenchmarkSelect />
              <LeaderboardToolbar
                columns={toolbarColumns}
                columnOptions={columnOptions}
              filters={filters}
              onFiltersChange={handleFiltersChange}
              numberBounds={facets.numberBounds}
              dateBounds={facets.dateBounds}
              setOptions={facets.setOptions}
              columnVisibility={columnVisibility}
              onColumnVisibilityChange={handleColumnVisibilityChange}
              />
            </div>
          </div>
        }
        footer={
          <footer className="flex h-12 items-center justify-center border-t px-6 text-center text-sm text-muted-foreground">
            Resolution rate of {benchmark.label} tasks. The whiskers span the
            95% confidence interval.
          </footer>
        }
      />
    </div>
  );
}
