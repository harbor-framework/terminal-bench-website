export type JsonObject = Record<string, unknown>;

export type LeaderboardColumnType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'date'
  | 'markdown'
  | 'link';

export type LeaderboardColumn = {
  id: string;
  header: string;
  accessor: string;
  type: LeaderboardColumnType;
  display_accessor?: string | null;
  display_type?: LeaderboardColumnType | null;
  align?: 'left' | 'center' | 'right';
  description?: string;
  enable_sorting?: boolean | null;
};

export type LeaderboardRow = {
  id: string;
  leaderboard_id: string;
  rank: number | null;
  metadata: JsonObject;
  metrics: JsonObject;
  status: 'display' | 'hide';
  created_at: string;
  updated_at: string;
  n_trials: number;
};

export type LeaderboardReadResponse = {
  leaderboard: {
    id: string;
    package_id: string;
    package: string | null;
    dataset_version_ids: string[];
    name: string;
    title: string;
    description: string | null;
    columns: LeaderboardColumn[];
    visibility: 'public' | 'private';
    created_at: string;
    updated_at: string;
  };
  rows: LeaderboardRow[];
  pagination?: {
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
  };
};

/** Hub dataset package backing the leaderboard. */
export const TERMINAL_BENCH_PACKAGE = 'terminal-bench/terminal-bench';

/** Benchmarks selectable on the homepage leaderboard (?benchmark=<id>). */
export type HomeBenchmark = {
  id: string;
  label: string;
  package: string;
  leaderboard: string;
};

export const HOME_BENCHMARKS: HomeBenchmark[] = [
  {
    id: '4.0',
    label: 'Terminal-Bench 4.0',
    package: 'terminal-bench/terminal-bench',
    leaderboard: '4-0-0',
  },
  {
    id: '3.0',
    label: 'Terminal-Bench 3.0',
    package: 'terminal-bench/terminal-bench',
    leaderboard: '3-0-0',
  },
  {
    id: '2.1',
    label: 'Terminal-Bench 2.1',
    package: 'terminal-bench/terminal-bench-2-1',
    leaderboard: 'main',
  },
  {
    id: '2.0',
    label: 'Terminal-Bench 2.0',
    package: 'terminal-bench/terminal-bench-2',
    leaderboard: '2-0',
  },
];

export const DEFAULT_HOME_BENCHMARK_ID = '4.0';

export function homeBenchmarkById(id: string): HomeBenchmark {
  return (
    HOME_BENCHMARKS.find((benchmark) => benchmark.id === id) ??
    HOME_BENCHMARKS[0]!
  );
}
/** Hub dataset version backing the homepage leaderboard. */
export const TERMINAL_BENCH_DATASET_VERSION = '4';
/** Hub path is org/package/leaderboard. */
export const TERMINAL_BENCH_LEADERBOARD = '4-0-0';
export const HARBOR_HUB_URL = 'https://hub.harborframework.com';
/** Public Harbor Hub edge-function host (leaderboard-read does not require auth). */
export const HARBOR_HUB_FUNCTIONS_URL =
  'https://ofhuhcpkvzjlejydnvyd.supabase.co';

export const leaderboardQueryKey = (
  packageName: string,
  name: string,
) => ['leaderboard', packageName, name] as const;

/** Harbor Hub dataset page for a package. */
export function harborDatasetUrl(
  packageName: string,
  version = 'latest',
): string {
  const [org, name] = packageName.split('/');
  return `${HARBOR_HUB_URL}/datasets/${encodeURIComponent(org)}/${encodeURIComponent(name)}/${encodeURIComponent(version)}`;
}

/** Harbor Hub detail page for a leaderboard row. */
export function harborLeaderboardRowUrl(
  packageName: string,
  leaderboardName: string,
  rowId: string,
  version = 'latest',
): string {
  const [org, name] = packageName.split('/');
  return `${HARBOR_HUB_URL}/datasets/${encodeURIComponent(org)}/${encodeURIComponent(name)}/${encodeURIComponent(version)}/leaderboards/${encodeURIComponent(leaderboardName)}/rows/${encodeURIComponent(rowId)}`;
}

export async function fetchLeaderboard(
  packageName: string,
  name: string,
): Promise<LeaderboardReadResponse> {
  const response = await fetch(
    `${HARBOR_HUB_FUNCTIONS_URL}/functions/v1/leaderboard-read`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        package: packageName,
        name,
      }),
    },
  );

  const payload = (await response.json()) as
    | LeaderboardReadResponse
    | { error?: { message?: string; code?: string } };

  if (!response.ok) {
    const message =
      'error' in payload && payload.error?.message
        ? payload.error.message
        : `leaderboard-read failed (${response.status})`;
    throw new Error(message);
  }

  return payload as LeaderboardReadResponse;
}

export function getAccessorValue(
  row: LeaderboardRow,
  accessor: string,
): unknown {
  const [root, ...path] = accessor.split('.');
  let value: unknown =
    root === 'metadata'
      ? row.metadata
      : root === 'metrics'
        ? row.metrics
        : null;

  for (const segment of path) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    value = (value as JsonObject)[segment];
  }

  return value;
}

export type LeaderboardLinkValue = {
  url: string;
  label: string;
};

export function parseLeaderboardLink(
  value: unknown,
): LeaderboardLinkValue | null {
  if (typeof value !== 'object' || value === null) return null;
  const url = 'url' in value ? (value as { url: unknown }).url : null;
  const label = 'label' in value ? (value as { label: unknown }).label : null;
  if (typeof url !== 'string' || !url) return null;
  if (typeof label !== 'string' || !label) return null;
  return { url, label };
}

export function formatLeaderboardCell(
  value: unknown,
  type: LeaderboardColumnType,
): string {
  if (value == null || value === '') return '—';

  switch (type) {
    case 'boolean':
      return value ? 'Yes' : 'No';
    case 'number': {
      if (typeof value !== 'number' || Number.isNaN(value)) return String(value);
      return Number.isInteger(value)
        ? value.toLocaleString('en-US')
        : value.toLocaleString('en-US', { maximumFractionDigits: 2 });
    }
    case 'markdown':
      return String(value).replace(/\*\*(.*?)\*\*/g, '$1');
    case 'link': {
      const link = parseLeaderboardLink(value);
      return link?.label ?? String(value);
    }
    case 'date':
    case 'text':
      return String(value);
    default: {
      const _exhaustive: never = type;
      return String(_exhaustive);
    }
  }
}
