import 'server-only';

import {
  HARBOR_HUB_URL,
  TERMINAL_BENCH_DATASET_VERSION,
  TERMINAL_BENCH_LEADERBOARD,
  TERMINAL_BENCH_PACKAGE,
} from '@/lib/leaderboard';
import type {
  WaffleDomain,
  WafflePayload,
  WaffleTask,
  WaffleTrial,
} from '@/lib/waffle';

const DEFAULT_SUPABASE_URL = 'https://ofhuhcpkvzjlejydnvyd.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_Z-vuQbpvpG-PStjbh4yE0Q_e-d3MTIH';
const PAGE_SIZE = 1_000;
const JOB_TRIAL_PAGE_SIZE = 5_000;

const TASK_DOMAIN = {
  'atrx-vep-crispr': 'Science',
  'batched-eval-parity': 'ML',
  'biped-contact-dynamics': 'Science',
  'bun-sourcemap-leak': 'Software',
  'cad-model': 'Hardware',
  'cargo-flight-dispatch': 'Operations',
  'cli-2ph-simplex': 'Software',
  'coq-block-bound': 'Science',
  'ctr-optimization': 'Operations',
  'cumulative-layout-shift': 'Software',
  'data-anonymization': 'Software',
  'distributed-dedup': 'Software',
  'embedding-drift-monitor': 'ML',
  'erp-procurement-planning': 'Operations',
  'exam-pdf-eval': 'ML',
  'fin-saccr-rwa': 'Operations',
  'fix-uautomizer-soundness': 'Software',
  'foodstuff-beta-activity': 'Science',
  'formal-crypto': 'Security',
  'fp8-rmsnorm-gemm': 'ML',
  'freecad-impeller': 'Hardware',
  'freecad-platform-drawing': 'Hardware',
  'freecad-spring-clip': 'Hardware',
  'freight-dispatch-shift': 'Operations',
  'glycan-ms2-elucidation': 'Science',
  'gpt2-codegolf': 'ML',
  'gsea-proteomics': 'Science',
  'heat-pump-warranty': 'Operations',
  'hof-topology-interpenetration': 'Science',
  'html-js-filter': 'Security',
  'ico-path-patch': 'Security',
  'interleaved-vigenere': 'Security',
  'intrastat-meldung': 'Operations',
  'jax-speedrun-gpu': 'ML',
  'ks-solver-cpp': 'Science',
  'kv-live-surgery': 'Software',
  'lake-temp-glm': 'Science',
  'layout-config-recreation': 'Media',
  'layout-config-recreation2': 'Media',
  'lean-midpoint-proof': 'Science',
  'legacy-utility-triage': 'Operations',
  'live-database-cutover': 'Software',
  'math-eval-grader': 'ML',
  'medical-claims-processing': 'Operations',
  'memcached-backdoor': 'Security',
  'mp-checkpoint-consolidation': 'ML',
  'music-harmony': 'Media',
  'mvcc-lsm-compaction': 'Software',
  'nextjs-performance': 'Software',
  'ontology-kg-querying': 'Software',
  'payments-pipeline-fix': 'Software',
  'photonic-waveguide-routing': 'Software',
  'pretrain-shard-corruption': 'ML',
  'production-planning': 'Operations',
  'protein-autointerp-disulfide': 'Science',
  'react-lead-form': 'Software',
  'retro-console-soc': 'Hardware',
  'risk-scorer-replay': 'ML',
  'roy-polymorph-cn': 'Science',
  'rs-archive-clone': 'Software',
  'satb-audio-transcription': 'Media',
  'session-window-debug': 'Software',
  'sglang-qwen-burst': 'ML',
  'shadow-relay': 'Security',
  'sound-change-cascade': 'Science',
  'takens-embedding-lean': 'Science',
  'telecom-entity-resolution': 'Software',
  'uefi-bootkit': 'Security',
  'vba-userform-port': 'Software',
  'vf2-speedup-networkx': 'Software',
  'vllm-deepseek-streaming': 'ML',
  'vpp-loss-divergence': 'ML',
  'wal-recovery-ordering': 'Software',
  'wdm-design': 'Science',
} as const;

type DomainName = (typeof TASK_DOMAIN)[keyof typeof TASK_DOMAIN] | 'Other';

