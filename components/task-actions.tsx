import { ArrowRight02Icon, PlusSignIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

import { buttonVariants } from '@/components/ui/button';
import {
  TERMINAL_BENCH_PACKAGE,
  harborDatasetUrl,
} from '@/lib/leaderboard';

export function TaskActions() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <a
        href={harborDatasetUrl(TERMINAL_BENCH_PACKAGE)}
        target="_blank"
        rel="noreferrer"
        className={buttonVariants({ variant: 'secondary', size: 'lg' })}
      >
        View the tasks
        <HugeiconsIcon icon={ArrowRight02Icon} strokeWidth={2} />
      </a>
      <a
        href="https://github.com/harbor-framework/terminal-bench-3/blob/main/CONTRIBUTING.md"
        target="_blank"
        rel="noreferrer"
        className={buttonVariants({ variant: 'secondary', size: 'lg' })}
      >
        Contribute a task
        <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} />
      </a>
    </div>
  );
}
