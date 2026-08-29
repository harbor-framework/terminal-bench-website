import { ContributorPicker } from "@/app/(home)/contributors/picker";
import { ContributorsGrid } from "@/components/contributors-grid";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";

import { cn } from "@/lib/utils";

const CONTRIBUTORS_DESCRIPTION =
  "The people and organizations behind Terminal-Bench";

export const metadata: Metadata = {
  title: "Contributors",
  description: CONTRIBUTORS_DESCRIPTION,
};

function CreditLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      className="text-foreground underline underline-offset-4"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  );
}

export default function ContributorsPage() {
  return (
    <article
      className={cn(
        "content-page mx-auto w-full max-w-3xl flex-1 px-4 py-12",
        GeistSans.className,
      )}
    >
      <h1>Contributors</h1>
      <ContributorPicker currentHref="/contributors" />
      <ContributorsGrid />
      <div className="mt-10 text-sm text-muted-foreground">
        <p>
          Built with support with grants from{" "}
          <CreditLink href="https://modal.com/">Modal</CreditLink>,{" "}
          <CreditLink href="https://www.anthropic.com/">Anthropic</CreditLink>,{" "}
          <CreditLink href="https://openai.com/">OpenAI</CreditLink>,{" "}
          <CreditLink href="https://ai.google/">Google</CreditLink>,{" "}
          <CreditLink href="https://benchmarks.snorkel.ai/">
            Snorkel Open Benchmarks
          </CreditLink>
          {", and "}
          <CreditLink href="https://www.laude.org/">Laude Institute</CreditLink>
          {"."}
        </p>
      </div>
    </article>
  );
}
