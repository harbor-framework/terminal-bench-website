"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  chartRowLabel,
  type ChartRowLabel,
} from "@/components/charts/chart-labels";
import {
  PARETO_AXES,
  type ParetoAxisDef,
  type ParetoAxisId,
} from "@/components/charts/pareto-axes";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  TERMINAL_BENCH_DATASET_VERSION,
  TERMINAL_BENCH_LEADERBOARD,
  TERMINAL_BENCH_PACKAGE,
  getAccessorValue,
  harborLeaderboardRowUrl,
  type LeaderboardRow,
} from "@/lib/leaderboard";
import { harborJobUrl } from "@/lib/row-jobs";

export type ParetoDatum = {
  id: string;
  label: ChartRowLabel;
  x: number;
  y: number;
  /** 95% CI half-width on the y value, when the leaderboard provides one. */
  yCi: number | null;
  onFrontier: boolean;
};

const MIN_WIDTH = 480;
const HEIGHT = 580;
// Matches the leaderboard table's text-sm.
const LABEL_FONT = 14;
// Below MIN_WIDTH the whole chart scales down with the viewport; lay it out
// on a shorter canvas there so the scaled result isn't disproportionately
// tall on thin screens.
const NARROW_HEIGHT = 460;
const MARGIN = { top: 20, right: 28, bottom: 52, left: 84 };
/** Half-side length of plot markers (squares). */
const DOT_HALF = 4;
const FRONTIER_DOT_HALF = 5;

function niceTicks(min: number, max: number, count: number): number[] {
  if (!(max > min) || count < 2) return [min, max];
  const span = max - min;
  const step = span / (count - 1);
  const raw = 10 ** Math.floor(Math.log10(step));
  const err = step / raw;
  const niceStep =
    err >= 7.5 ? 10 * raw : err >= 3.5 ? 5 * raw : err >= 1.5 ? 2 * raw : raw;
  const niceMin = Math.floor(min / niceStep) * niceStep;
  const niceMax = Math.ceil(max / niceStep) * niceStep;
  const ticks: number[] = [];
  for (let v = niceMin; v <= niceMax + niceStep * 0.5; v += niceStep) {
    ticks.push(Math.round(v * 1e6) / 1e6);
  }
  return ticks;
}

function dateTicks(min: number, max: number, count: number): number[] {
  if (!(max > min) || count < 2) return [min, max];
  const ticks: number[] = [];
  for (let i = 0; i < count; i++) {
    ticks.push(min + ((max - min) * i) / (count - 1));
  }
  return ticks;
}

function axisTicks(
  axisId: ParetoAxisId,
  values: number[],
  padRatio: number,
): number[] {
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const pad = (maxV - minV) * padRatio || Math.abs(maxV) * 0.05 || 1;

  if (axisId === "release_date") {
    const day = 24 * 60 * 60 * 1000;
    return dateTicks(minV - day * 2, maxV + day * 2, 5);
  }

  if (axisId === "time") {
    // Clean gridlines at multiples of 100 hours (values are seconds).
    const hour = 3600;
    const step =
      [100, 200, 500, 1000].find((s) => (maxV * 1.05) / (s * hour) <= 6) ??
      1000;
    const hi = Math.ceil((maxV * 1.05) / (step * hour)) * step * hour;
    const ticks: number[] = [];
    for (let v = 0; v <= hi; v += step * hour) ticks.push(v);
    return ticks;
  }

  let lo = minV - pad;
  let hi = maxV + pad;
  if (axisId === "accuracy") {
    lo = Math.max(0, lo);
    hi = Math.min(100, hi);
  } else if (axisId === "cost" || axisId === "tokens") {
    lo = Math.max(0, lo);
  }

  return niceTicks(lo, hi, 5);
}

function isBetterOrEqual(
  a: number,
  b: number,
  prefer: ParetoAxisDef["prefer"],
): boolean {
  return prefer === "max" ? a >= b : a <= b;
}

function isStrictlyBetter(
  a: number,
  b: number,
  prefer: ParetoAxisDef["prefer"],
): boolean {
  return prefer === "max" ? a > b : a < b;
}