function taskDomain(task: string): DomainName {
  // Older benchmarks include tasks outside the TB 4.0 domain map.
  return TASK_DOMAIN[task as keyof typeof TASK_DOMAIN] ?? 'Other';
}

type LeaderboardReadResponse = {
  leaderboard: {
    id: string;
    title: string;
    name: string;
  };
  rows: {
    id: string;
    n_trials: number;
    metadata?: {
      model_display?: { label?: string } | null;
      agent_display?: { label?: string } | null;
    } | null;
  }[];
};

type LeaderboardRowTrial = {
  row_id: string;
  trial_id: string;
};

type TrialJobRecord = {
  id: string;
  job_id: string | null;
};

type JobTrialSummary = {
  id: string;
  task_name: string | null;
  reward: number | string | null;
  error_type: string | null;
  hosted_error: string | null;
};

type JobTrialsResponse = {
  items?: JobTrialSummary[];
  total_pages?: number;
};

function supabaseUrl() {
  return (
    process.env.HARBOR_SUPABASE_URL ?? DEFAULT_SUPABASE_URL
  ).replace(/\/$/, '');
}

function publishableKey() {
  return (
    process.env.HARBOR_SUPABASE_PUBLISHABLE_KEY ??
    DEFAULT_SUPABASE_PUBLISHABLE_KEY
  );
}

function harborHeaders({ json = false, count = false } = {}) {
  const key = publishableKey();
  const headers: Record<string, string> = {
    apikey: key,
    Authorization: `Bearer ${key}`,
  };
  if (json) headers['Content-Type'] = 'application/json';
  if (count) headers.Prefer = 'count=exact';
  return headers;
}

function errorMessage(payload: unknown, status: number) {
  if (payload && typeof payload === 'object') {
    const objectPayload = payload as Record<string, unknown>;
    const nested = objectPayload.error;
    if (nested && typeof nested === 'object') {
      const message = (nested as Record<string, unknown>).message;
      if (typeof message === 'string' && message.length > 0) return message;
    }
    const message = objectPayload.message;
    if (typeof message === 'string' && message.length > 0) return message;
  }
  return `Harbor request failed (${status})`;
}

async function readJson<T>(
  path: string,
  init: RequestInit,
): Promise<{ data: T; response: Response }> {
  const response = await fetch(`${supabaseUrl()}${path}`, {
    ...init,
    cache: 'no-store',
  });
  const text = await response.text();
  const payload = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    throw new Error(errorMessage(payload, response.status));
  }

  return { data: payload as T, response };
}

async function readLeaderboard(
  packageName: string,
  leaderboardName: string,
): Promise<LeaderboardReadResponse> {
  const { data } = await readJson<LeaderboardReadResponse>(
    '/functions/v1/leaderboard-read',
    {
      method: 'POST',
      headers: harborHeaders({ json: true }),
      body: JSON.stringify({
        package: packageName,
        name: leaderboardName,
        page: 1,
        page_size: 200,
      }),
    },
  );
  return data;
}

async function readRowTrialPage(
  leaderboardId: string,
  offset: number,
  count = false,
): Promise<{ links: LeaderboardRowTrial[]; total: number | null }> {
  const params = new URLSearchParams({
    select: 'row_id,trial_id',
    leaderboard_id: `eq.${leaderboardId}`,
    limit: String(PAGE_SIZE),
    offset: String(offset),
  });
  const { data, response } = await readJson<LeaderboardRowTrial[]>(
    `/rest/v1/leaderboard_row_trial?${params.toString()}`,
    {
      method: 'GET',
      headers: harborHeaders({ count }),
    },
  );
  const total = count
    ? Number(response.headers.get('content-range')?.split('/').at(-1))
    : null;
  return {
    links: data,
    total: Number.isFinite(total) ? total : null,
  };
}

async function readAllRowTrialLinks(
  leaderboardId: string,
): Promise<LeaderboardRowTrial[]> {
  const first = await readRowTrialPage(leaderboardId, 0, true);
  const total = first.total ?? first.links.length;
  const offsets: number[] = [];
  for (let offset = PAGE_SIZE; offset < total; offset += PAGE_SIZE) {
    offsets.push(offset);
  }

  const pages = await Promise.all(
    offsets.map((offset) => readRowTrialPage(leaderboardId, offset)),
  );

  return [
    ...first.links,
    ...pages.flatMap((page) => page.links),
  ];
}

