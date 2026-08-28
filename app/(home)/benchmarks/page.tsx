import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';

import { cn } from '@/lib/utils';
import { formatNewsDate } from '../news/components/format-news-date';

type BenchmarkLink = {
  label: string;
  href: string;
  external?: boolean;
};

type Benchmark = {
  name: string;
  date: string;
  description: string;
  links: BenchmarkLink[];
};

const BENCHMARKS: Benchmark[] = [
  {
    name: 'Terminal-Bench 1.0',
    date: '2025-05-19',
    description:
      "An evaluation framework and benchmark to quantify agents' ability to complete complex tasks in the terminal.",
    links: [
      { label: 'Blog', href: '/news/announcement' },
      {
        label: 'GitHub',
        href: 'https://github.com/harbor-framework/terminal-bench-1',
        external: true,
      },
    ],
  },
  {
    name: 'Terminal-Bench 2.0',
    date: '2025-11-07',
    description:
      'A harder, better verified version of Terminal-Bench, released alongside Harbor.',
    links: [
      { label: 'Blog', href: '/news/announcement-2-0' },
      { label: 'Leaderboard', href: '/?benchmark=2.0' },
      {
        label: 'Harbor Hub',
        href: 'https://hub.harborframework.com/datasets/terminal-bench/terminal-bench-2/latest',
        external: true,
      },
      {
        label: 'GitHub',
        href: 'https://github.com/harbor-framework/terminal-bench-2',
        external: true,
      },
    ],
  },
  {
    name: 'Terminal-Bench 2.1',
    date: '2026-05-06',
    description: 'A revision of Terminal-Bench 2.0 that fixes 28 tasks.',
    links: [
      { label: 'Blog', href: '/news/terminal-bench-2-1' },
      { label: 'Leaderboard', href: '/?benchmark=2.1' },
      {
        label: 'Harbor Hub',
        href: 'https://hub.harborframework.com/datasets/terminal-bench/terminal-bench-2-1/latest',
        external: true,
      },
      {
        label: 'GitHub',
        href: 'https://github.com/harbor-framework/terminal-bench-2-1',
        external: true,
      },
    ],
  },
  {
    name: 'Terminal-Bench 3.0',
    date: '2026-07-30',
    description: 'Terminal-Bench 3.0 measures agent abilities at the frontier.',
    links: [
      { label: 'Blog', href: '/news/terminal-bench-3-0' },
      { label: 'Leaderboard', href: '/?benchmark=3.0' },
      {
        label: 'Harbor Hub',
        href: 'https://hub.harborframework.com/datasets/terminal-bench/terminal-bench/1',
        external: true,
      },
    ],
  },
  {
    name: 'Terminal-Bench 4.0',
    date: '2026-08-28',
    description:
      'The current release. A benchmark to measure and evolve with the frontier of agent work.',
    links: [
      { label: 'Blog', href: '/news/terminal-bench-4-0' },
      { label: 'Leaderboard', href: '/' },
      {
        label: 'Harbor Hub',
        href: 'https://hub.harborframework.com/datasets/terminal-bench/terminal-bench/4',
        external: true,
      },
    ],
  },
  {
    name: 'Terminal-Bench-Science 0.1',
    date: '2026-08-27',
    description:
      'A benchmark for evaluating AI agents on research workflows across scientific domains.',
    links: [
      { label: 'Blog', href: '/news/tb-science-announcement' },
      {
        label: 'Leaderboard',
        href: 'https://hub.harborframework.com/datasets/terminal-bench-science/terminal-bench-science/10?tab=leaderboard&leaderboard=v0-1-eval',
        external: true,
      },
      {
        label: 'Harbor Hub',
        href: 'https://hub.harborframework.com/datasets/terminal-bench-science/terminal-bench-science/10',
        external: true,
      },
      {
        label: 'Website',
        href: 'https://www.terminal-bench-science.ai/',
        external: true,
      },
      {
        label: 'GitHub',
        href: 'https://github.com/harbor-framework/terminal-bench-science',
        external: true,
      },
    ],
  },
  {
    name: 'Terminal-Bench Challenges',
    date: '2026-06-18',
    description: 'Long-horizon, token-intensive, single-task benchmarks.',
    links: [
      { label: 'Blog', href: '/news/terminal-bench-challenges' },
      {
        label: 'GitHub',
        href: 'https://github.com/harbor-framework/terminal-bench-challenges',
        external: true,
      },
    ],
  },
];

function BenchmarkRow({ benchmark }: { benchmark: Benchmark }) {
  return (
    <article className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 bg-card px-3 py-4 sm:gap-x-6 sm:px-4">
      <h2 className="min-w-0 break-words font-mono text-base font-medium tracking-tight uppercase sm:text-lg">
        {benchmark.name}
      </h2>
      <time
        dateTime={benchmark.date}
        className="justify-self-end whitespace-nowrap pt-1 font-mono text-xs text-muted-foreground"
      >
        {formatNewsDate(benchmark.date)}
      </time>
      <div className="col-span-2 flex flex-wrap gap-x-4 font-mono text-sm leading-6 tracking-tighter">
        {benchmark.links.map((link) => (
          <a
            key={link.label}
            href={link.href}
            {...(link.external
              ? { target: '_blank', rel: 'noopener noreferrer' }
              : {})}
            className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {link.label}
            {link.external ? ' ↗' : ''}
          </a>
        ))}
      </div>
    </article>
  );
}

export default function BenchmarksPage() {
  return (
    <article
      className={cn(
        'content-page mx-auto w-full max-w-3xl flex-1 px-4 py-12',
        GeistSans.className,
      )}
    >
      <h1>Benchmarks</h1>
      <p className="page-subtitle mb-10 mt-2 text-muted-foreground">
        The Terminal-Bench family of benchmarks
      </p>

      <div className="-mx-4 mb-6 grid gap-px overflow-hidden border bg-border sm:mx-0">
        {[...BENCHMARKS]
          .sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
          )
          .map((benchmark) => (
            <BenchmarkRow key={benchmark.name} benchmark={benchmark} />
          ))}
      </div>
    </article>
  );
}

export const metadata: Metadata = {
  title: 'Benchmarks',
  description: 'The Terminal-Bench family of benchmarks',
};
