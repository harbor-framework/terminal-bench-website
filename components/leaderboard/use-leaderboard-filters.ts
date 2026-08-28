'use client';

import { useQueryState } from 'nuqs';
import { useMemo } from 'react';

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

  const filteredRows = useMemo(() => {
    if (!data) return [];
    return applyLeaderboardFilters(
      data.rows,
      data.leaderboard.columns,
      filters,
      facets.numberBounds,
    );
  }, [data, facets.numberBounds, filters]);

  const toolbarColumns = useMemo(() => {
    if (!data) return [];
    return data.leaderboard.columns.map((column) => ({
      ...column,
      header:
        column.id === 'accuracy'
          ? 'RESOLUTION RATE'
          : column.header.toUpperCase(),
    }));
  }, [data]);

  return { facets, filters, handleFiltersChange, filteredRows, toolbarColumns };
}