async function readJobIdsForTrials(
  trialIds: string[],
): Promise<Map<string, string>> {
  if (trialIds.length === 0) return new Map();

  const params = new URLSearchParams({
    select: 'id,job_id',
    id: `in.(${trialIds.join(',')})`,
  });
  const { data } = await readJson<TrialJobRecord[]>(
    `/rest/v1/trial?${params.toString()}`,
    {
      method: 'GET',
      headers: harborHeaders(),
    },
  );

  return new Map(
    data
      .filter((row): row is { id: string; job_id: string } =>
        typeof row.job_id === 'string' && row.job_id.length > 0,
      )
      .map((row) => [row.id, row.job_id]),
  );
}

async function readJobTrials(jobIds: string[]): Promise<JobTrialSummary[]> {
  if (jobIds.length === 0) return [];

  const items: JobTrialSummary[] = [];
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages) {
    const { data } = await readJson<JobTrialsResponse>(
      '/rest/v1/rpc/get_job_trials',
      {
        method: 'POST',
        headers: harborHeaders({ json: true }),
        body: JSON.stringify({
          p_job_ids: jobIds,
          p_page: page,
          p_page_size: JOB_TRIAL_PAGE_SIZE,
          p_attempts: 'latest',
          p_sort_by: 'task_name',
          p_sort_order: 'asc',
        }),
      },
    );
    items.push(...(data.items ?? []));
    totalPages = data.total_pages ?? 1;
    page += 1;
  }

  return items;
}

function linksByRow(links: LeaderboardRowTrial[]) {
  const result = new Map<string, string[]>();
  for (const link of links) {
    const rowLinks = result.get(link.row_id) ?? [];
    rowLinks.push(link.trial_id);
    result.set(link.row_id, rowLinks);
  }
  return result;
}

function plainTaskName(taskName: string | null) {
  return String(taskName ?? '').split('/').at(-1) ?? '';
}

function rewardPassed(value: JobTrialSummary['reward']) {
  const reward =
    typeof value === 'number' ? value : Number.parseFloat(String(value ?? 0));
  return Number.isFinite(reward) && reward > 0;
}

function errorBucket(trial: JobTrialSummary): 'timeout' | 'error' | null {
  const error = [trial.error_type, trial.hosted_error]
    .filter(Boolean)
    .map(String)
    .join(' ');
  if (!error) return null;
  return error.toLowerCase().includes('timeout') ? 'timeout' : 'error';
}

const OUTCOME_RANK = { p: 0, to: 1, err: 2, f: 3 } as const;

