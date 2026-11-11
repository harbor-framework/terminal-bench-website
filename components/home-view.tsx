'use client';

import { useQueryState } from 'nuqs';
import type { ReactNode } from 'react';

import { ParetoView } from '@/components/charts/pareto-view';
import { TaskWaffleView } from '@/components/charts/task-waffle-view';
import { cn } from '@/lib/utils';
import {
  parseHomeView,
  type HomeViewId,
} from '@/components/home-view-toggle';

type HomeViewProps = {
  leaderboard: ReactNode;
};

function ViewContent({
  view,
  leaderboard,
}: {
  view: HomeViewId;
  leaderboard: ReactNode;
}) {
  switch (view) {
    case 'leaderboard':
      return leaderboard;
    case 'pareto':
      return <ParetoView />;
    case 'waffle':
      return <TaskWaffleView />;
    default: {
      const _exhaustive: never = view;
      return _exhaustive;
    }
  }
}

export function HomeView({ leaderboard }: HomeViewProps) {
  const [view] = useQueryState('view', parseHomeView);

  return (
    <div className={cn(
      'mx-auto flex w-full min-w-0 flex-col items-center gap-6',
      view !== 'leaderboard' && 'max-w-5xl',
    )}>
      <ViewContent view={view} leaderboard={leaderboard} />
    </div>
  );
}
