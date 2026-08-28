import { CONTRIBUTORS } from '@/app/(home)/contributors/data';
import { GeistSans } from 'geist/font/sans';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { cn } from '@/lib/utils';

const RELEASES = {
  'terminal-bench-1': {
    title: 'Terminal-Bench 1.0 Contributors',
    description:
      "People and organizations who contributed to Terminal-Bench's first release.",
  },
  'terminal-bench-2': {
    title: 'Terminal-Bench 2.0 Contributors',
    description:
      'People and organizations who contributed to the Terminal-Bench 2.0 release.',
  },
} as const;

type ReleaseSlug = keyof typeof RELEASES;

type PageProps = {
  params: Promise<{ slug: string }>;
};

function getRelease(slug: string) {
  if (slug in RELEASES) return RELEASES[slug as ReleaseSlug];
  return null;
}

export default async function ContributorsByReleasePage({ params }: PageProps) {
  const { slug } = await params;
  const release = getRelease(slug);

  if (!release) notFound();

  return (
    <article
      className={cn(
        'content-page mx-auto w-full max-w-4xl flex-1 px-4 py-12',
        GeistSans.className,
      )}
    >
      <div className="mb-10 flex flex-col gap-4">
        <Link
          href="/contributors"
          className="font-mono text-xs font-medium tracking-tight text-muted-foreground uppercase hover:text-foreground"
        >
          Contributors
        </Link>
        <div>
          <h1>{release.title}</h1>
          <p className="mt-4 text-muted-foreground">{release.description}</p>
        </div>
      </div>

      <div className="-mx-4 grid grid-cols-1 overflow-hidden border-y sm:mx-0 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {CONTRIBUTORS.map(({ name, link, role }) => (
          <Link
            href={link}
            key={`${name}:${link}`}
            target="_blank"
            rel="noopener noreferrer"
            className="-mb-px flex min-h-24 flex-col justify-between border-b bg-card p-4 transition-colors hover:bg-muted/50 sm:-mr-px sm:border-r"
          >
            <span className="font-mono text-sm font-medium tracking-tight uppercase">
              {name}
            </span>
            <span className="font-mono text-xs text-muted-foreground uppercase">
              {role}
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-10 space-y-4 text-sm text-muted-foreground">
        <p>
          Built with support from the Microsoft Grant in Customer Experience
          Innovation and{' '}
          <a
            href="https://www.2077ai.com/"
            className="text-foreground underline underline-offset-4"
            target="_blank"
            rel="noopener noreferrer"
          >
            2077AI
          </a>
          .
        </p>
        <p>
          Thanks for feedback from the teams at OpenHands, Anthropic, Cognition,
          Aider, Goose, Manus, and Replit.
        </p>
      </div>
    </article>
  );
}

export function generateStaticParams() {
  return Object.keys(RELEASES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const release = getRelease(slug);

  if (!release) return {};

  return {
    title: release.title,
    description: release.description,
  };
}