export function computeParetoFrontier(
  points: Omit<ParetoDatum, "onFrontier">[],
  xAxis: ParetoAxisDef,
  yAxis: ParetoAxisDef,
): Set<string> {
  const frontier = new Set<string>();
  for (const point of points) {
    const dominated = points.some(
      (other) =>
        other.id !== point.id &&
        isBetterOrEqual(other.x, point.x, xAxis.prefer) &&
        isBetterOrEqual(other.y, point.y, yAxis.prefer) &&
        (isStrictlyBetter(other.x, point.x, xAxis.prefer) ||
          isStrictlyBetter(other.y, point.y, yAxis.prefer)),
    );
    if (!dominated) frontier.add(point.id);
  }
  return frontier;
}

export function buildParetoData(
  rows: LeaderboardRow[],
  xAxisId: ParetoAxisId,
  yAxisId: ParetoAxisId,
): ParetoDatum[] {
  const xAxis = PARETO_AXES[xAxisId];
  const yAxis = PARETO_AXES[yAxisId];

  const points = rows
    .map((row) => {
      const x = xAxis.read(row);
      const y = yAxis.read(row);
      if (x == null || y == null) return null;
      const ci = getAccessorValue(row, "metrics.accuracy_ci95_half_width");
      const stderr = getAccessorValue(row, "metrics.accuracy_stderr");
      // Older leaderboards publish only the standard error.
      const halfWidth =
        typeof ci === "number" && ci > 0
          ? ci
          : typeof stderr === "number" && stderr > 0
            ? 1.96 * stderr
            : null;
      return {
        id: row.id,
        label: chartRowLabel(row),
        x,
        y,
        yCi: yAxisId === "accuracy" ? halfWidth : null,
      };
    })
    .filter((row): row is Omit<ParetoDatum, "onFrontier"> => row != null);

  const frontier = computeParetoFrontier(points, xAxis, yAxis);
  return points
    .map((point) => ({
      ...point,
      onFrontier: frontier.has(point.id),
    }))
    .sort((a, b) => a.x - b.x);
}

type ParetoScatterChartProps = {
  data: ParetoDatum[];
  xAxisId: ParetoAxisId;
  yAxisId: ParetoAxisId;
  /** Row id -> Hub job id; rows are 1-1 with jobs so clicks open the job. */
  jobIdByRow?: Record<string, string>;
  className?: string;
};

type ActiveTip = {
  id: string;
  label: string;
  yValue: string;
  ciValue: string | null;
  xValue: string;
  cx: number;
  cy: number;
};

