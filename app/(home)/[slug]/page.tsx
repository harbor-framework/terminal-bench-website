import { getMDXComponents } from '@/components/mdx';
import { pagesSource } from '@/lib/source';
import { DocsBody } from 'fumadocs-ui/layouts/docs/page';
import { GeistSans } from 'geist/font/sans';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { cn } from '@/lib/utils';

export default async function Page(props: PageProps<'/[slug]'>) {
  const { slug } = await props.params;
  const page = pagesSource.getPage([slug]);
  if (!page) notFound();

  const MDX = page.data.body;

  return (
    <article
      className={cn(
        'mx-auto w-full max-w-3xl flex-1 px-4 pb-12',
        GeistSans.className,
      )}
    >
      <div className="pt-6 sm:pt-12">
        <h1 className="mb-8 font-mono text-4xl font-medium tracking-tight">
          {page.data.title}
        </h1>
        {page.data.description ? (
          <p className="mb-8 font-mono text-muted-foreground">
            {page.data.description}
          </p>
        ) : null}
      </div>
      <div className="content-page">
        <DocsBody>
          <MDX components={getMDXComponents()} />
        </DocsBody>
      </div>
    </article>
  );
}

export function generateStaticParams() {
  return pagesSource.getPages().map((page) => ({
    slug: page.slugs[0],
  }));
}

export async function generateMetadata(
  props: PageProps<'/[slug]'>,
): Promise<Metadata> {
  const { slug } = await props.params;
  const page = pagesSource.getPage([slug]);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
  };
}
