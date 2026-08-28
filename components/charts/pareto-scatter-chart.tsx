'use client';

import { useEffect, useRef, useState } from 'react';

import { chartRowLabel, type ChartRowLabel } from '@/components/charts/chart-labels';
import {
  PARETO_AXES,
  type ParetoAxisDef,
  type ParetoAxisId,
} from '@/components/charts/pareto-axes';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { LeaderboardRow } from '@/lib/leaderboard';

export type ParetoDatum = {
  id: string;
  label: ChartRowLabel;
  x: number;
  y: number;
  onFrontier: boolean;
};

const MIN_WIDTH = 480;
const HEIGHT = 580;
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

  if (axisId === 'release_date') {
    const day = 24 * 60 * 60 * 1000;
    return dateTicks(minV - day * 2, maxV + day * 2, 5);
  }

  let lo = minV - pad;
  let hi = maxV + pad;
  if (axisId === 'accuracy') {
    lo = Math.max(0, lo);
    hi = Math.min(100, hi);
  } else if (axisId === 'cost' || axisId === 'tokens') {
    lo = Math.max(0, lo);
  }

  return niceTicks(lo, hi, 5);
}

function isBetterOrEqual(
  a: number,
  b: number,
  prefer: ParetoAxisDef['prefer'],
): boolean {
  return prefer === 'max' ? a >= b : a <= b;
}

function isStrictlyBetter(
  a: number,
  b: number,
  prefer: ParetoAxisDef['prefer'],
): boolean {
  return prefer === 'max' ? a > b : a < b;
}

export function computeParetoFrontier(
  points: Omit<ParetoDatum, 'onFrontier'>[],
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
      return {
        id: row.id,
        label: chartRowLabel(row),
        x,
        y,
      };
    })
    .filter((row): row is Omit<ParetoDatum, 'onFrontier'> => row != null);

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
  className?: string;
};

type ActiveTip = {
  id: string;
  label: string;
  yValue: string;
  xValue: string;
  cx: number;
  cy: number;
};

export function ParetoScatterChart({
  data,
  xAxisId,
  yAxisId,
  className,
}: ParetoScatterChartProps) {
  const plotRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(MIN_WIDTH);
  const [active, setActive] = useState<ActiveTip | null>(null);
  const [tipOpen, setTipOpen] = useState(false);
  const xAxis = PARETO_AXES[xAxisId];
  const yAxis = PARETO_AXES[yAxisId];

  useEffect(() => {
    const el = plotRef.current;
    if (!el) return;

    const update = () => {
      setWidth(Math.max(MIN_WIDTH, Math.floor(el.clientWidth)));
    };
    update();

    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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
  const plotH = Math.max(0, HEIGHT - MARGIN.top - MARGIN.bottom);

  const xs = data.map((d) => d.x);
  const ys = data.map((d) => d.y);
  const xTicks = axisTicks(xAxisId, xs, 0.08);
  const yTicks = axisTicks(yAxisId, ys, 0.12);
  const xMin = xTicks[0]!;
  const xMax = xTicks[xTicks.length - 1]!;
  const yMin = yTicks[0]!;
  const yMax = yTicks[yTicks.length - 1]!;

  const xScale = (value: number) =>
    MARGIN.left + ((value - xMin) / (xMax - xMin || 1)) * plotW;
  const yScale = (value: number) =>
    MARGIN.top + (1 - (value - yMin) / (yMax - yMin || 1)) * plotH;

  const frontier = data.filter((d) => d.onFrontier).sort((a, b) => a.x - b.x);
  const frontierPath = frontier
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(d.x)} ${yScale(d.y)}`)
    .join(' ');

  return (
    <div className={className}>
      <div ref={plotRef} className="relative w-full overflow-hidden" style={{ height: HEIGHT }}>
      <svg
        viewBox={`0 0 ${width} ${HEIGHT}`}
        width={width}
        height={HEIGHT}
        role="img"
        aria-label={`Pareto scatter of ${yAxis.label} versus ${xAxis.label}`}
        className="block max-w-full"
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
            fontSize={12}
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
            fontSize={12}
          >
            {yAxis.format(tick)}
          </text>
        ))}

        <text
          x={MARGIN.left + plotW / 2}
          y={HEIGHT - 12}
          textAnchor="middle"
          className="fill-muted-foreground font-normal"
          fontSize={12}
        >
          {xAxis.label}
        </text>
        <g transform={`translate(16 ${MARGIN.top + plotH / 2}) rotate(-90)`}>
          <text
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-muted-foreground font-normal"
            fontSize={12}
          >
            {yAxis.label}
          </text>
        </g>

        {frontierPath ? (
          <path
            d={frontierPath}
            fill="none"
            className="stroke-foreground/50"
            strokeWidth={1.5}
          />
        ) : null}

        {data.map((datum) => {
          const cx = xScale(datum.x);
          const cy = yScale(datum.y);
          const half = datum.onFrontier ? FRONTIER_DOT_HALF : DOT_HALF;
          const size = half * 2;
          const modelText = datum.label.model;
          const agentPart = datum.label.agent
            ? ` (${datum.label.agent})`
            : '';
          // Place labels in the empty region above-left of the monotonic
          // up-right frontier so the frontier line doesn't run through them;
          // flip to the right only for points near the left edge, which would
          // otherwise clip past the y-axis.
          const labelLeft = cx > MARGIN.left + 96;
          return (
            <g key={datum.id}>
              {/* Invisible hit target in SVG space (avoids HTML/SVG coordinate drift). */}
              <rect
                x={cx - 14}
                y={cy - 14}
                width={28}
                height={28}
                className="fill-transparent"
                onMouseEnter={() => {
                  setActive({
                    id: datum.id,
                    label: datum.label.full,
                    yValue: yAxis.format(datum.y),
                    xValue: xAxis.format(datum.x),
                    cx,
                    cy,
                  });
                  setTipOpen(true);
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
                    ? 'fill-foreground'
                    : 'fill-muted-foreground/35'
                }
                style={{ pointerEvents: 'none' }}
              />
              {datum.onFrontier ? (
                <text
                  x={labelLeft ? cx - half - 6 : cx + half + 6}
                  y={cy - (half + 6)}
                  textAnchor={labelLeft ? 'end' : 'start'}
                  dominantBaseline="auto"
                  className="fill-foreground font-normal"
                  fontSize={11}
                  style={{ pointerEvents: 'none' }}
                >
                  <tspan>{modelText}</tspan>
                  {agentPart ? (
                    <tspan className="fill-muted-foreground">{agentPart}</tspan>
                  ) : null}
                </text>
              ) : null}
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
            left: active?.cx ?? 0,
            top: active?.cy ?? 0,
          }}
        />
        <TooltipContent side="top" sideOffset={10} className="min-w-40">
          {active ? (
            <div className="flex flex-col gap-0.5">
              <p>{active.label}</p>
              <p className="flex items-baseline justify-between gap-6 opacity-70">
                <span>{active.yValue}</span>
                <span>{active.xValue}</span>
              </p>
            </div>
          ) : null}
        </TooltipContent>
      </Tooltip>
      </div>
    </div>
  );
}
