import Link from 'next/link';

import { cn } from '@/lib/utils';

export const CONTRIBUTOR_RELEASES = [
  { href: '/contributors', label: 'Terminal-Bench 3.0' },
  { href: '/contributors/terminal-bench-2', label: 'Terminal-Bench 2.0' },
  { href: '/contributors/terminal-bench-1', label: 'Terminal-Bench 1.0' },
] as const;

type ContributorReleaseNavProps = {
  currentHref: (typeof CONTRIBUTOR_RELEASES)[number]['href'];
};

export function ContributorReleaseNav({
  currentHref,
}: ContributorReleaseNavProps) {
  return (
    <nav
      aria-label="Contributor releases"
      className="mb-8 grid gap-px overflow-hidden border bg-border sm:grid-cols-3"
    >
      {CONTRIBUTOR_RELEASES.map((release) => {
        const isCurrent = release.href === currentHref;

        return (
          <Link
            key={release.href}
            href={release.href}
            aria-current={isCurrent ? 'page' : undefined}
            className={cn(
              'bg-card px-3 py-4 font-mono text-sm font-medium tracking-tight uppercase transition-colors hover:bg-muted/50',
              isCurrent && 'bg-muted text-foreground',
            )}
          >
            {release.label}
          </Link>
        );
      })}
    </nav>
  );
}
