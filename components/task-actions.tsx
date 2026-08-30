import { ArrowRight02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

import { buttonVariants } from '@/components/ui/button';
import {
  TERMINAL_BENCH_DATASET_VERSION,
  TERMINAL_BENCH_PACKAGE,
  harborDatasetUrl,
} from '@/lib/leaderboard';

export function TaskActions() {
  return (
    <div className="contents">
      <a
        href={harborDatasetUrl(
          TERMINAL_BENCH_PACKAGE,
          TERMINAL_BENCH_DATASET_VERSION,
        )}
        target="_blank"
        rel="noreferrer"
        className={buttonVariants({ variant: 'secondary', size: 'lg' })}
      >
        View the tasks
        <HugeiconsIcon icon={ArrowRight02Icon} strokeWidth={2} />
      </a>
    </div>
  );
}
