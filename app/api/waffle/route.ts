import { NextResponse } from 'next/server';

import { readTerminalBenchWaffle } from '@/lib/harbor-waffle.server';
import {
  DEFAULT_HOME_BENCHMARK_ID,
  homeBenchmarkById,
} from '@/lib/leaderboard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CACHE_CONTROL =
  process.env.NODE_ENV === 'development'
    ? 'no-store'
    : 'public, s-maxage=300, stale-while-revalidate=3600';

export async function GET(request: Request) {
  try {
    const benchmarkId =
      new URL(request.url).searchParams.get('version') ??
      DEFAULT_HOME_BENCHMARK_ID;
    const benchmark = homeBenchmarkById(benchmarkId);
    const payload = await readTerminalBenchWaffle(
      benchmark.package,
      benchmark.leaderboard,
    );
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': CACHE_CONTROL },
    });
  } catch (error) {
    console.error(
      'Failed to load the Terminal-Bench waffle chart:',
      error instanceof Error ? error.message : error,
    );
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    return NextResponse.json(
      {
        error: {
          message: timedOut
            ? 'Loading trials timed out. Please refresh to try again.'
            : 'Failed to load Terminal-Bench waffle data',
          code: timedOut ? 'upstream_timeout' : 'upstream_error',
        },
      },
      { status: timedOut ? 504 : 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
