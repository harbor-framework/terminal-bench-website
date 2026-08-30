import { getMDXComponents } from '@/components/mdx';
import { blog } from '@/lib/source';
import { cn } from '@/lib/utils';
import {
  DocsBody,
  DocsDescription,
  DocsTitle,
} from 'fumadocs-ui/layouts/docs/page';
import { GeistSans } from 'geist/font/sans';
import { notFound } from 'next/navigation';

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const page = blog.getPage([slug]);

  if (!page) {
    notFound();
  }

  const Mdx = page.data.body;
  const isTerminalBenchAnnouncement = page.slugs[0] === 'terminal-bench-3-0';

  if (isTerminalBenchAnnouncement) {
    return (
      <article
        className={cn(
          'content-page mx-auto w-full max-w-3xl flex-1 px-4 py-12',
          GeistSans.className,
        )}
      >
        <DocsTitle>{page.data.title}</DocsTitle>
        <DocsDescription className="page-subtitle mt-2">
        {page.data.description}
      </DocsDescription>
        <DocsBody>
          <Mdx components={getMDXComponents()} />
        </DocsBody>
      </article>
    );
  }

  return (
    <article
      className={cn(
        'content-page mx-auto w-full max-w-3xl flex-1 px-4 py-12',
        GeistSans.className,
      )}
    >
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription className="page-subtitle mt-2">
        {page.data.description}
      </DocsDescription>
      <DocsBody>
        <Mdx components={getMDXComponents()} />
      </DocsBody>
      <div className="mt-12 flex flex-col gap-4 border-t pt-8 text-sm">
        <div>
          <p className="mb-1 font-mono text-muted-foreground">Written by</p>
          <p className="font-mono">
            {page.slugs[0] === 'terminal-bench-2-1' ? (
              <>
                <a
                  href="https://x.com/terminalbench"
                  className="underline-offset-4 hover:underline"
                >
                  The Terminal-Bench Team
                </a>{' '}
                (TB2.1 Lead:{' '}
                <a
                  href="https://x.com/ekellbuch"
                  className="underline-offset-4 hover:underline"
                >
                  Kelly Buchanan
                </a>
                )
              </>
            ) : page.slugs[0] === 'terminal-bench-challenges' ? (
              <>
                <a
                  href="https://x.com/terminalbench"
                  className="underline-offset-4 hover:underline"
                >
                  The Terminal-Bench Team
                </a>{' '}
                (TB Challenges Lead:{' '}
                <a
                  href="https://x.com/andr3w_wang"
                  className="underline-offset-4 hover:underline"
                >
                  Andrew Wang
                </a>
                )
              </>
            ) : (
              page.data.authors.map((author, index) => (
                <span key={author.name}>
                  {author.url ? (
                    <a
                      href={author.url}
                      className="underline-offset-4 hover:underline"
                    >
                      {author.name}
                    </a>
                  ) : (
                    author.name
                  )}
                  {index < page.data.authors.length - 1 &&
                    (index === page.data.authors.length - 2
                      ? page.data.authors.length > 2
                        ? ', and '
                        : ' and '
                      : ', ')}
                </span>
              ))
            )}
          </p>
        </div>
      </div>
    </article>
  );
}

export async function generateStaticParams() {
  return blog.getPages().map((page) => ({
    slug: page.slugs[0],
  }));
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const page = blog.getPage([slug]);

  if (!page) {
    return {};
  }

  return {
    title: page.data.title,
    description: page.data.description,
  };
}
