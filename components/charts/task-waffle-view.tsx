"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { chartRowLabel } from "@/components/charts/chart-labels";
import { HomeViewToggle } from "@/components/home-view-toggle";
import {
  BenchmarkSelect,
  useHomeBenchmark,
} from "@/components/leaderboard/benchmark-select";
import { LeaderboardToolbar } from "@/components/leaderboard/leaderboard-toolbar";
import { useLeaderboardFilters } from "@/components/leaderboard/use-leaderboard-filters";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ViewExportActions } from "@/components/view-export-actions";
import {
  TERMINAL_BENCH_LEADERBOARD,
  TERMINAL_BENCH_PACKAGE,
  fetchLeaderboard,
  leaderboardQueryKey,
  type LeaderboardRow,
} from "@/lib/leaderboard";
import type { WafflePayload, WaffleTrial } from "@/lib/waffle";

const WAFFLE_EXPORT_TARGET_ID = "terminal-bench-waffle-export";

const ROW_MODES = ["task", "domain", "all"] as const;
type RowMode = (typeof ROW_MODES)[number];
const parseRowMode = parseAsStringLiteral(ROW_MODES);

const GROUP_MODES = ["model", "outcome"] as const;
type GroupMode = (typeof GROUP_MODES)[number];
const parseGroupMode = parseAsStringLiteral(GROUP_MODES);

type TooltipState = {
  task: string;
  trial: WaffleTrial;
  /** Anchor (cursor) in scroll-container coordinates. */
  x: number;
  y: number;
  /** Hovered square's box in scroll-container coordinates. */
  hx: number;
  hy: number;
  hw: number;
  hh: number;
};

const OUTCOME_CELL_CLASS: Record<WaffleTrial["o"], string> = {
  p: "fill-foreground",
  to: "fill-[#f2872e]",
  err: "fill-[#e5484d]",
  f: "fill-foreground/12",
};

const OUTCOME_SWATCH_CLASS: Record<WaffleTrial["o"], string> = {
  p: "bg-foreground",
  to: "bg-[#f2872e]",
  err: "bg-[#e5484d]",
  f: "bg-foreground/12",
};

const OUTCOME_WORD: Record<WaffleTrial["o"], string> = {
  p: "pass",
  to: "timeout",
  err: "error",
  f: "fail",
};

const OUTCOME_RANK: Record<WaffleTrial["o"], number> = {
  p: 0,
  to: 1,
  err: 2,
  f: 3,
};

const LEGEND_OUTCOMES = ["p", "to", "err", "f"] as const;

async function fetchWaffleData(benchmarkId: string): Promise<WafflePayload> {
  const response = await fetch(
    `/api/waffle?version=${encodeURIComponent(benchmarkId)}`,
  );
  const payload = (await response.json()) as
    WafflePayload | { error?: { message?: string } };

  if (!response.ok) {
    throw new Error(
      "error" in payload && payload.error?.message
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
    .replaceAll("\\", "\\\\")
    .replaceAll("|", "\\|")
    .replace(/[\r\n]+/g, " ")
    .trim();
}

function buildWaffleMarkdownTable(data: WafflePayload): string {
  const header = [
    "Domain",
    "Task",
    "Pass",
    "Timeout",
    "Error",
    "Fail",
    "Solve",
  ];
  const divider = ["---", "---", "---:", "---:", "---:", "---:", "---:"];
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
    .map((line) => `| ${line.map(escapeMarkdownCell).join(" | ")} |`)
    .join("\n");
}

function rowIdentity(row: LeaderboardRow): string {
  const label = chartRowLabel(row);
  return [label.model, label.agent].filter(Boolean).join(" / ");
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
  /** Every trial merged into one row, for the "all" row mode. */
  all: MatrixDomainRow;
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
      return {
        identity: rowIdentity(row),
        model: label.model,
        agent: label.agent,
      };
    });
  } else {
    const seen = new Set<string>();
    identities = [];
    for (const trial of allTrials) {
      if (seen.has(trial.m)) continue;
      seen.add(trial.m);
      const [model = trial.m, agent = ""] = trial.m.split(" / ");
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
        if (trial.o === "p") pass += 1;
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
      solve: domainTotal > 0 ? Math.round((100 * domainPass) / domainTotal) : 0,
      taskCount: domain.tasks.length,
      cells: domainCells,
    });
  }

  tasks.sort((a, b) => b.solve - a.solve || a.task.localeCompare(b.task));
  domains.sort(
    (a, b) => b.taskCount - a.taskCount || a.name.localeCompare(b.name),
  );

  const allCells: MatrixSlot[][] = columns.map((_, index) =>
    domains.flatMap((domain) => domain.cells[index]!),
  );
  let allPass = 0;
  let allTotal = 0;
  for (const cell of allCells) {
    cell.sort((a, b) => OUTCOME_RANK[a.trial.o] - OUTCOME_RANK[b.trial.o]);
    for (const slot of cell) {
      allTotal += 1;
      if (slot.trial.o === "p") allPass += 1;
    }
  }
  const all: MatrixDomainRow = {
    name: "all",
    solve: allTotal > 0 ? Math.round((100 * allPass) / allTotal) : 0,
    taskCount: tasks.length,
    cells: allCells,
  };

  return { columns, maxReps, tasks, domains, all };
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
  onTrialMove,
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
  onTrialMove: (
    event: React.MouseEvent<SVGElement>,
    task: string,
    trial: WaffleTrial,
  ) => void;
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
        className={OUTCOME_CELL_CLASS[slot.trial.o]}
        shapeRendering="crispEdges"
        onMouseEnter={(event) => onTrialMove(event, slot.task, slot.trial)}
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

