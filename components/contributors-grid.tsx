import {
  CONTRIBUTOR_GROUPS,
  contributorHref,
  type Contributor,
} from '@/lib/contributors';
import { cn } from '@/lib/utils';

function ContributorCard({ contributor }: { contributor: Contributor }) {
  const href = contributorHref(contributor);

  const className = cn(
    'flex h-10 items-center bg-card px-2.5 text-xs font-medium tracking-tight uppercase no-underline outline-none transition-colors sm:text-sm',
    href && 'hover:bg-muted/50 focus-visible:bg-muted/50',
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={className}
      >
        <span className="truncate">{contributor.name}</span>
      </a>
    );
  }

  return (
    <div className={className}>
      <span className="truncate">{contributor.name}</span>
    </div>
  );
}

function rowPadCount(count: number, columns: number): number {
  const remainder = count % columns;
  return remainder === 0 ? 0 : columns - remainder;
}

function RowPad({
  index,
  pad2,
  pad3,
  pad4,
}: {
  index: number;
  pad2: number;
  pad3: number;
  pad4: number;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        'h-10 bg-card',
        index < pad2 ? 'block' : 'hidden',
        index < pad3 ? 'sm:block' : 'sm:hidden',
        index < pad4 ? 'md:block' : 'md:hidden',
      )}
    />
  );
}

type ContributorsGridProps = {
  groups?: typeof CONTRIBUTOR_GROUPS;
};

export function ContributorsGrid({
  groups = CONTRIBUTOR_GROUPS,
}: ContributorsGridProps) {
  return (
    <div className="-mx-4 grid w-auto grid-cols-2 gap-px overflow-hidden rounded-none bg-border py-px sm:grid-cols-3 md:mx-0 md:w-full md:grid-cols-4 md:rounded-xl md:p-px">
      {groups.map((group) => {
        const count = group.contributors.length;
        const pad2 = rowPadCount(count, 2);
        const pad3 = rowPadCount(count, 3);
        const pad4 = rowPadCount(count, 4);
        const padTotal = Math.max(pad2, pad3, pad4);

        return (
          <div key={group.title} className="contents">
            <div className="col-span-full flex h-10 items-center bg-sidebar px-2.5">
              <h2 className="text-sm font-medium tracking-tight text-muted-foreground uppercase">
                {group.title}
              </h2>
            </div>
            {group.contributors.map((contributor) => (
              <ContributorCard
                key={`${group.title}:${contributor.name}:${contributor.github ?? contributor.href ?? 'none'}`}
                contributor={contributor}
              />
            ))}
            {Array.from({ length: padTotal }, (_, index) => (
              <RowPad
                key={`${group.title}:pad:${index}`}
                index={index}
                pad2={pad2}
                pad3={pad3}
                pad4={pad4}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
