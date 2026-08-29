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

const ROW_MODES = ["task", "domain"] as const;
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
  const rowLabels =
    mode === "task"
      ? matrix.tasks.map((row) => row.task)
      : matrix.domains.map((row) => row.name);
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
          ((available > 0 ? available - gutEst - 16 : 800) + SGAP) /
            (SW + SGAP),
        ),
      );
    };
    const estimateFor = (m: RowMode, g: GroupMode) => {
      const perLineEst = perLineFor(m);
      let est = HEAD + 10;
      if (m === "task") {
        for (const row of matrix.tasks) {
          const slots = row.cells.reduce((sum, cell) => sum + cell.length, 0);
          const lines =
            g === "outcome" ? Math.max(1, Math.ceil(slots / perLineEst)) : 1;
          est += Math.max(RH, lines * pitchYEst);
        }
      } else {
        matrix.domains.forEach((domain, index) => {
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
        });
      }
      return est;
    };
    const estimate = Math.max(
      estimateFor("task", "model"),
      estimateFor("task", "outcome"),
      estimateFor("domain", "model"),
      estimateFor("domain", "outcome"),
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
  // size the plot to its own content (capped at the container), not to the
  // model-column layout, so no trailing whitespace forces a scrollbar.
  const perLineCap = Math.max(
    1,
    Math.floor(
      ((available > 0 ? available - GUT - 16 : modelPlotW) + SGAP) /
        (SW + SGAP),
    ),
  );
  const outcomeCounts = (mode === "task" ? matrix.tasks : matrix.domains).map(
    (row) => row.cells.reduce((sum, cell) => sum + cell.length, 0),
  );
  const maxOutcomeCount = Math.max(1, ...outcomeCounts, 1);
  const perLine = Math.min(perLineCap, maxOutcomeCount);
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
    for (const domain of matrix.domains) {
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
      onMouseLeave={onTrialLeave}
      onMouseMove={(event) => {
        // Hide outside the squares' bounding box; glide within it.
        const rect = event.currentTarget.getBoundingClientRect();
        const lx = event.clientX - rect.left;
        const ly = event.clientY - rect.top;
        if (
          lx < GUT - 2 ||
          lx > GUT + plotW + 2 ||
          ly < HEAD - 2 ||
          ly > height - 8
        ) {
          onTrialLeave();
          return;
        }
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
    lastConsistent.current = { data, rows: filteredRows };
  }
  const snapshot = lastConsistent.current ?? (data ? { data, rows: [] } : null);

  const maxTaskLen = useMemo(
    () =>
      snapshot
        ? Math.max(
            1,
            ...snapshot.data.doms.flatMap((dom) =>
              dom.tasks.map((task) => task.task.length),
            ),
          )
        : 32,
    [snapshot],
  );
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

  const showTooltip = useCallback(
    (event: React.MouseEvent<SVGElement>, task: string, trial: WaffleTrial) => {
      const container = scrollRef.current;
      if (!container) return;
      const bounds = container.getBoundingClientRect();
      const square = (event.currentTarget as Element).getBoundingClientRect();
      setTooltip({
        task,
        trial,
        x: event.clientX - bounds.left + container.scrollLeft,
        y: event.clientY - bounds.top + container.scrollTop,
        hx: square.left - bounds.left + container.scrollLeft,
        hy: square.top - bounds.top + container.scrollTop,
        hw: square.width,
        hh: square.height,
      });
      setTipOpen(true);
    },
    [],
  );

  // Keeps the anchor under the cursor while crossing the gaps between
  // squares, so the tooltip glides instead of flickering closed. WaffleSvg
  // only calls this while the cursor is inside the squares' perimeter.
  // Coalesced to one state update per frame; unthrottled moves force a
  // layout reflow per event, which lags on versions with many trials.
  const moveRaf = useRef(0);
  const movePoint = useRef({ x: 0, y: 0 });
  const moveTooltip = useCallback((event: React.MouseEvent<SVGElement>) => {
    movePoint.current = { x: event.clientX, y: event.clientY };
    if (moveRaf.current) return;
    moveRaf.current = requestAnimationFrame(() => {
      moveRaf.current = 0;
      const container = scrollRef.current;
      if (!container) return;
      const bounds = container.getBoundingClientRect();
      const x = movePoint.current.x - bounds.left + container.scrollLeft;
      const y = movePoint.current.y - bounds.top + container.scrollTop;
      setTooltip((prev) =>
        prev && (prev.x !== x || prev.y !== y) ? { ...prev, x, y } : prev,
      );
    });
  }, []);
  useEffect(() => () => cancelAnimationFrame(moveRaf.current), []);

  const hideTooltip = useCallback(() => setTipOpen(false), []);

  if (isPending) {
    return (
      <div className="flex w-full min-w-0 flex-col gap-1.5">
        <div className="flex items-center justify-between gap-1.5">
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
        <div className="flex items-center justify-between gap-1.5">
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
      <div className="flex items-center justify-between gap-1.5">
        <ViewExportActions
          targetId={WAFFLE_EXPORT_TARGET_ID}
          fileBaseName={`terminal-bench-${benchmark.id}-waffle`}
          getMarkdown={() => buildWaffleMarkdownTable(snapshot?.data ?? data)}
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
              if (next === "task" || next === "domain") void setMode(next);
            }}
          >
            <SelectTrigger
              size="sm"
              className="min-w-28 bg-background uppercase dark:bg-card"
            >
              <SelectValue>{mode === "task" ? "Task" : "Domain"}</SelectValue>
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
              if (next === "model" || next === "outcome") void setGroup(next);
            }}
          >
            <SelectTrigger
              size="sm"
              className="min-w-28 bg-background uppercase dark:bg-card"
            >
              <SelectValue>
                {group === "model" ? "Model" : "Outcome"}
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
                  className="pointer-events-none w-[235px] max-w-none"
                >
                  {tooltip ? (
                    <div className="flex w-full flex-col">
                      <p className="mb-1 font-semibold">{tooltip.task}</p>
                      <p className="opacity-70">{tooltip.trial.m}</p>
                      <p
                        className={
                          {
                            err: "text-[#e5484d]",
                            to: "text-[#f2872e]",
                            p: "text-foreground",
                            f: "text-foreground/45",
                          }[tooltip.trial.o]
                        }
                      >
                        {tooltip.trial.e?.slice(0, maxTaskLen) ??
                          OUTCOME_WORD[tooltip.trial.o]}
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
