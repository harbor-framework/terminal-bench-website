'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import { useMemo, useRef, useState } from 'react';

import { chartRowLabel } from '@/components/charts/chart-labels';
import { HomeViewToggle } from '@/components/home-view-toggle';
import {
  BenchmarkSelect,
  useHomeBenchmark,
} from '@/components/leaderboard/benchmark-select';
import { LeaderboardToolbar } from '@/components/leaderboard/leaderboard-toolbar';
import { useLeaderboardFilters } from '@/components/leaderboard/use-leaderboard-filters';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ViewExportActions } from '@/components/view-export-actions';
import {
  TERMINAL_BENCH_LEADERBOARD,
  TERMINAL_BENCH_PACKAGE,
  fetchLeaderboard,
  leaderboardQueryKey,
  type LeaderboardRow,
} from '@/lib/leaderboard';
import type { WafflePayload, WaffleTrial } from '@/lib/waffle';

const WAFFLE_EXPORT_TARGET_ID = 'terminal-bench-waffle-export';
const WAFFLE_EXPORT_FILE_BASENAME = 'terminal-bench-4-waffle';

const ROW_MODES = ['task', 'domain'] as const;
type RowMode = (typeof ROW_MODES)[number];
const parseRowMode = parseAsStringLiteral(ROW_MODES);

const GROUP_MODES = ['model', 'outcome'] as const;
type GroupMode = (typeof GROUP_MODES)[number];
const parseGroupMode = parseAsStringLiteral(GROUP_MODES);

type TooltipState = {
  task: string;
  trial: WaffleTrial;
  left: number;
  top: number;
};

const OUTCOME_CELL_CLASS: Record<WaffleTrial['o'], string> = {
  p: 'fill-foreground',
  to: 'fill-foreground/55',
  err: 'fill-foreground/30',
  f: 'fill-foreground/12',
};

const OUTCOME_SWATCH_CLASS: Record<WaffleTrial['o'], string> = {
  p: 'bg-foreground',
  to: 'bg-foreground/55',
  err: 'bg-foreground/30',
  f: 'bg-foreground/12',
};

const OUTCOME_WORD: Record<WaffleTrial['o'], string> = {
  p: 'pass',
  to: 'timeout',
  err: 'error',
  f: 'fail',
};

const OUTCOME_RANK: Record<WaffleTrial['o'], number> = {
  p: 0,
  to: 1,
  err: 2,
  f: 3,
};

const LEGEND_OUTCOMES = ['p', 'to', 'err', 'f'] as const;

async function fetchWaffleData(benchmarkId: string): Promise<WafflePayload> {
  const response = await fetch(
    `/api/waffle?benchmark=${encodeURIComponent(benchmarkId)}`,
  );
  const payload = (await response.json()) as
    | WafflePayload
    | { error?: { message?: string } };

  if (!response.ok) {
    throw new Error(
      'error' in payload && payload.error?.message
        ? payload.error.message
        : `Failed to load waffle data (${response.status})`,
    );
  }

  return payload as WafflePayload;
}

function trialUrl(trial: WaffleTrial): string | null {
  if (trial.j && trial.id) {
    return `https://hub.harborframework.com/jobs/${encodeURIComponent(trial.j)}/trials/${encodeURIComponent(trial.id)}`;
  }
  return null;
}

function taskPageUrl(task: string): string {
  return `https://hub.harborframework.com/tasks/terminal-bench/${encodeURIComponent(task)}`;
}

