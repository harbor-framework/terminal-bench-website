import { getAccessorValue, type LeaderboardRow } from '@/lib/leaderboard';

export const PARETO_AXIS_IDS = [
  'accuracy',
  'cost',
  'tokens',
  'release_date',
] as const;

export type ParetoAxisId = (typeof PARETO_AXIS_IDS)[number];

export type ParetoAxisDef = {
  id: ParetoAxisId;
  label: string;
  /** Prefer higher (`max`) or lower (`min`) values on the Pareto frontier. */
  prefer: 'max' | 'min';
  format: (value: number) => string;
  read: (row: LeaderboardRow) => number | null;
};

function formatCost(value: number): string {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

function formatTokens(value: number): string {
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}k`;
  return value.toFixed(0);
}

function formatAccuracy(value: number): string {
  return `${value.toFixed(0)}%`;
}

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** Locale-stable date labels for SSR/client hydration. */
function formatReleaseDate(value: number): string {
  const date = new Date(value);
  return `${SHORT_MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

function readNumber(row: LeaderboardRow, accessor: string): number | null {
  const value = getAccessorValue(row, accessor);
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return value;
}

function readDateMs(row: LeaderboardRow, accessor: string): number | null {
  const value = getAccessorValue(row, accessor);
  if (typeof value !== 'string' || !value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

export const PARETO_AXES: Record<ParetoAxisId, ParetoAxisDef> = {
  accuracy: {
    id: 'accuracy',
    label: 'Accuracy',
    prefer: 'max',
    format: formatAccuracy,
    read: (row) => readNumber(row, 'metrics.accuracy'),
  },
  cost: {
    id: 'cost',
    label: 'Cost',
    prefer: 'min',
    format: formatCost,
    read: (row) => {
      const value = readNumber(row, 'metrics.total_cost_usd');
      return value != null && value > 0 ? value : null;
    },
  },
  tokens: {
    id: 'tokens',
    label: 'Tokens',
    prefer: 'min',
    format: formatTokens,
    read: (row) => {
      const value = readNumber(row, 'metrics.total_tokens');
      return value != null && value > 0 ? value : null;
    },
  },
  release_date: {
    id: 'release_date',
    label: 'Release Date',
    prefer: 'min',
    format: formatReleaseDate,
    read: (row) =>
      readDateMs(row, 'metadata.release_date') ??
      readDateMs(row, 'metadata.date'),
  },
};

/** X is the selectable tradeoff axis; Y is always accuracy. */
export const PARETO_X_AXIS_IDS = ['cost', 'tokens', 'release_date'] as const;

export type ParetoXAxisId = (typeof PARETO_X_AXIS_IDS)[number];
export type ParetoYAxisId = 'accuracy';

export const DEFAULT_PARETO_X: ParetoXAxisId = 'cost';
export const DEFAULT_PARETO_Y: ParetoYAxisId = 'accuracy';

export function isParetoXAxisId(value: string): value is ParetoXAxisId {
  return (PARETO_X_AXIS_IDS as readonly string[]).includes(value);
}
