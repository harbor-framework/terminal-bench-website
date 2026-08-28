import { parseAsArrayOf, parseAsJson, parseAsString } from 'nuqs';

import type { LeaderboardFilters } from '@/components/leaderboard/leaderboard-toolbar';

export type UrlLeaderboardFilters = {
  numbers?: Record<string, { min: number; max: number }>;
  dates?: Record<string, { from?: string; to?: string }>;
  sets?: Record<string, string[]>;
};

type NumberBounds = Record<string, { min: number; max: number }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseNumberFilter(
  value: unknown,
): { min: number; max: number } | null {
  if (!isRecord(value)) return null;
  if (typeof value.min !== 'number' || typeof value.max !== 'number') {
    return null;
  }
  return { min: value.min, max: value.max };
}

function parseDateFilter(
  value: unknown,
): { from?: string; to?: string } | null {
  if (!isRecord(value)) return null;
  const from =
    typeof value.from === 'string' && value.from ? value.from : undefined;
  const to = typeof value.to === 'string' && value.to ? value.to : undefined;
  if (!from && !to) return null;
  return { from, to };
}

function parseSetFilter(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const values = value.filter((item): item is string => typeof item === 'string');
  return values.length > 0 ? values : null;
}

function parseUrlFilters(value: unknown): UrlLeaderboardFilters | null {
  if (!isRecord(value)) return null;

  const numbers: NonNullable<UrlLeaderboardFilters['numbers']> = {};
  const dates: NonNullable<UrlLeaderboardFilters['dates']> = {};
  const sets: NonNullable<UrlLeaderboardFilters['sets']> = {};

  if (isRecord(value.numbers)) {
    for (const [id, range] of Object.entries(value.numbers)) {
      const parsed = parseNumberFilter(range);
      if (parsed) numbers[id] = parsed;
    }
  }

  if (isRecord(value.dates)) {
    for (const [id, range] of Object.entries(value.dates)) {
      const parsed = parseDateFilter(range);
      if (parsed) dates[id] = parsed;
    }
  }

  if (isRecord(value.sets)) {
    for (const [id, values] of Object.entries(value.sets)) {
      const parsed = parseSetFilter(values);
      if (parsed) sets[id] = parsed;
    }
  }

  return { numbers, dates, sets };
}

export const leaderboardFiltersParser = parseAsJson(parseUrlFilters).withDefault(
  {},
);

/** Hidden unless the user turns them back on in the columns picker.
 * pr_url/reward_hacks exist only on TB 2.1; hiding them keeps the default
 * column set identical across every benchmark in the selector. */
export const DEFAULT_HIDDEN_COLUMNS = [
  'agent_org',
  'model_org',
  'pr_url',
  'reward_hacks',
] as const;

export const hiddenColumnsParser = parseAsArrayOf(parseAsString)
  .withDefault([...DEFAULT_HIDDEN_COLUMNS])
  .withOptions({ clearOnDefault: true });

/** Keep only active filters for a compact shareable URL. */
export function toUrlFilters(
  filters: LeaderboardFilters,
  numberBounds: NumberBounds,
): UrlLeaderboardFilters | null {
  const numbers: NonNullable<UrlLeaderboardFilters['numbers']> = {};
  const dates: NonNullable<UrlLeaderboardFilters['dates']> = {};
  const sets: NonNullable<UrlLeaderboardFilters['sets']> = {};

  for (const [id, range] of Object.entries(filters.numbers)) {
    const bounds = numberBounds[id];
    if (!bounds) continue;
    if (range.min > bounds.min || range.max < bounds.max) {
      numbers[id] = range;
    }
  }

  for (const [id, range] of Object.entries(filters.dates)) {
    if (range.from || range.to) dates[id] = range;
  }

  for (const [id, values] of Object.entries(filters.sets)) {
    if (values.length > 0) sets[id] = values;
  }

  const hasNumbers = Object.keys(numbers).length > 0;
  const hasDates = Object.keys(dates).length > 0;
  const hasSets = Object.keys(sets).length > 0;
  if (!hasNumbers && !hasDates && !hasSets) return null;

  return {
    ...(hasNumbers ? { numbers } : {}),
    ...(hasDates ? { dates } : {}),
    ...(hasSets ? { sets } : {}),
  };
}

export function fromUrlFilters(
  urlFilters: UrlLeaderboardFilters,
  numberBounds: NumberBounds,
): LeaderboardFilters {
  const numbers: LeaderboardFilters['numbers'] = {};
  for (const [id, bounds] of Object.entries(numberBounds)) {
    numbers[id] = urlFilters.numbers?.[id] ?? {
      min: bounds.min,
      max: bounds.max,
    };
  }

  return {
    numbers,
    dates: urlFilters.dates ?? {},
    sets: urlFilters.sets ?? {},
  };
}
