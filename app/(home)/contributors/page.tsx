import { ContributorsGrid } from '@/components/contributors-grid';
import { GeistSans } from 'geist/font/sans';
import type { Metadata } from 'next';
import Link from 'next/link';

import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Contributors',
  description: 'People and organizations behind Terminal-Bench 3.0.',
};

export default function ContributorsPage() {
  return (
    <article
      className={cn(
        'mx-auto w-full max-w-4xl flex-1 px-4 pb-12',
        GeistSans.className,
      )}
    >
      <div className="pt-6 sm:pt-12">
        <h1 className="mb-8 font-mono text-4xl font-medium tracking-tight">
          Contributors
        </h1>
        <p className="mb-8 font-mono text-muted-foreground">
          The people and organizations building Terminal-Bench 3.0.
        </p>
      </div>
      <ContributorsGrid />
      <section className="mt-12 border-t pt-8">
        <h2 className="font-mono text-2xl font-medium tracking-tight">
          Earlier Releases
        </h2>
        <div className="mt-4 grid gap-px overflow-hidden border-y bg-border sm:grid-cols-2">
          {[
            {
              href: '/contributors/terminal-bench-1',
              label: 'Terminal-Bench 1.0',
            },
            {
              href: '/contributors/terminal-bench-2',
              label: 'Terminal-Bench 2.0',
            },
          ].map((release) => (
            <Link
              key={release.href}
              href={release.href}
              className="bg-card px-3 py-4 font-mono text-sm font-medium tracking-tight uppercase transition-colors hover:bg-muted/50"
            >
              {release.label}
            </Link>
          ))}
        </div>
      </section>
    </article>
  );
}
