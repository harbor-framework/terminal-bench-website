'use client';

import { useQuery } from '@tanstack/react-query';

import { HARBOR_HUB_URL } from '@/lib/leaderboard';

const SUPABASE_URL = 'https://ofhuhcpkvzjlejydnvyd.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Z-vuQbpvpG-PStjbh4yE0Q_e-d3MTIH';

/**
 * Leaderboard rows are 1-1 with Hub jobs, but leaderboard-read does not expose
 * the job id. Resolve it per row through the first linked trial's job_id.
 */
async function fetchRowJobIds(
  rowIds: string[],
): Promise<Record<string, string>> {
  const headers = {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
  };

  const entries = await Promise.all(
    rowIds.map(async (rowId): Promise<[string, string] | null> => {
      const params = new URLSearchParams({
        select: 'trial(job_id)',
        row_id: `eq.${rowId}`,
        limit: '1',
      });
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/leaderboard_row_trial?${params.toString()}`,
        { headers },
      );
      if (!response.ok) return null;
      const links = (await response.json()) as {
        trial?: { job_id?: string | null } | null;
      }[];
      const jobId = links[0]?.trial?.job_id;
      return typeof jobId === 'string' && jobId.length > 0
        ? [rowId, jobId]
        : null;
    }),
  );

  return Object.fromEntries(
    entries.filter((entry): entry is [string, string] => entry !== null),
  );
}

export function harborJobUrl(jobId: string): string {
  return `${HARBOR_HUB_URL}/jobs/${encodeURIComponent(jobId)}`;
}

/** Row id -> Hub job id for the given leaderboard rows. */
export function useRowJobIds(rowIds: string[]): Record<string, string> {
  const { data } = useQuery({
    queryKey: ['row-jobs', ...[...rowIds].sort()],
    queryFn: () => fetchRowJobIds(rowIds),
    enabled: rowIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
  return data ?? {};
}
