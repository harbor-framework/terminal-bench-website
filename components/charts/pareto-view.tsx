"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useMemo } from "react";

import {
  DEFAULT_PARETO_X,
  DEFAULT_PARETO_Y,
  PARETO_AXES,
  PARETO_X_AXIS_IDS,
  isParetoXAxisId,
} from "@/components/charts/pareto-axes";
import {
  ParetoScatterChart,
  type ParetoDatum,
  buildParetoData,
} from "@/components/charts/pareto-scatter-chart";
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
import { ViewExportActions } from "@/components/view-export-actions";
import {
  TERMINAL_BENCH_LEADERBOARD,
  TERMINAL_BENCH_PACKAGE,
  fetchLeaderboard,
  leaderboardQueryKey,
} from "@/lib/leaderboard";
import { useRowJobIds } from "@/lib/row-jobs";

const parseParetoXAxis = parseAsStringLiteral(PARETO_X_AXIS_IDS);
const PARETO_EXPORT_TARGET_ID = "terminal-bench-pareto-export";
const PARETO_CAPTIONS: Record<(typeof PARETO_X_AXIS_IDS)[number], string> = {
  cost: "against total cost, summed across all trials.",
  tokens:
    "against total token usage, summing input, output, and cached tokens across all trials.",
  time: "against total wall-clock time, summed across all trials.",
  release_date: "against model release date.",
};

function escapeMarkdownCell(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("|", "\\|")
    .replace(/[\r\n]+/g, " ")
    .trim();
}

function buildParetoMarkdownTable(
  data: ParetoDatum[],
  xAxisId: typeof DEFAULT_PARETO_X,
  yAxisId: typeof DEFAULT_PARETO_Y,
): string {
  const xAxis = PARETO_AXES[xAxisId];
  const yAxis = PARETO_AXES[yAxisId];
  const header = ["Model", "Agent", yAxis.label, xAxis.label, "Pareto"];
  const divider = ["---", "---", "---:", "---:", "---"];
  const body = data.map((datum) => [
    datum.label.model,
    datum.label.agent || "-",
    yAxis.format(datum.y),
    xAxis.format(datum.x),
    datum.onFrontier ? "Yes" : "No",
  ]);

  return [header, divider, ...body]
    .map((line) => `| ${line.map(escapeMarkdownCell).join(" | ")} |`)
    .join("\n");
}

export function ParetoView() {
  const [xAxisId, setXAxisId] = useQueryState(
    "x",
    parseParetoXAxis.withDefault(DEFAULT_PARETO_X),
  );

  const yAxisId = DEFAULT_PARETO_Y;
  const { benchmark } = useHomeBenchmark();

  const { data, error, isPending } = useQuery({
    queryKey: leaderboardQueryKey(benchmark.package, benchmark.leaderboard),
    queryFn: () => fetchLeaderboard(benchmark.package, benchmark.leaderboard),
    placeholderData: keepPreviousData,
  });

  const { facets, filters, handleFiltersChange, filteredRows, toolbarColumns } =
    useLeaderboardFilters(data);

  const rowIds = useMemo(
    () => (data ? data.rows.map((row) => row.id) : []),
    [data],
  );
  const jobIdByRow = useRowJobIds(rowIds);

  const chartData = useMemo(
    () => buildParetoData(filteredRows, xAxisId, yAxisId),
    [filteredRows, xAxisId, yAxisId],
  );

  const longestXLabel = PARETO_X_AXIS_IDS.map(
    (axisId) => PARETO_AXES[axisId].label,
  ).reduce((a, b) => (b.length > a.length ? b : a), "");

  const xLabel = PARETO_AXES[xAxisId].label;
  const yLabel = PARETO_AXES[yAxisId].label;
  const caption = `Resolution rate of ${benchmark.label} tasks ${PARETO_CAPTIONS[xAxisId]}`;

  if (isPending) {
    return (
      <div className="flex w-full min-w-0 flex-col gap-1.5">
        <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-1.5">
          <ViewExportActions
            targetId={PARETO_EXPORT_TARGET_ID}
            fileBaseName={`terminal-bench-${benchmark.id}-pareto`}
            getMarkdown={() => ""}
            disabled
          />
          <HomeViewToggle />
        </div>
        <div className="-mx-4 rounded-none border border-x-0 px-4 py-10 text-center text-sm text-muted-foreground md:mx-0 md:rounded-xl md:border-x">
          Loading Pareto…
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex w-full min-w-0 flex-col gap-1.5">
        <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-1.5">
          <ViewExportActions
            targetId={PARETO_EXPORT_TARGET_ID}
            fileBaseName={`terminal-bench-${benchmark.id}-pareto`}
            getMarkdown={() => ""}
            disabled
          />
          <HomeViewToggle />
        </div>
        <div className="-mx-4 rounded-none border border-x-0 border-destructive/30 bg-destructive/5 px-4 py-10 text-center text-sm text-destructive md:mx-0 md:rounded-xl md:border-x">
          {error?.message ?? "Failed to load Pareto data"}
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-1.5">
      <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-1.5">
        <ViewExportActions
          targetId={PARETO_EXPORT_TARGET_ID}
          fileBaseName={`terminal-bench-${benchmark.id}-pareto`}
          getMarkdown={() =>
            buildParetoMarkdownTable(chartData, xAxisId, yAxisId)
          }
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
        id={PARETO_EXPORT_TARGET_ID}
        className="-mx-4 min-w-0 overflow-hidden rounded-none border border-x-0 bg-card md:mx-0 md:rounded-xl md:border-x"
      >
        <div className="flex h-12 flex-wrap items-center gap-2 border-b px-6 uppercase">
          <span className="text-sm font-medium text-foreground">
            {yLabel} vs
          </span>
          <Select
            value={xAxisId}
            onValueChange={(next) => {
              if (typeof next === "string" && isParetoXAxisId(next)) {
                void setXAxisId(next);
              }
            }}
          >
            <SelectTrigger
              size="sm"
              className="bg-background uppercase dark:bg-card"
            >
              <SelectValue>
                <span className="grid text-left">
                  <span aria-hidden className="invisible [grid-area:1/1]">
                    {longestXLabel}
                  </span>
                  <span className="[grid-area:1/1]">{xLabel}</span>
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent
              align="start"
              alignItemWithTrigger={false}
              className="min-w-(--anchor-width)"
            >
              {PARETO_X_AXIS_IDS.map((axisId) => (
                <SelectItem key={axisId} value={axisId} className="uppercase">
                  {PARETO_AXES[axisId].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ParetoScatterChart
          data={chartData}
          xAxisId={xAxisId}
          yAxisId={yAxisId}
          jobIdByRow={jobIdByRow}
          className="px-2 py-3"
        />
        <footer className="flex min-h-12 items-center justify-center border-t px-6 py-3 text-center text-sm text-muted-foreground">
          {caption}
        </footer>
      </div>
    </div>
  );
}
