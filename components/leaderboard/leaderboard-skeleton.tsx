import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const SKELETON_HEADERS = [
  { id: 'rank', label: 'RANK', className: 'w-12 text-right' },
  { id: 'model', label: 'MODEL', className: undefined },
  { id: 'agent', label: 'AGENT', className: undefined },
  { id: 'accuracy', label: 'RESOLUTION RATE', className: 'min-w-56' },
  { id: 'cost', label: 'COST', className: 'text-right' },
  { id: 'tokens', label: 'TOKENS', className: 'text-right' },
] as const;

const ROW_COUNT = 10;

function SkeletonToolbar() {
  return (
    <div className="flex min-w-0 flex-1 flex-wrap-reverse items-center justify-end gap-1.5">
      <div className="flex shrink-0 items-center gap-1.5">
        <Skeleton className="size-8 rounded-lg" />
        <Skeleton className="size-8 rounded-lg" />
        <Skeleton className="h-8 w-40 rounded-lg" />
      </div>
    </div>
  );
}

function SkeletonCell({ columnId }: { columnId: string }) {
  switch (columnId) {
    case 'rank':
      return <Skeleton className="ml-auto h-4 w-6" />;
    case 'accuracy':
      return (
        <div className="flex min-w-52 items-center gap-3">
          <Skeleton className="h-4 w-28 shrink-0" />
          <Skeleton className="h-3 min-w-0 flex-1" />
        </div>
      );
    case 'cost':
    case 'tokens':
      return <Skeleton className="ml-auto h-4 w-16" />;
    default:
      return <Skeleton className="h-4 w-28" />;
  }
}

export function LeaderboardSkeleton() {
  return (
    <div className="flex w-full min-w-0 flex-col gap-1.5">
      <div className="flex min-w-0 items-center justify-end gap-1.5">
        <SkeletonToolbar />
      </div>
      <div className="-mx-4 min-w-0 overflow-hidden rounded-none border border-x-0 bg-card md:mx-0 md:rounded-xl md:border-x">
        <ScrollArea className="w-full">
          <Table className="min-w-max w-full">
            <TableHeader>
              <TableRow>
                {SKELETON_HEADERS.map((header) => (
                  <TableHead key={header.id} className={header.className}>
                    {header.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: ROW_COUNT }, (_, rowIndex) => (
                <TableRow key={rowIndex}>
                  {SKELETON_HEADERS.map((header) => (
                    <TableCell
                      key={header.id}
                      className={
                        header.id === 'accuracy' ? 'min-w-56' : undefined
                      }
                    >
                      <SkeletonCell columnId={header.id} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
        <footer className="flex h-12 items-center justify-center border-t px-6 text-center text-sm text-muted-foreground">
          Resolution rate of Terminal-Bench 4.0 tasks. The black rectangle spans the
          95% confidence interval.
        </footer>
      </div>
    </div>
  );
}
