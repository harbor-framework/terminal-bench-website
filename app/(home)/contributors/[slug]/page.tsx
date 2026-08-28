import { CONTRIBUTORS } from '@/app/(home)/contributors/data';
import { ContributorsGrid } from '@/components/contributors-grid';
import { GeistSans } from 'geist/font/sans';
import { notFound } from 'next/navigation';

import { cn } from '@/lib/utils';

const RELEASES = {
  'terminal-bench-1': {
    description:
      "People and organizations who contributed to Terminal-Bench's first release.",
  },
  'terminal-bench-2': {
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

const ROLE_GROUPS = [
  { role: 'Co-Lead', title: 'Project Leadership' },
  { role: 'Contributor', title: 'Contributors' },
  { role: 'Advisor', title: 'Advisors' },
];

const contributorGroups = ROLE_GROUPS.map((group) => ({
  title: group.title,
  contributors: CONTRIBUTORS.filter((contributor) => contributor.role === group.role)
    .map((contributor) => ({
      name: contributor.name,
      href: contributor.link,
    })),
})).filter((group) => group.contributors.length > 0);

export default async function ContributorsByReleasePage({ params }: PageProps) {
  const { slug } = await params;
  const release = getRelease(slug);

  if (!release) notFound();

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
          {release.description}
        </p>
      </div>

      <ContributorsGrid groups={contributorGroups} />

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
    title: 'Contributors',
    description: release.description,
  };
}