export function ParetoScatterChart({
  data,
  xAxisId,
  yAxisId,
  jobIdByRow,
  className,
}: ParetoScatterChartProps) {
  const [width, setWidth] = useState(MIN_WIDTH);
  const [containerWidth, setContainerWidth] = useState(MIN_WIDTH);
  // SSR can't measure, so the first paint would show the MIN_WIDTH chart
  // until hydration; keep it hidden until the client has measured once.
  const [measured, setMeasured] = useState(false);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  // Callback ref so the observer re-attaches whenever the plot node remounts
  // (the empty-data branch unmounts it; an effect with [] deps would never
  // re-observe and the chart would stay at MIN_WIDTH).
  const plotRef = useCallback((el: HTMLDivElement | null) => {
    resizeObserverRef.current?.disconnect();
    resizeObserverRef.current = null;
    if (!el) return;
    const update = () => {
      setWidth(Math.max(MIN_WIDTH, Math.floor(el.clientWidth)));
      setContainerWidth(Math.floor(el.clientWidth));
      setMeasured(true);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    resizeObserverRef.current = observer;
  }, []);
  const [active, setActive] = useState<ActiveTip | null>(null);
  const [tipOpen, setTipOpen] = useState(false);
  const xAxis = PARETO_AXES[xAxisId];
  const yAxis = PARETO_AXES[yAxisId];

  // Clear tip when axes change so we don't show stale content.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setTipOpen(false);
      setActive(null);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [xAxisId, yAxisId]);

  if (data.length === 0) {
    return (
      <p className="px-4 py-16 text-center text-sm text-muted-foreground">
        No Pareto data to chart.
      </p>
    );
  }

  const plotW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const chartHeight = containerWidth < MIN_WIDTH ? NARROW_HEIGHT : HEIGHT;
  const plotH = Math.max(0, chartHeight - MARGIN.top - MARGIN.bottom);

  const xs = data.map((d) => d.x);
  const ys = data.map((d) => d.y);
  const xTicks = axisTicks(xAxisId, xs, 0.08);
  // Resolution rate always spans the full 0-100% scale.
  const yTicks =
    yAxisId === "accuracy"
      ? [0, 20, 40, 60, 80, 100]
      : axisTicks(yAxisId, ys, 0.12);
  const xMin = xTicks[0]!;
  const xMax = xTicks[xTicks.length - 1]!;
  const yMin = yTicks[0]!;
  const yMax = yTicks[yTicks.length - 1]!;

  const xScale = (value: number) =>
    MARGIN.left + ((value - xMin) / (xMax - xMin || 1)) * plotW;
  const yScale = (value: number) =>
    MARGIN.top + (1 - (value - yMin) / (yMax - yMin || 1)) * plotH;

  const frontier = data.filter((d) => d.onFrontier).sort((a, b) => a.x - b.x);
  // Wash the unattained region up-left of the frontier (min-x, max-y charts).
  const washPath =
    frontier.length > 0 && xAxis.prefer === "min" && yAxis.prefer === "max"
      ? [
          `M ${MARGIN.left} ${MARGIN.top + plotH}`,
          `L ${MARGIN.left} ${MARGIN.top}`,
          `L ${MARGIN.left + plotW} ${MARGIN.top}`,
          `L ${MARGIN.left + plotW} ${yScale(frontier[frontier.length - 1]!.y)}`,
          ...[...frontier]
            .reverse()
            .map((d) => `L ${xScale(d.x)} ${yScale(d.y)}`),
          `L ${xScale(frontier[0]!.x)} ${MARGIN.top + plotH}`,
          "Z",
        ].join(" ")
      : null;

  // Hide non-frontier labels that would overlap an already-visible label;
  // frontier labels always render.
  const hiddenLabelIds = new Set<string>();
  {
    const boxes = data.map((datum) => {
      const cx = xScale(datum.x);
      const cy = yScale(datum.y);
      const half = datum.onFrontier ? FRONTIER_DOT_HALF : DOT_HALF;
      const text =
        datum.label.model + (datum.label.agent ? ` ${datum.label.agent}` : "");
      const width = text.length * LABEL_FONT * 0.62;
      const labelLeft = cx > MARGIN.left + plotW - 200;
      const x1 = labelLeft ? cx - half - 7 - width : cx + half + 7;
      return {
        id: datum.id,
        onFrontier: datum.onFrontier,
        x1,
        x2: x1 + width,
        y1: cy - LABEL_FONT * 0.55,
        y2: cy + LABEL_FONT * 0.55,
      };
    });
    const kept = boxes.filter((box) => box.onFrontier);
    for (const box of boxes) {
      if (box.onFrontier) continue;
      const overlaps = kept.some(
        (k) => box.x1 < k.x2 && k.x1 < box.x2 && box.y1 < k.y2 && k.y1 < box.y2,
      );
      if (overlaps) hiddenLabelIds.add(box.id);
      else kept.push(box);
    }
  }

  return (
    <div className={className}>
      <div
        ref={plotRef}
        className="relative w-full overflow-hidden"
        // Below MIN_WIDTH the svg scales down via max-w-full; shrink the
        // wrapper with it so no dead space is reserved.
        style={{
          height: Math.round(chartHeight * Math.min(1, containerWidth / width)),
        }}
      >
        <svg
          style={measured ? undefined : { visibility: "hidden" }}
          viewBox={`0 0 ${width} ${chartHeight}`}
          width={width}
          height={chartHeight}
          role="img"
          aria-label={`Pareto scatter of ${yAxis.label} versus ${xAxis.label}`}
          className="block h-auto max-w-full"
        >
          {xTicks.slice(1, -1).map((tick) => (
            <line
              key={`x-grid-${tick}`}
              x1={xScale(tick)}
              y1={MARGIN.top}
              x2={xScale(tick)}
              y2={MARGIN.top + plotH}
              className="stroke-border"
              strokeWidth={1}
            />
          ))}
          {yTicks.slice(1, -1).map((tick) => (
            <line
              key={`y-grid-${tick}`}
              x1={MARGIN.left}
              y1={yScale(tick)}
              x2={MARGIN.left + plotW}
              y2={yScale(tick)}
              className="stroke-border"
              strokeWidth={1}
            />
          ))}

          <line
            x1={MARGIN.left}
            y1={MARGIN.top + plotH}
            x2={MARGIN.left + plotW}
            y2={MARGIN.top + plotH}
            className="stroke-muted-foreground/40"
            strokeWidth={1}
          />
          <line
            x1={MARGIN.left}
            y1={MARGIN.top}
            x2={MARGIN.left}
            y2={MARGIN.top + plotH}
            className="stroke-muted-foreground/40"
            strokeWidth={1}
          />

          {xTicks.map((tick) => (
            <text
              key={`x-label-${tick}`}
              x={xScale(tick)}
              y={MARGIN.top + plotH + 20}
              textAnchor="middle"
              className="fill-muted-foreground font-normal"
              fontSize={14}
            >
              {xAxis.format(tick)}
            </text>
          ))}
          {yTicks.map((tick) => (
            <text
              key={`y-label-${tick}`}
              x={MARGIN.left - 12}
              y={yScale(tick)}
              textAnchor="end"
              dominantBaseline="central"
              className="fill-muted-foreground font-normal"
              fontSize={14}
            >
              {yAxis.format(tick)}
            </text>
          ))}

          <text
            x={MARGIN.left + plotW / 2}
            y={chartHeight - 12}
            textAnchor="middle"
            className="fill-muted-foreground font-normal"
            fontSize={14}
          >
            {xAxis.axisLabel ?? xAxis.label}
          </text>
          <g transform={`translate(16 ${MARGIN.top + plotH / 2}) rotate(-90)`}>
            <text
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-muted-foreground font-normal"
              fontSize={14}
            >
              {yAxis.label}
            </text>
          </g>

          {washPath ? (
            <path d={washPath} className="fill-foreground/[0.05]" />
          ) : null}

          {data.map((datum) => {
            const cx = xScale(datum.x);
            const cy = yScale(datum.y);
            const half = datum.onFrontier ? FRONTIER_DOT_HALF : DOT_HALF;
            const size = half * 2;
            const modelText = datum.label.model;
            const agentPart = datum.label.agent ? ` ${datum.label.agent}` : "";
            const whiskerClass = datum.onFrontier
              ? "stroke-foreground/70"
              : "stroke-muted-foreground/35";
            // Labels sit directly to the right of the marker, flipping to the
            // left only when the point is close to the right edge.
            const labelLeft = cx > MARGIN.left + plotW - 200;
            return (
              <g key={datum.id}>
                {datum.yCi != null ? (
                  <g style={{ pointerEvents: "none" }}>
                    <line
                      x1={cx}
                      x2={cx}
                      y1={yScale(Math.min(yMax, datum.y + datum.yCi))}
                      y2={yScale(Math.max(yMin, datum.y - datum.yCi))}
                      className={whiskerClass}
                      strokeWidth={1}
                    />
                    <line
                      x1={cx - 3.5}
                      x2={cx + 3.5}
                      y1={yScale(Math.min(yMax, datum.y + datum.yCi))}
                      y2={yScale(Math.min(yMax, datum.y + datum.yCi))}
                      className={whiskerClass}
                      strokeWidth={1}
                    />
                    <line
                      x1={cx - 3.5}
                      x2={cx + 3.5}
                      y1={yScale(Math.max(yMin, datum.y - datum.yCi))}
                      y2={yScale(Math.max(yMin, datum.y - datum.yCi))}
                      className={whiskerClass}
                      strokeWidth={1}
                    />
                  </g>
                ) : null}
                {/* Invisible hit target in SVG space (avoids HTML/SVG coordinate drift). */}
                <rect
                  x={cx - 14}
                  y={cy - 14}
                  width={28}
                  height={28}
                  className="fill-transparent"
                  style={{ cursor: "pointer" }}
                  onClick={() =>
                    window.open(
                      jobIdByRow?.[datum.id]
                        ? harborJobUrl(jobIdByRow[datum.id]!)
                        : harborLeaderboardRowUrl(
                            TERMINAL_BENCH_PACKAGE,
                            TERMINAL_BENCH_LEADERBOARD,
                            datum.id,
                            TERMINAL_BENCH_DATASET_VERSION,
                          ),
                      "_blank",
                      "noopener",
                    )
                  }
                  onMouseEnter={(event) => {
                    const svgBounds = (
                      event.currentTarget as SVGElement
                    ).ownerSVGElement!.getBoundingClientRect();
                    setActive({
                      id: datum.id,
                      label: [datum.label.model, datum.label.agent]
                        .filter(Boolean)
                        .join(" / "),
                      yValue: yAxis.format(datum.y),
                      ciValue:
                        datum.yCi != null
                          ? `\u00b1${datum.yCi.toFixed(1)}%`
                          : null,
                      xValue: xAxis.format(datum.x),
                      cx: event.clientX - svgBounds.left,
                      cy: event.clientY - svgBounds.top,
                    });
                    setTipOpen(true);
                  }}
                  onMouseMove={(event) => {
                    const svgBounds = (
                      event.currentTarget as SVGElement
                    ).ownerSVGElement!.getBoundingClientRect();
                    setActive(
                      (prev) =>
                        prev && {
                          ...prev,
                          cx: event.clientX - svgBounds.left,
                          cy: event.clientY - svgBounds.top,
                        },
                    );
                  }}
                  onMouseLeave={() => setTipOpen(false)}
                />
                <rect
                  x={cx - half}
                  y={cy - half}
                  width={size}
                  height={size}
                  className={
                    datum.onFrontier || active?.id === datum.id
                      ? "fill-foreground"
                      : "fill-muted-foreground/35"
                  }
                  style={{ pointerEvents: "none" }}
                />
                {hiddenLabelIds.has(datum.id) ? null : (
                  <text
                    x={labelLeft ? cx - half - 7 : cx + half + 7}
                    y={cy}
                    textAnchor={labelLeft ? "end" : "start"}
                    dominantBaseline="central"
                    className={
                      datum.onFrontier
                        ? "fill-foreground font-normal"
                        : "fill-muted-foreground/70 font-normal"
                    }
                    fontSize={LABEL_FONT}
                    style={{ pointerEvents: "none" }}
                  >
                    <tspan>{modelText}</tspan>
                    {agentPart ? (
                      <tspan
                        className={
                          datum.onFrontier
                            ? "fill-muted-foreground"
                            : "fill-muted-foreground/50"
                        }
                      >
                        {agentPart}
                      </tspan>
                    ) : null}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        <Tooltip
          open={tipOpen}
          onOpenChange={setTipOpen}
          onOpenChangeComplete={(open) => {
            // Keep anchor/content until the close animation finishes so it
            // doesn't jump to the top-left while fading out.
            if (!open) setActive(null);
          }}
        >
          <TooltipTrigger
            type="button"
            tabIndex={-1}
            delay={0}
            aria-hidden
            className="pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 opacity-0"
            style={{
              left: (active?.cx ?? 0) + 19,
              top: active?.cy ?? 0,
            }}
          />
          <TooltipContent
            side="bottom"
            align="start"
            sideOffset={10}
            variant="chart"
            className="pointer-events-none min-w-40"
          >
            {active ? (
              <div className="flex w-full flex-col">
                <p className="mb-1 font-semibold">{active.label}</p>
                <p className="flex items-baseline justify-between gap-6 opacity-70">
                  <span>
                    {active.yValue}
                    {active.ciValue ? ` ${active.ciValue}` : ""}
                  </span>
                  <span>{active.xValue}</span>
                </p>
                <p className="mt-1.5 border-t border-border pt-1.5 text-[10.5px] opacity-50">
                  click to view job
                </p>
              </div>
            ) : null}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
