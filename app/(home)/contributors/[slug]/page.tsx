import { CONTRIBUTORS } from '@/app/(home)/contributors/data';
import {
  ContributorReleaseNav,
  CONTRIBUTOR_RELEASES,
} from '@/app/(home)/contributors/release-nav';
import { ContributorsGrid } from '@/components/contributors-grid';
import { GeistSans } from 'geist/font/sans';
import { notFound } from 'next/navigation';

import { cn } from '@/lib/utils';

const CONTRIBUTORS_DESCRIPTION =
  'The people and organizations behind Terminal-Bench.';

const RELEASES = {
  'terminal-bench-1': {},
  'terminal-bench-2': {},
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
        'content-page mx-auto w-full max-w-3xl flex-1 px-4 py-12',
        GeistSans.className,
      )}
    >
      <h1>Contributors</h1>
      <p className="mb-10 text-muted-foreground">{CONTRIBUTORS_DESCRIPTION}</p>
      <ContributorReleaseNav
        currentHref={`/contributors/${slug}` as (typeof CONTRIBUTOR_RELEASES)[number]['href']}
      />

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
    description: CONTRIBUTORS_DESCRIPTION,
  };
}
