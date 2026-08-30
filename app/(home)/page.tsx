import { TerminalIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';
import Link from 'next/link';
import { Suspense } from 'react';

import { HeroTitle } from '@/components/hero-title';
import { HomeView } from '@/components/home-view';
import { LeaderboardSkeleton } from '@/components/leaderboard/leaderboard-skeleton';
import { LeaderboardTable } from '@/components/leaderboard/leaderboard-table';
import {
  TaskActions,
  TaskActionsFallback,
} from '@/components/task-actions';
import { buttonVariants } from '@/components/ui/button';
import {
  TERMINAL_BENCH_LEADERBOARD,
  TERMINAL_BENCH_PACKAGE,
  fetchLeaderboard,
  leaderboardQueryKey,
} from '@/lib/leaderboard';

export default async function HomePage() {
  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: leaderboardQueryKey(
      TERMINAL_BENCH_PACKAGE,
      TERMINAL_BENCH_LEADERBOARD,
    ),
    queryFn: () =>
      fetchLeaderboard(TERMINAL_BENCH_PACKAGE, TERMINAL_BENCH_LEADERBOARD),
  });

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col pt-5 sm:pt-12">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-6">
        <div className="mx-auto flex w-full max-w-8xl flex-col items-center gap-4 px-4 text-center sm:gap-8">
          <div className="flex flex-col items-center gap-2">
            <Suspense
              fallback={
                <h1 className="max-w-full whitespace-nowrap px-1 text-[clamp(1.25rem,8.6vw,2.25rem)] font-normal tracking-tighter uppercase sm:text-5xl md:text-7xl">
                  TERMINAL-BENCH 4.0
                </h1>
              }
            >
              <HeroTitle />
            </Suspense>
            <p className="max-w-none text-lg font-normal tracking-tighter text-muted-foreground sm:whitespace-nowrap">
              A benchmark to measure and evolve with the frontier of agent work
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Link
              href="/run"
              className={buttonVariants({ variant: 'default', size: 'lg' })}
            >
              Run the benchmark
              <HugeiconsIcon icon={TerminalIcon} strokeWidth={2} />
            </Link>
            <Suspense fallback={<TaskActionsFallback />}>
              <TaskActions />
            </Suspense>
          </div>
        </div>

        <div
          id="home-view-section"
          className="w-full min-w-0 scroll-mt-[62px] px-4 md:px-8"
        >
          <HydrationBoundary state={dehydrate(queryClient)}>
            <Suspense fallback={<LeaderboardSkeleton />}>
              <HomeView leaderboard={<LeaderboardTable />} />
            </Suspense>
          </HydrationBoundary>
        </div>
      </div>
    </div>
  );
}