function buildWaffleData({
  leaderboard,
  rows,
  rowTrialIds,
  trials,
  jobs,
  jobIdByRow,
}: {
  leaderboard: LeaderboardReadResponse['leaderboard'];
  rows: LeaderboardReadResponse['rows'];
  rowTrialIds: Map<string, string[]>;
  trials: JobTrialSummary[];
  jobs: string[];
  jobIdByRow: Map<string, string | null>;
}): WafflePayload {
  const trialById = new Map(trials.map((trial) => [trial.id, trial]));
  const countsByTask = new Map<
    string,
    Pick<WaffleTask, 'p' | 'f' | 'e_to' | 'e_err' | 'ts'>
  >();
  let trialCount = 0;

  for (const row of rows) {
    const model = row.metadata?.model_display?.label ?? '';
    const agent = row.metadata?.agent_display?.label ?? '';
    const identity = [model, agent].filter(Boolean).join(' / ');
    const rowKey = row.id.slice(0, 8);
    const jobId = jobIdByRow.get(row.id) ?? null;

    for (const trialId of rowTrialIds.get(row.id) ?? []) {
      const trial = trialById.get(trialId);
      if (!trial) {
        throw new Error(`Trial ${trialId} is missing from Harbor summaries`);
      }

      const task = plainTaskName(trial.task_name);

      trialCount += 1;
      const counts = countsByTask.get(task) ?? {
        p: 0,
        f: 0,
        e_to: 0,
        e_err: 0,
        ts: [],
      };

      let outcome: WaffleTrial['o'] = 'f';
      if (rewardPassed(trial.reward)) {
        counts.p += 1;
        outcome = 'p';
      } else {
        const bucket = errorBucket(trial);
        if (bucket === 'timeout') {
          counts.e_to += 1;
          outcome = 'to';
        } else if (bucket === 'error') {
          counts.e_err += 1;
          outcome = 'err';
        } else {
          counts.f += 1;
        }
      }

      counts.ts.push({
        o: outcome,
        m: identity,
        r: rowKey,
        id: trial.id,
        j: jobId,
        e: trial.error_type ?? trial.hosted_error ?? null,
      });

      countsByTask.set(task, counts);
    }
  }

  for (const counts of countsByTask.values()) {
    counts.ts.sort((left, right) => OUTCOME_RANK[left.o] - OUTCOME_RANK[right.o]);
  }

  const tasksByDomain = new Map<DomainName, WaffleTask[]>();
  for (const [task, counts] of countsByTask) {
    const domain = taskDomain(task);
    const total = counts.p + counts.f + counts.e_to + counts.e_err;
    const solve = total > 0 ? Math.round((counts.p / total) * 100) : 0;
    const tasks = tasksByDomain.get(domain) ?? [];
    tasks.push({ task, solve, ...counts });
    tasksByDomain.set(domain, tasks);
  }

  const doms: WaffleDomain[] = [...tasksByDomain.entries()].map(
    ([name, tasks]) => {
    tasks.sort((left, right) => {
      const solveDelta = right.solve - left.solve;
      return solveDelta || left.task.localeCompare(right.task);
    });

    const total = tasks.reduce(
      (sum, task) => sum + task.p + task.f + task.e_to + task.e_err,
      0,
    );
    const passed = tasks.reduce((sum, task) => sum + task.p, 0);
      return {
        name,
        solve: total > 0 ? Math.round((passed / total) * 100) : 0,
        n: tasks.length,
        tasks,
      };
    },
  );

  doms.sort((left, right) => {
    const solveDelta = right.solve - left.solve;
    return solveDelta || left.name.localeCompare(right.name);
  });

  return {
    doms,
    jobs,
    leaderboard: {
      title: leaderboard.title || 'Terminal-Bench',
      name: leaderboard.name || TERMINAL_BENCH_LEADERBOARD,
    },
    row_count: rows.length,
    trial_count: trialCount,
    task_count: countsByTask.size,
    source: {
      leaderboard_url: `${HARBOR_HUB_URL}/datasets/terminal-bench/terminal-bench/${TERMINAL_BENCH_DATASET_VERSION}?tab=leaderboard`,
      leaderboard_ref: `${TERMINAL_BENCH_PACKAGE}/${TERMINAL_BENCH_LEADERBOARD}`,
      include_trajectories: false,
      fetched_at: new Date().toISOString(),
    },
    score_policy: 'reward > 0, matching the Harbor Hub leaderboard accuracy',
  };
}

export async function readTerminalBenchWaffle(
  packageName: string = TERMINAL_BENCH_PACKAGE,
  leaderboardName: string = TERMINAL_BENCH_LEADERBOARD,
): Promise<WafflePayload> {
  const leaderboardPayload = await readLeaderboard(
    packageName,
    leaderboardName,
  );
  if (leaderboardPayload.rows.length === 0) {
    throw new Error('No leaderboard rows returned');
  }

  const rowTrialLinks = await readAllRowTrialLinks(
    leaderboardPayload.leaderboard.id,
  );
  const rowTrialIds = linksByRow(rowTrialLinks);
  const firstTrialIds = leaderboardPayload.rows
    .map((row) => rowTrialIds.get(row.id)?.[0])
    .filter((id): id is string => Boolean(id));
  const jobIdByTrial = await readJobIdsForTrials(firstTrialIds);
  const jobs = [
    ...new Set(
      firstTrialIds
        .map((trialId) => jobIdByTrial.get(trialId))
        .filter((jobId): jobId is string => Boolean(jobId)),
    ),
  ];
  const trials = await readJobTrials(jobs);
  const jobIdByRow = new Map(
    leaderboardPayload.rows.map((row) => {
      const firstTrialId = rowTrialIds.get(row.id)?.[0];
      return [
        row.id,
        firstTrialId ? (jobIdByTrial.get(firstTrialId) ?? null) : null,
      ] as const;
    }),
  );

  return buildWaffleData({
    leaderboard: leaderboardPayload.leaderboard,
    rows: leaderboardPayload.rows,
    rowTrialIds,
    trials,
    jobs,
    jobIdByRow,
  });
}
