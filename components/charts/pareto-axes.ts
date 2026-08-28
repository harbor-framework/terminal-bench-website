import { getAccessorValue, type LeaderboardRow } from '@/lib/leaderboard';

export const PARETO_AXIS_IDS = [
  'accuracy',
  'cost',
  'tokens',
  'time',
  'release_date',
] as const;

export type ParetoAxisId = (typeof PARETO_AXIS_IDS)[number];

export type ParetoAxisDef = {
  id: ParetoAxisId;
  label: string;
  /** Longer label for the chart axis when it differs from the dropdown label. */
  axisLabel?: string;
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

function formatDuration(value: number): string {
  if (value >= 36000) return `${Math.round(value / 3600)}h`;
  if (value >= 3600) {
    const hours = Math.floor(value / 3600);
    const minutes = Math.round((value % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
  if (value >= 60) return `${Math.round(value / 60)}m`;
  return `${Math.round(value)}s`;
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
    label: 'Resolution Rate',
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
  time: {
    id: 'time',
    label: 'Time',
    prefer: 'min',
    format: formatDuration,
    read: (row) => {
      const average = readNumber(row, 'metrics.avg_trial_duration_sec');
      const trials = readNumber(row, 'metrics.n_trials');
      if (average == null || average <= 0) return null;
      return trials != null && trials > 0 ? average * trials : average;
    },
  },
  release_date: {
    id: 'release_date',
    label: 'Release',
    axisLabel: 'Release Date',
    prefer: 'min',
    format: formatReleaseDate,
    read: (row) =>
      readDateMs(row, 'metadata.release_date') ??
      readDateMs(row, 'metadata.date'),
  },
};

/** X is the selectable tradeoff axis; Y is always resolution rate. */
export const PARETO_X_AXIS_IDS = ['cost', 'tokens', 'time', 'release_date'] as const;

export type ParetoXAxisId = (typeof PARETO_X_AXIS_IDS)[number];
export type ParetoYAxisId = 'accuracy';

export const DEFAULT_PARETO_X: ParetoXAxisId = 'cost';
export const DEFAULT_PARETO_Y: ParetoYAxisId = 'accuracy';

export function isParetoXAxisId(value: string): value is ParetoXAxisId {
  return (PARETO_X_AXIS_IDS as readonly string[]).includes(value);
}