const WaffleSvg = memo(function WaffleSvg({
  matrix,
  mode,
  group,
  containerWidth,
  viewportH,
  onTrialMove,
  onTrialLeave,
  onSurfaceMove,
}: {
  matrix: Matrix;
  mode: RowMode;
  group: GroupMode;
  /** Scroll container width, to size the centering pad without overflow. */
  containerWidth: number;
  viewportH: number;
  onTrialMove: (
    event: React.MouseEvent<SVGElement>,
    task: string,
    trial: WaffleTrial,
  ) => void;
  onTrialLeave: () => void;
  onSurfaceMove: (event: React.MouseEvent<SVGElement>) => void;
}) {
  // Fixed pixel geometry (no viewBox stretch), scaled down in whole-pixel
  // steps until the full chart fits the viewport height — the same
  // quantization the blog's miniature waffles use so crispEdges renders
  // every square identically.
  const maxReps = Math.max(1, matrix.maxReps);
  const available = containerWidth > 0 ? containerWidth - 32 : 0;
  const domainRows = mode === "all" ? [matrix.all] : matrix.domains;
  const rowLabels =
    mode === "task"
      ? matrix.tasks.map((row) => row.task)
      : domainRows.map((row) => row.name);
  const maxLabelChars = Math.max(0, ...rowLabels.map((label) => label.length));
  // Chrome above/below the plot: nav, toolbar, card header, legend, padding.
  const budget = Math.max(420, viewportH - 230);
  let SW = 12;
  let SGAP = 2.5;
  let MG = 18;
  let RH = 20;
  let HEAD = 48;
  let domGap = 24;
  let fontSm = 11;
  let scale = 1;
  for (let iter = 0; iter < 4; iter++) {
    SW = Math.min(12, Math.max(5, Math.round(12 * scale) + 1));
    SGAP = Math.max(1, Math.round(2.5 * scale));
    MG = Math.max(8, Math.round(18 * scale));
    RH = Math.max(SW + SGAP, Math.round(20 * scale));
    domGap = Math.max(10, Math.round(24 * scale));
    fontSm = Math.min(11, Math.max(7, SW));
    // Two header text lines plus tight top/bottom clearance.
    HEAD = Math.round(2 * fontSm + 16);
    const pitchYEst = SW + SGAP;
    // One scale for every mode/group combination: converge on the tallest
    // layout so squares stay the same size when toggling views.
    const perLineFor = (m: RowMode) => {
      const gutEst =
        m === "task"
          ? Math.min(210, Math.ceil(maxLabelChars * fontSm * 0.6) + 16)
          : 36;
      return Math.max(
        1,
        Math.floor(
          ((available > 0
            ? (m === "task" ? available : available * 0.6) - gutEst - 16
            : 800) +
            SGAP) /
            (SW + SGAP),
        ),
      );
    };
    const estimateFor = (m: RowMode, g: GroupMode) => {
      const perLineEst = perLineFor(m);
      let est = HEAD + 10;
      if (m === "task") {
        // Task rows never wrap (outcome mode scrolls horizontally instead),
        // so every group renders one line per task.
        est += matrix.tasks.length * Math.max(RH, pitchYEst);
      } else {
        (m === "all" ? [matrix.all] : matrix.domains).forEach(
          (domain, index) => {
            const slots = domain.cells.reduce(
              (sum, cell) => sum + cell.length,
              0,
            );
            const lines =
              g === "outcome"
                ? Math.max(1, Math.ceil(slots / perLineEst))
                : Math.max(
                    ...domain.cells.map((cell) =>
                      Math.ceil(cell.length / maxReps),
                    ),
                    domain.taskCount,
                    1,
                  );
            est += lines * pitchYEst + (index > 0 ? domGap : 0);
          },
        );
      }
      return est;
    };
    const estimate = Math.max(
      estimateFor("task", "model"),
      estimateFor("task", "outcome"),
      estimateFor("domain", "model"),
      estimateFor("domain", "outcome"),
      estimateFor("all", "model"),
      estimateFor("all", "outcome"),
    );
    if (estimate <= budget || scale <= 0.35) break;
    scale *= Math.max(0.35, (budget - HEAD) / (estimate - HEAD));
  }
  const SH = SW;
  const VGAP = SGAP;
  const fontMd = fontSm + 1;
  const blockW = maxReps * SW + (maxReps - 1) * SGAP;
  const stepM = blockW + MG;
  // Fit the label gutter to the longest visible row label so mx-auto centers
  // the actual content; domain labels render vertically in a one-line gutter.
  const GUT =
    mode === "task"
      ? Math.min(210, Math.ceil(maxLabelChars * fontSm * 0.6) + 16)
      : 36;
  // Mirror the label gutter on the right so mx-auto centers the columns
  // themselves, not the gutter-plus-columns block — but never wider than the
  // container allows, or a scrollbar appears over pure whitespace.
  const RPAD_FALLBACK = GUT;
  const modelPlotW = Math.max(1, matrix.columns.length) * stepM - MG;

  // Outcome mode merges every model's trials into one gap-free run per row;
  // size the plot to its own content, not to the model-column layout, so no
  // trailing whitespace forces a scrollbar. Domain rows wrap at ~60% of the
  // container so the blocks stay in the middle of the screen.
  const wrapWidth = mode === "task" ? available : available * 0.6;
  const perLineCap = Math.max(
    1,
    Math.floor(
      ((available > 0 ? wrapWidth - GUT - 16 : modelPlotW) + SGAP) /
        (SW + SGAP),
    ),
  );
  const outcomeCounts = (mode === "task" ? matrix.tasks : domainRows).map(
    (row) => row.cells.reduce((sum, cell) => sum + cell.length, 0),
  );
  const maxOutcomeCount = Math.max(1, ...outcomeCounts, 1);
  // Task rows keep every trial on one line and scroll horizontally when the
  // run outgrows the container; only domain rows wrap to the container width.
  const perLine =
    mode === "task" ? maxOutcomeCount : Math.min(perLineCap, maxOutcomeCount);
  const plotW = group === "outcome" ? perLine * (SW + SGAP) - SGAP : modelPlotW;

  const RPAD =
    available > 0
      ? Math.max(16, Math.min(RPAD_FALLBACK, available - GUT - plotW))
      : RPAD_FALLBACK;
  const width = GUT + plotW + RPAD;
  const pitchY = SH + VGAP;

  const elements: React.ReactNode[] = [];

  const mergedSlots = (cells: MatrixSlot[][]) =>
    cells
      .flat()
      .sort((a, b) => OUTCOME_RANK[a.trial.o] - OUTCOME_RANK[b.trial.o]);

  // Truncate header lines to the column block width (no ellipsis).
  const headerChars = Math.max(1, Math.floor(blockW / (fontSm * 0.6)));
  const truncate = (value: string) => value.slice(0, headerChars).trimEnd();

  if (group === "model")
    matrix.columns.forEach((column, index) => {
      const cx = GUT + index * stepM + blockW / 2;
      const label = (
        <text
          x={cx}
          y={HEAD - (fontSm + 9)}
          textAnchor="middle"
          fontSize={fontSm}
          className="fill-foreground"
        >
          {truncate(column.model)}
          {column.agent ? (
            <tspan x={cx} dy={fontSm + 1} className="fill-muted-foreground">
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

  if (mode === "task") {
    let y = HEAD;
    matrix.tasks.forEach((task) => {
      const merged = group === "outcome" ? mergedSlots(task.cells) : null;
      const rowLines = merged
        ? Math.max(1, Math.ceil(merged.length / perLine))
        : 1;
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
              onTrialMove={onTrialMove}
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
                onTrialMove={onTrialMove}
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
    for (const domain of domainRows) {
      const merged = group === "outcome" ? mergedSlots(domain.cells) : null;
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
          x={GUT - 18}
          y={midY}
          textAnchor="middle"
          fontSize={fontMd}
          className="fill-foreground font-medium"
          transform={`rotate(-90 ${GUT - 18} ${midY})`}
        >
          {domain.name.toUpperCase()}
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
              onTrialMove={onTrialMove}
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
                onTrialMove={onTrialMove}
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
      onMouseLeave={(event) => {
        event.currentTarget.style.cursor = "";
        onTrialLeave();
      }}
      onMouseMove={(event) => {
        // Hide outside the squares' bounding box; glide within it. The svg
        // itself carries the pointer cursor inside that box so the cursor
        // doesn't flicker over the 1px gaps between the square links.
        const svg = event.currentTarget;
        const rect = svg.getBoundingClientRect();
        const lx = event.clientX - rect.left;
        const ly = event.clientY - rect.top;
        if (
          lx < GUT - 2 ||
          lx > GUT + plotW + 2 ||
          ly < HEAD - 2 ||
          ly > height - 8
        ) {
          if (svg.style.cursor) svg.style.cursor = "";
          onTrialLeave();
          return;
        }
        if (!svg.style.cursor) svg.style.cursor = "pointer";
        onSurfaceMove(event);
      }}
    >
      {elements}
    </svg>
  );
});

function Legend() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 border-t px-4 py-3 text-xs text-muted-foreground">
      {LEGEND_OUTCOMES.map((outcome) => (
        <span key={outcome} className="inline-flex items-center gap-1.5">
          <span
            className={`inline-block size-3 ${OUTCOME_SWATCH_CLASS[outcome]}`}
          />
          {OUTCOME_WORD[outcome]}
        </span>
      ))}
      <span>each square is one trial</span>
    </div>
  );
}

export function TaskWaffleView() {
  const [mode, setMode] = useQueryState(
    "rows",
    parseRowMode.withDefault("task"),
  );
  const [group, setGroup] = useQueryState(
    "group",
    parseGroupMode.withDefault("model"),
  );
  const { benchmark } = useHomeBenchmark();

  const { data, error, isPending } = useQuery({
    queryKey: ["waffle", "terminal-bench", benchmark.id],
    queryFn: () => fetchWaffleData(benchmark.id),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  });
  const { data: leaderboardData } = useQuery({
    queryKey: leaderboardQueryKey(benchmark.package, benchmark.leaderboard),
    queryFn: () => fetchLeaderboard(benchmark.package, benchmark.leaderboard),
    placeholderData: keepPreviousData,
  });
  const { facets, filters, handleFiltersChange, filteredRows, toolbarColumns } =
    useLeaderboardFilters(leaderboardData);

  // Render only consistent (payload, rows) pairs. During a benchmark switch
  // the (fast) leaderboard query resolves before the waffle payload; pairing
  // stale trials with new rows would blank cells and shuffle columns, so keep
  // showing the previous consistent snapshot until the new pair is complete.
  const lastConsistent = useRef<{
    data: WafflePayload;
    rows: LeaderboardRow[];
  } | null>(null);
  if (data && leaderboardData?.leaderboard.name === data.leaderboard.name) {
    // Keep the snapshot referentially stable across unrelated renders (e.g.
    // hover state) — a fresh object here would rebuild the matrix and
    // re-render the whole SVG on every tooltip move.
    const prev = lastConsistent.current;
    if (!prev || prev.data !== data || prev.rows !== filteredRows) {
      lastConsistent.current = { data, rows: filteredRows };
    }
  }
  const snapshot = lastConsistent.current ?? (data ? { data, rows: [] } : null);

  // Fixed tooltip width: the rendered width of the longest task name
  // (semibold title) or error name, so the box never resizes while sweeping.
  const tipWidth = useMemo(() => {
    if (!snapshot || typeof document === "undefined") return 235;
    const context = document.createElement("canvas").getContext("2d");
    if (!context) return 235;
    const family = getComputedStyle(document.body).fontFamily;
    let widest = 0;
    const measure = (value: string, weight: number) => {
      context.font = `${weight} 12px ${family}`;
      widest = Math.max(widest, context.measureText(value).width);
    };
    for (const dom of snapshot.data.doms) {
      for (const task of dom.tasks) {
        measure(task.task, 600);
        for (const trial of task.ts) if (trial.e) measure(trial.e, 400);
      }
    }
    // px-3 padding on each side, plus a hair for rounding.
    return Math.ceil(widest) + 26;
  }, [snapshot]);
  const matrix = useMemo(
    () => (snapshot ? buildMatrix(snapshot.data, snapshot.rows) : null),
    [snapshot],
  );

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrollObserverRef = useRef<ResizeObserver | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const setScrollRef = useCallback((el: HTMLDivElement | null) => {
    scrollRef.current = el;
    scrollObserverRef.current?.disconnect();
    scrollObserverRef.current = null;
    if (!el) return;
    const update = () => setContainerWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    scrollObserverRef.current = observer;
  }, []);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [tipOpen, setTipOpen] = useState(false);
  const [viewportH, setViewportH] = useState(900);
  useEffect(() => {
    const update = () => setViewportH(window.innerHeight);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // All hover work (square enters and glide moves) is coalesced into one
  // rAF callback per frame. Measuring synchronously in every event forces a
  // layout reflow per crossed square — laggy on dense outcome runs where a
  // sweep crosses several squares per frame on many-trial versions.
  const hoverRaf = useRef(0);
  const hoverPoint = useRef({ x: 0, y: 0 });
  const pendingShow = useRef<{
    el: Element;
    task: string;
    trial: WaffleTrial;
  } | null>(null);
  const scheduleHover = useCallback(() => {
    if (hoverRaf.current) return;
    hoverRaf.current = requestAnimationFrame(() => {
      hoverRaf.current = 0;
      const container = scrollRef.current;
      if (!container) return;
      const bounds = container.getBoundingClientRect();
      const x = hoverPoint.current.x - bounds.left + container.scrollLeft;
      const y = hoverPoint.current.y - bounds.top + container.scrollTop;
      const show = pendingShow.current;
      pendingShow.current = null;
      if (show && show.el.isConnected) {
        const square = show.el.getBoundingClientRect();
        setTooltip({
          task: show.task,
          trial: show.trial,
          x,
          y,
          hx: square.left - bounds.left + container.scrollLeft,
          hy: square.top - bounds.top + container.scrollTop,
          hw: square.width,
          hh: square.height,
        });
        setTipOpen(true);
      } else {
        setTooltip((prev) =>
          prev && (prev.x !== x || prev.y !== y) ? { ...prev, x, y } : prev,
        );
      }
    });
  }, []);
  useEffect(() => () => cancelAnimationFrame(hoverRaf.current), []);

  const showTooltip = useCallback(
    (event: React.MouseEvent<SVGElement>, task: string, trial: WaffleTrial) => {
      hoverPoint.current = { x: event.clientX, y: event.clientY };
      pendingShow.current = { el: event.currentTarget as Element, task, trial };
      scheduleHover();
    },
    [scheduleHover],
  );

  // Keeps the anchor under the cursor while crossing the gaps between
  // squares, so the tooltip glides instead of flickering closed. WaffleSvg
  // only calls this while the cursor is inside the squares' perimeter.
  const moveTooltip = useCallback(
    (event: React.MouseEvent<SVGElement>) => {
      hoverPoint.current = { x: event.clientX, y: event.clientY };
      scheduleHover();
    },
    [scheduleHover],
  );

  const hideTooltip = useCallback(() => {
    pendingShow.current = null;
    setTipOpen(false);
  }, []);

  if (isPending) {
    return (
      <div className="flex w-full min-w-0 flex-col gap-1.5">
        <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-1.5">
          <ViewExportActions
            targetId={WAFFLE_EXPORT_TARGET_ID}
            fileBaseName={`terminal-bench-${benchmark.id}-waffle`}
            getMarkdown={() => ""}
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
        <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-1.5">
          <ViewExportActions
            targetId={WAFFLE_EXPORT_TARGET_ID}
            fileBaseName={`terminal-bench-${benchmark.id}-waffle`}
            getMarkdown={() => ""}
            disabled
          />
          <HomeViewToggle />
        </div>
        <div className="-mx-4 flex min-h-[560px] items-center justify-center rounded-none border border-x-0 border-destructive/30 bg-destructive/5 px-4 py-10 text-center text-sm text-destructive md:mx-0 md:rounded-xl md:border-x">
          {error instanceof Error
            ? error.message
            : "No trials available to render."}
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-1.5">
      <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-1.5">
        <ViewExportActions
          targetId={WAFFLE_EXPORT_TARGET_ID}
          fileBaseName={`terminal-bench-${benchmark.id}-waffle`}
          getMarkdown={() => buildWaffleMarkdownTable(snapshot?.data ?? data)}
        />
        <div className="flex min-w-0 items-center gap-1.5 max-[529px]:contents">
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
              if (next === "task" || next === "domain" || next === "all")
                void setMode(next);
            }}
          >
            <SelectTrigger
              size="sm"
              className="bg-background uppercase dark:bg-card"
            >
              <SelectValue>
                <span className="grid text-left">
                  <span aria-hidden className="invisible [grid-area:1/1]">
                    Domain
                  </span>
                  <span className="[grid-area:1/1]">
                    {mode === "task"
                      ? "Task"
                      : mode === "domain"
                        ? "Domain"
                        : "All"}
                  </span>
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent
              align="start"
              alignItemWithTrigger={false}
              className="min-w-(--anchor-width)"
            >
              <SelectItem value="task" className="uppercase">
                Task
              </SelectItem>
              <SelectItem value="domain" className="uppercase">
                Domain
              </SelectItem>
              <SelectItem value="all" className="uppercase">
                All
              </SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm font-medium text-foreground">and</span>
          <Select
            value={group}
            onValueChange={(next) => {
              if (next === "model" || next === "outcome") void setGroup(next);
            }}
          >
            <SelectTrigger
              size="sm"
              className="bg-background uppercase dark:bg-card"
            >
              <SelectValue>
                <span className="grid text-left">
                  <span aria-hidden className="invisible [grid-area:1/1]">
                    Outcome
                  </span>
                  <span className="[grid-area:1/1]">
                    {group === "model" ? "Model" : "Outcome"}
                  </span>
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent
              align="start"
              alignItemWithTrigger={false}
              className="min-w-(--anchor-width)"
            >
              <SelectItem value="model" className="uppercase">
                Model
              </SelectItem>
              <SelectItem value="outcome" className="uppercase">
                Outcome
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(snapshot?.data ?? data).doms.length > 0 ? (
          <>
            <div
              ref={setScrollRef}
              className="relative overflow-x-auto px-4 py-3"
            >
              <WaffleSvg
                matrix={matrix}
                mode={mode}
                group={group}
                containerWidth={containerWidth}
                viewportH={viewportH}
                onTrialMove={showTooltip}
                onTrialLeave={hideTooltip}
                onSurfaceMove={moveTooltip}
              />
              {/* Hover highlight drawn outside the big SVG so sweeping never
                  re-renders the grid. */}
              {tipOpen && tooltip ? (
                <div
                  aria-hidden
                  className="pointer-events-none absolute border border-foreground"
                  style={{
                    left: tooltip.hx,
                    top: tooltip.hy,
                    width: tooltip.hw,
                    height: tooltip.hh,
                  }}
                />
              ) : null}
              <Tooltip
                open={tipOpen}
                onOpenChange={setTipOpen}
                onOpenChangeComplete={(open) => {
                  if (!open) setTooltip(null);
                }}
              >
                <TooltipTrigger
                  type="button"
                  tabIndex={-1}
                  delay={0}
                  aria-hidden
                  className="pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 opacity-0"
                  style={{
                    left: (tooltip?.x ?? 0) + 19,
                    top: tooltip?.y ?? 0,
                  }}
                />
                <TooltipContent
                  side="bottom"
                  align="start"
                  sideOffset={10}
                  variant="chart"
                  className="pointer-events-none max-w-none"
                  style={{ width: tipWidth }}
                >
                  {tooltip ? (
                    <div className="flex w-full min-w-0 flex-col">
                      <p className="mb-1 font-semibold whitespace-nowrap">
                        {tooltip.task}
                      </p>
                      <p className="truncate opacity-70">{tooltip.trial.m}</p>
                      <p
                        className={`whitespace-nowrap ${
                          {
                            err: "text-[#e5484d]",
                            to: "text-[#f2872e]",
                            p: "text-foreground",
                            f: "text-foreground/45",
                          }[tooltip.trial.o]
                        }`}
                      >
                        {tooltip.trial.e ?? OUTCOME_WORD[tooltip.trial.o]}
                      </p>
                      <p className="mt-1.5 border-t border-border pt-1.5 text-[10.5px] opacity-50">
                        click to view trial
                      </p>
                    </div>
                  ) : null}
                </TooltipContent>
              </Tooltip>
            </div>
            <Legend />
          </>
        ) : (
          <div className="flex min-h-[420px] items-center justify-center px-6 py-10 text-center text-sm text-muted-foreground">
            Per-trial data unavailable
          </div>
        )}
      </div>
    </div>
  );
}
