import { getMDXComponents } from "@/components/mdx";
import { RunSubtitle, RunSubtitleFallback } from "@/components/run-subtitle";
import { pagesSource } from "@/lib/source";
import {
  DocsBody,
  DocsDescription,
  DocsTitle,
} from "fumadocs-ui/layouts/docs/page";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { cn } from "@/lib/utils";

export default async function Page(props: PageProps<"/[slug]">) {
  const { slug } = await props.params;
  const page = pagesSource.getPage([slug]);
  if (!page) notFound();

  const MDX = page.data.body;

  return (
    <article
      className={cn(
        "content-page mx-auto w-full max-w-3xl flex-1 px-4 py-12",
        GeistSans.className,
      )}
    >
      <DocsTitle>{page.data.title}</DocsTitle>
      {slug === "run" ? (
        <Suspense fallback={<RunSubtitleFallback />}>
          <RunSubtitle />
        </Suspense>
      ) : page.data.description ? (
        <DocsDescription className="page-subtitle mt-2">
          {page.data.description}
        </DocsDescription>
      ) : null}
      <DocsBody>
        <MDX components={getMDXComponents()} />
      </DocsBody>
    </article>
  );
}

export function generateStaticParams() {
  return pagesSource.getPages().map((page) => ({
    slug: page.slugs[0],
  }));
}

export async function generateMetadata(
  props: PageProps<"/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const page = pagesSource.getPage([slug]);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
  };
}
