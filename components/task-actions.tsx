'use client';

import { ArrowRight02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

import { useHomeBenchmark } from '@/components/leaderboard/benchmark-select';
import { buttonVariants } from '@/components/ui/button';
import {
  DEFAULT_HOME_BENCHMARK_ID,
  harborDatasetUrl,
  homeBenchmarkById,
  type HomeBenchmark,
} from '@/lib/leaderboard';

function tasksUrl(benchmark: HomeBenchmark): string {
  return `${harborDatasetUrl(benchmark.package, benchmark.datasetVersion)}?tab=tasks`;
}

function TasksLink({ benchmark }: { benchmark: HomeBenchmark }) {
  return (
    <a
      href={tasksUrl(benchmark)}
      target="_blank"
      rel="noreferrer"
      className={buttonVariants({ variant: 'secondary', size: 'lg' })}
    >
      View the tasks
      <HugeiconsIcon icon={ArrowRight02Icon} strokeWidth={2} />
    </a>
  );
}

export function TaskActions() {
  const { benchmark } = useHomeBenchmark();
  return <TasksLink benchmark={benchmark} />;
}

/** Static default for SSR/Suspense fallbacks (no query-param access). */
export function TaskActionsFallback() {
  return <TasksLink benchmark={homeBenchmarkById(DEFAULT_HOME_BENCHMARK_ID)} />;
}
