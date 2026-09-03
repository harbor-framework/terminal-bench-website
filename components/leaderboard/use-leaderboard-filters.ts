'use client';

import { parseAsStringLiteral, useQueryState } from 'nuqs';
import { useMemo } from 'react';

import { chartRowLabel } from '@/components/charts/chart-labels';
import {
  applyLeaderboardFilters,
  buildFilterFacets,
  type LeaderboardFilters,
} from '@/components/leaderboard/leaderboard-toolbar';
import type { LeaderboardReadResponse } from '@/lib/leaderboard';
import {
  fromUrlFilters,
  leaderboardFiltersParser,
  toUrlFilters,
} from '@/lib/leaderboard-url-state';

const EFFORT_MODES = ['best', 'all'] as const;
export type EffortMode = (typeof EFFORT_MODES)[number];

/** Keep only the best-scoring reasoning effort per model+agent pair. */
export function keepBestEffortRows<
  Row extends { metrics?: Record<string, unknown> } & Parameters<
    typeof chartRowLabel
  >[0],
>(rows: Row[]): Row[] {
  const bestByPair = new Map<string, Row>();
  const accuracyOf = (row: Row | undefined) =>
    Number(row?.metrics?.accuracy ?? Number.NEGATIVE_INFINITY);
  for (const row of rows) {
    const label = chartRowLabel(row);
    const key = `${label.model} / ${label.agent}`;
    const previous = bestByPair.get(key);
    if (!previous || accuracyOf(row) > accuracyOf(previous))
      bestByPair.set(key, row);
  }
  const kept = rows.filter((row) => {
    const label = chartRowLabel(row);
    return bestByPair.get(`${label.model} / ${label.agent}`) === row;
  });
  // Renumber ranks (competition style, ties share) now that rows are gone.
  let lastAccuracy = Number.NaN;
  let lastRank = 0;
  return kept.map((row, index) => {
    const accuracy = accuracyOf(row);
    const rank = accuracy === lastAccuracy ? lastRank : index + 1;
    lastAccuracy = accuracy;
    lastRank = rank;
    return { ...row, rank };
  });
}

/**
 * Whether to show every reasoning-effort submission or only the best-scoring
 * one per model+agent pair (the default).
 */
export function useEffortMode() {
  return useQueryState(
    'efforts',
    parseAsStringLiteral(EFFORT_MODES).withDefault('best'),
  );
}

/**
 * Shared URL-backed leaderboard filter state, so the pareto and waffle views
 * scope to the same `filters` query param as the leaderboard table.
 */
export function useLeaderboardFilters(
  data: LeaderboardReadResponse | undefined,
) {
  const facets = useMemo(() => {
    if (!data) {
      return { numberBounds: {}, dateBounds: {}, setOptions: {} };
    }
    return buildFilterFacets(data.leaderboard.columns, data.rows);
  }, [data]);

  const [urlFilters, setUrlFilters] = useQueryState(
    'filters',
    leaderboardFiltersParser,
  );

  const filters = useMemo(
    () => fromUrlFilters(urlFilters, facets.numberBounds),
    [facets.numberBounds, urlFilters],
  );

  function handleFiltersChange(next: LeaderboardFilters) {
    void setUrlFilters(toUrlFilters(next, facets.numberBounds));
  }

  const [effortMode] = useEffortMode();
  const filteredRows = useMemo(() => {
    if (!data) return [];
    const rows = applyLeaderboardFilters(
      data.rows,
      data.leaderboard.columns,
      filters,
      facets.numberBounds,
    );
    return effortMode === 'all' ? rows : keepBestEffortRows(rows);
  }, [data, effortMode, facets.numberBounds, filters]);

  const toolbarColumns = useMemo(() => {
    if (!data) return [];
    return data.leaderboard.columns.map((column) => ({
      ...column,
      header:
        column.id === 'accuracy'
          ? 'RESOLUTION RATE'
          : column.id === 'reasoning_effort'
            ? 'REASONING'
            : column.header.toUpperCase(),
    }));
  }, [data]);

  return { facets, filters, handleFiltersChange, filteredRows, toolbarColumns };
}