function escapeMarkdownCell(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('|', '\\|')
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

function buildWaffleMarkdownTable(data: WafflePayload): string {
  const header = [
    'Domain',
    'Task',
    'Pass',
    'Timeout',
    'Error',
    'Fail',
    'Solve',
  ];
  const divider = ['---', '---', '---:', '---:', '---:', '---:', '---:'];
  const body = data.doms.flatMap((domain) =>
    domain.tasks.map((task) => [
      domain.name,
      task.task,
      String(task.p),
      String(task.e_to),
      String(task.e_err),
      String(task.f),
      `${task.solve}%`,
    ]),
  );

  return [header, divider, ...body]
    .map((line) => `| ${line.map(escapeMarkdownCell).join(' | ')} |`)
    .join('\n');
}

function rowIdentity(row: LeaderboardRow): string {
  const label = chartRowLabel(row);
  return [label.model, label.agent].filter(Boolean).join(' / ');
}

type MatrixColumn = {
  identity: string;
  model: string;
  agent: string;
  jobId: string | null;
};

type MatrixSlot = {
  task: string;
  trial: WaffleTrial;
};

type MatrixTaskRow = {
  task: string;
  solve: number;
  cells: MatrixSlot[][];
};

type MatrixDomainRow = {
  name: string;
  solve: number;
  taskCount: number;
  cells: MatrixSlot[][];
};

type Matrix = {
  columns: MatrixColumn[];
  maxReps: number;
  tasks: MatrixTaskRow[];
  domains: MatrixDomainRow[];
};

function buildMatrix(
  data: WafflePayload,
  filteredRows: LeaderboardRow[],
): Matrix {
  const allTrials = data.doms.flatMap((domain) =>
    domain.tasks.flatMap((task) => task.ts),
  );

  let identities: { identity: string; model: string; agent: string }[];
  if (filteredRows.length > 0) {
    identities = filteredRows.map((row) => {
      const label = chartRowLabel(row);
      return { identity: rowIdentity(row), model: label.model, agent: label.agent };
    });
  } else {
    const seen = new Set<string>();
    identities = [];
    for (const trial of allTrials) {
      if (seen.has(trial.m)) continue;
      seen.add(trial.m);
      const [model = trial.m, agent = ''] = trial.m.split(' / ');
      identities.push({ identity: trial.m, model, agent });
    }
  }

  const jobByIdentity = new Map<string, string>();
  for (const trial of allTrials) {
    if (trial.j && !jobByIdentity.has(trial.m)) {
      jobByIdentity.set(trial.m, trial.j);
    }
  }

  const columns: MatrixColumn[] = identities.map((entry) => ({
    identity: entry.identity,
    model: entry.model,
    agent: entry.agent,
    jobId: jobByIdentity.get(entry.identity) ?? null,
  }));

  const columnIndex = new Map(
    columns.map((column, index) => [column.identity, index] as const),
  );

  let maxReps = 1;
  const tasks: MatrixTaskRow[] = [];
  const domains: MatrixDomainRow[] = [];

  for (const domain of data.doms) {
    const domainCells: MatrixSlot[][] = columns.map(() => []);
    let domainPass = 0;
    let domainTotal = 0;

    for (const task of domain.tasks) {
      const cells: MatrixSlot[][] = columns.map(() => []);
      let pass = 0;
      let total = 0;
      for (const trial of task.ts) {
        const index = columnIndex.get(trial.m);
        if (index == null) continue;
        cells[index]!.push({ task: task.task, trial });
        domainCells[index]!.push({ task: task.task, trial });
        total += 1;
        if (trial.o === 'p') pass += 1;
      }
      for (const cell of cells) {
        cell.sort((a, b) => OUTCOME_RANK[a.trial.o] - OUTCOME_RANK[b.trial.o]);
        maxReps = Math.max(maxReps, cell.length);
      }
      domainPass += pass;
      domainTotal += total;
      tasks.push({
        task: task.task,
        solve: total > 0 ? Math.round((100 * pass) / total) : 0,
        cells,
      });
    }

    for (const cell of domainCells) {
      cell.sort((a, b) => OUTCOME_RANK[a.trial.o] - OUTCOME_RANK[b.trial.o]);
    }
    domains.push({
      name: domain.name,
      solve:
        domainTotal > 0 ? Math.round((100 * domainPass) / domainTotal) : 0,
      taskCount: domain.tasks.length,
      cells: domainCells,
    });
  }

  tasks.sort((a, b) => b.solve - a.solve || a.task.localeCompare(b.task));
  domains.sort(
    (a, b) => b.taskCount - a.taskCount || a.name.localeCompare(b.name),
  );

  return { columns, maxReps, tasks, domains };
}

function MatrixCell({
  slots,
  x,
  y,
  sw,
  sh,
  sgap,
  wrap,
  pitchY,
  activeTrialId,
  onTrialMove,
  onTrialLeave,
}: {
  slots: MatrixSlot[];
  x: number;
  y: number;
  sw: number;
  sh: number;
  sgap: number;
  /** Squares per row before wrapping (task mode never wraps). */
  wrap: number;
  pitchY: number;
  activeTrialId: string | null;
  onTrialMove: (
    event: React.MouseEvent<SVGElement>,
    task: string,
    trial: WaffleTrial,
  ) => void;
  onTrialLeave: () => void;
}) {
  return slots.map((slot, index) => {
    const col = index % wrap;
    const row = (index - col) / wrap;
    const href = trialUrl(slot.trial);
    const rect = (
      <rect
        x={x + col * (sw + sgap)}
        y={y + row * pitchY}
        width={sw}
        height={sh}
        rx={1}
        className={`${OUTCOME_CELL_CLASS[slot.trial.o]} ${
          activeTrialId != null && activeTrialId === slot.trial.id
            ? 'stroke-foreground'
            : 'stroke-transparent'
        }`}
        strokeWidth={0.9}
        shapeRendering="crispEdges"
        onMouseMove={(event) => onTrialMove(event, slot.task, slot.trial)}
        onMouseLeave={onTrialLeave}
      />
    );
    const key = slot.trial.id || `${slot.task}-${index}`;
    if (!href) return <g key={key}>{rect}</g>;
    return (
      <a
        key={key}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="cursor-pointer"
      >
        {rect}
      </a>
    );
  });
}

function WaffleSvg({
  matrix,
  mode,
  group,
  tooltip,
  onTrialMove,
  onTrialLeave,
}: {
  matrix: Matrix;
  mode: RowMode;
  group: GroupMode;
  tooltip: TooltipState | null;
  onTrialMove: (
    event: React.MouseEvent<SVGElement>,
    task: string,
    trial: WaffleTrial,
  ) => void;
  onTrialLeave: () => void;
}) {
  // Fixed pixel geometry: the SVG renders 1:1 (no viewBox stretch) so squares
  // and text stay the same size as the pareto chart's at any viewport width.
  const SW = 12;
  const SGAP = 2.5;
  const SH = 12;
  const VGAP = 2.5;
  // Wide enough that the longest one-line model header clears its neighbors.
  const MG = 18;
  const maxReps = Math.max(1, matrix.maxReps);
  const blockW = maxReps * SW + (maxReps - 1) * SGAP;
  const stepM = blockW + MG;
  const GUT = 210;
  // Mirror the label gutter on the right so mx-auto centers the columns
  // themselves, not the gutter-plus-columns block.
  const RPAD = GUT;
  // Same header height in both groupings so toggling model/outcome causes
  // no vertical layout shift; outcome mode just leaves the space empty.
  const HEAD = 48;
  const plotW = Math.max(1, matrix.columns.length) * stepM - MG;
  const width = GUT + plotW + RPAD;
  const RH = 20;
  const pitchY = SH + VGAP;
  const domGap = 24;

  // Match the pareto chart's text sizes (11px labels, 12px headings).
  const fontSm = 11;
  const fontMd = 12;

  // Outcome mode merges every model's trials into one gap-free run per row.
  const perLine = Math.max(1, Math.floor((plotW + SGAP) / (SW + SGAP)));

  const activeTrialId = tooltip?.trial.id ?? null;
  const elements: React.ReactNode[] = [];

  const mergedSlots = (cells: MatrixSlot[][]) =>
    cells
      .flat()
      .sort((a, b) => OUTCOME_RANK[a.trial.o] - OUTCOME_RANK[b.trial.o]);

  // Truncate header lines to the column block width (no ellipsis).
  const headerChars = Math.max(1, Math.floor(blockW / (fontSm * 0.6)));
  const truncate = (value: string) => value.slice(0, headerChars).trimEnd();

  if (group === 'model') matrix.columns.forEach((column, index) => {
    const cx = GUT + index * stepM + blockW / 2;
    const label = (
      <text
        x={cx}
        y={HEAD - 26}
        textAnchor="middle"
        fontSize={fontSm}
        className="fill-foreground"
      >
        {truncate(column.model)}
        {column.agent ? (
          <tspan
            x={cx}
            dy={14}
            className="fill-muted-foreground"
          >
            {truncate(column.agent)}
          </tspan>
        ) : null}
      </text>
    );
    elements.push(
      column.jobId ? (
        <a
          key={`head-${column.identity}`}
          href={`https://hub.harborframework.com/jobs/${encodeURIComponent(column.jobId)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="cursor-pointer hover:underline"
        >
          {label}
        </a>
      ) : (
        <g key={`head-${column.identity}`}>{label}</g>
      ),
    );
  });

  let height: number;

  if (mode === 'task') {
    let y = HEAD;
    matrix.tasks.forEach((task) => {
      const merged = group === 'outcome' ? mergedSlots(task.cells) : null;
      const rowLines = merged ? Math.max(1, Math.ceil(merged.length / perLine)) : 1;
      const blockH = Math.max(RH, rowLines * pitchY);
      const sy = y + (blockH - (rowLines * pitchY - VGAP)) / 2;
      elements.push(
        <a
          key={`label-${task.task}`}
          href={taskPageUrl(task.task)}
          target="_blank"
          rel="noopener noreferrer"
          className="cursor-pointer hover:underline"
        >
          <text
            x={GUT - 10}
            y={y + blockH / 2 + 3}
            textAnchor="end"
            fontSize={fontSm}
            className="fill-muted-foreground"
          >
            {task.task}
          </text>
        </a>,
      );
      if (merged) {
        elements.push(
          <g key={`cell-${task.task}-merged`}>
            <MatrixCell
              slots={merged}
              x={GUT}
              y={sy}
              sw={SW}
              sh={SH}
              sgap={SGAP}
              wrap={perLine}
              pitchY={pitchY}
              activeTrialId={activeTrialId}
              onTrialMove={onTrialMove}
              onTrialLeave={onTrialLeave}
            />
          </g>,
        );
      } else {
        task.cells.forEach((slots, columnIndex) => {
          elements.push(
            <g key={`cell-${task.task}-${columnIndex}`}>
              <MatrixCell
                slots={slots}
                x={GUT + columnIndex * stepM}
                y={sy}
                sw={SW}
                sh={SH}
                sgap={SGAP}
                wrap={maxReps}
                pitchY={pitchY}
                activeTrialId={activeTrialId}
                onTrialMove={onTrialMove}
                onTrialLeave={onTrialLeave}
              />
            </g>,
          );
        });
      }
      y += blockH;
    });
    height = y + 10;
  } else {
    let y = HEAD;
    for (const domain of matrix.domains) {
      const merged = group === 'outcome' ? mergedSlots(domain.cells) : null;
      const rows = merged
        ? Math.max(1, Math.ceil(merged.length / perLine))
        : Math.max(
            ...domain.cells.map((slots) => Math.ceil(slots.length / maxReps)),
            domain.taskCount,
            1,
          );
      const blockH = rows * pitchY;
      const midY = y + blockH / 2;
      elements.push(
        <text
          key={`dname-${domain.name}`}
          x={GUT - 10}
          y={midY - 2}
          textAnchor="end"
          fontSize={fontMd}
          className="fill-foreground font-medium"
        >
          {domain.name.toUpperCase()}
        </text>,
        <text
          key={`dsub-${domain.name}`}
          x={GUT - 10}
          y={midY + 13}
          textAnchor="end"
          fontSize={fontSm}
          className="fill-muted-foreground"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {domain.solve}%
        </text>,
      );
      if (merged) {
        elements.push(
          <g key={`dcell-${domain.name}-merged`}>
            <MatrixCell
              slots={merged}
              x={GUT}
              y={y}
              sw={SW}
              sh={SH}
              sgap={SGAP}
              wrap={perLine}
              pitchY={pitchY}
              activeTrialId={activeTrialId}
              onTrialMove={onTrialMove}
              onTrialLeave={onTrialLeave}
            />
          </g>,
        );
      } else {
        domain.cells.forEach((slots, columnIndex) => {
          elements.push(
            <g key={`dcell-${domain.name}-${columnIndex}`}>
              <MatrixCell
                slots={slots}
                x={GUT + columnIndex * stepM}
                y={y}
                sw={SW}
                sh={SH}
                sgap={SGAP}
                wrap={maxReps}
                pitchY={pitchY}
                activeTrialId={activeTrialId}
                onTrialMove={onTrialMove}
                onTrialLeave={onTrialLeave}
              />
            </g>,
          );
        });
      }
      y += blockH + domGap;
    }
    height = y + 10 - domGap + domGap;
  }

  return (
    <svg
      role="img"
      aria-label="Per-trial result matrix, grouped by task or by domain"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="mx-auto block"
    >
      {elements}
    </svg>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 border-t px-4 py-3 text-xs text-muted-foreground">
      {LEGEND_OUTCOMES.map((outcome) => (
        <span key={outcome} className="inline-flex items-center gap-1.5">
          <span
            className={`inline-block size-2.5 rounded-[2px] border border-border ${OUTCOME_SWATCH_CLASS[outcome]}`}
          />
          {OUTCOME_WORD[outcome]}
        </span>
      ))}
      <span>each square is one trial - click to view</span>
    </div>
  );
}

function Tooltip({
  tooltip,
  refObject,
}: {
  tooltip: TooltipState | null;
  refObject: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={refObject}
      className="pointer-events-none fixed z-50 whitespace-nowrap rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md transition-opacity duration-75"
      style={{
        opacity: tooltip ? 1 : 0,
        left: tooltip?.left ?? 0,
        top: tooltip?.top ?? 0,
      }}
    >
      {tooltip ? (
        <>
          <div className="font-medium">{tooltip.task}</div>
          <div className="text-muted-foreground">{tooltip.trial.m}</div>
          <div>
            {OUTCOME_WORD[tooltip.trial.o]}
            {tooltip.trial.e ? (
              <span className="text-muted-foreground">
                {' '}
                - {tooltip.trial.e}
              </span>
            ) : null}
          </div>
          <div className="text-muted-foreground">click to view trial</div>
        </>
      ) : null}
    </div>
  );
}

export function TaskWaffleView() {
  const [mode, setMode] = useQueryState(
    'rows',
    parseRowMode.withDefault('task'),
  );
  const [group, setGroup] = useQueryState(
    'group',
    parseGroupMode.withDefault('model'),
  );
  const { benchmark } = useHomeBenchmark();

  const { data, error, isPending } = useQuery({
    queryKey: ['waffle', 'terminal-bench', benchmark.id],
    queryFn: () => fetchWaffleData(benchmark.id),
    placeholderData: keepPreviousData,
  });
  const { data: leaderboardData } = useQuery({
    queryKey: leaderboardQueryKey(benchmark.package, benchmark.leaderboard),
    queryFn: () => fetchLeaderboard(benchmark.package, benchmark.leaderboard),
    placeholderData: keepPreviousData,
  });
  const { facets, filters, handleFiltersChange, filteredRows, toolbarColumns } =
    useLeaderboardFilters(leaderboardData);

  const matrix = useMemo(
    () => (data ? buildMatrix(data, filteredRows) : null),
    [data, filteredRows],
  );

  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  function moveTooltip(
    event: React.MouseEvent<SVGElement>,
    task: string,
    trial: WaffleTrial,
  ) {
    const pad = 14;
    const rect = tooltipRef.current?.getBoundingClientRect();
    const width = rect?.width ?? 260;
    const height = rect?.height ?? 54;
    let left = event.clientX + pad;
    let top = event.clientY + pad;

    if (left + width > window.innerWidth - 8) {
      left = event.clientX - width - pad;
    }
    if (top + height > window.innerHeight - 8) {
      top = event.clientY - height - pad;
    }

    setTooltip({ task, trial, left, top });
  }

  if (isPending) {
    return (
      <div className="flex w-full min-w-0 flex-col gap-1.5">
        <div className="flex items-center justify-between gap-1.5">
          <ViewExportActions
            targetId={WAFFLE_EXPORT_TARGET_ID}
            fileBaseName={WAFFLE_EXPORT_FILE_BASENAME}
            getMarkdown={() => ''}
            disabled
          />
          <HomeViewToggle />
        </div>
        <div className="-mx-4 flex min-h-[560px] items-center justify-center rounded-none border border-x-0 px-4 py-10 text-center text-sm text-muted-foreground md:mx-0 md:rounded-xl md:border-x">
          Loading trials…
        </div>
      </div>
    );
  }

  if (error || !data || !matrix) {
    return (
      <div className="flex w-full min-w-0 flex-col gap-1.5">
        <div className="flex items-center justify-between gap-1.5">
          <ViewExportActions
            targetId={WAFFLE_EXPORT_TARGET_ID}
            fileBaseName={WAFFLE_EXPORT_FILE_BASENAME}
            getMarkdown={() => ''}
            disabled
          />
          <HomeViewToggle />
        </div>
        <div className="-mx-4 flex min-h-[560px] items-center justify-center rounded-none border border-x-0 border-destructive/30 bg-destructive/5 px-4 py-10 text-center text-sm text-destructive md:mx-0 md:rounded-xl md:border-x">
          {error instanceof Error
            ? error.message
            : 'No trials available to render.'}
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-1.5">
      <div className="flex items-center justify-between gap-1.5">
        <ViewExportActions
          targetId={WAFFLE_EXPORT_TARGET_ID}
          fileBaseName={WAFFLE_EXPORT_FILE_BASENAME}
          getMarkdown={() => buildWaffleMarkdownTable(data)}
        />
        <div className="flex min-w-0 items-center gap-1.5">
          <BenchmarkSelect />
          <LeaderboardToolbar
            columns={toolbarColumns}
            columnOptions={[]}
            filters={filters}
            onFiltersChange={handleFiltersChange}
            numberBounds={facets.numberBounds}
            dateBounds={facets.dateBounds}
            setOptions={facets.setOptions}
            columnVisibility={{}}
            onColumnVisibilityChange={() => {}}
          />
        </div>
      </div>
      <div
        id={WAFFLE_EXPORT_TARGET_ID}
        className="-mx-4 min-w-0 overflow-hidden rounded-none border border-x-0 bg-card md:mx-0 md:rounded-xl md:border-x"
      >
        <div className="flex h-12 flex-wrap items-center gap-2 border-b px-6 uppercase">
          <span className="text-sm font-medium text-foreground">Trials by</span>
          <Select
            value={mode}
            onValueChange={(next) => {
              if (next === 'task' || next === 'domain') void setMode(next);
            }}
          >
            <SelectTrigger
              size="sm"
              className="min-w-28 bg-background uppercase dark:bg-card"
            >
              <SelectValue>{mode === 'task' ? 'Task' : 'Domain'}</SelectValue>
            </SelectTrigger>
            <SelectContent align="start">
              <SelectItem value="task" className="uppercase">
                Task
              </SelectItem>
              <SelectItem value="domain" className="uppercase">
                Domain
              </SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm font-medium text-foreground">and</span>
          <Select
            value={group}
            onValueChange={(next) => {
              if (next === 'model' || next === 'outcome') void setGroup(next);
            }}
          >
            <SelectTrigger
              size="sm"
              className="min-w-28 bg-background uppercase dark:bg-card"
            >
              <SelectValue>
                {group === 'model' ? 'Model' : 'Outcome'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent align="start">
              <SelectItem value="model" className="uppercase">
                Model
              </SelectItem>
              <SelectItem value="outcome" className="uppercase">
                Outcome
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        {data.doms.length > 0 ? (
          <>
            <div className="overflow-x-auto px-4 py-3">
              <WaffleSvg
                matrix={matrix}
                mode={mode}
                group={group}
                tooltip={tooltip}
                onTrialMove={moveTooltip}
                onTrialLeave={() => setTooltip(null)}
              />
            </div>
            <Legend />
          </>
        ) : (
          <div className="flex min-h-[420px] items-center justify-center px-6 py-10 text-center text-sm text-muted-foreground">
            Per-trial data unavailable
          </div>
        )}
      </div>
      <Tooltip tooltip={tooltip} refObject={tooltipRef} />
    </div>
  );
}
