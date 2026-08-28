import { ArrowUpRight03Icon, TerminalIcon } from '@hugeicons/core-free-icons';
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
    <div className="mx-auto flex w-full min-w-0 max-w-8xl flex-1 flex-col px-4 pt-12">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-6">
        <div className="flex flex-col items-center gap-8 text-center">
          <div className="flex flex-col items-center gap-5">
            <HeroTitle />
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
            <Link
              href="/news"
              className={buttonVariants({ variant: 'secondary', size: 'lg' })}
            >
              Read the blog
              <HugeiconsIcon icon={ArrowUpRight03Icon} strokeWidth={2} />
            </Link>
          </div>
        </div>

        <HydrationBoundary state={dehydrate(queryClient)}>
          <Suspense fallback={<LeaderboardSkeleton />}>
            <HomeView leaderboard={<LeaderboardTable />} />
          </Suspense>
        </HydrationBoundary>
      </div>
    </div>
  );
}
