import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import { Suspense } from "react";

import {
  ContributorsBody,
  ContributorsView,
} from "@/app/(home)/contributors/contributors-body";
import { cn } from "@/lib/utils";

const CONTRIBUTORS_DESCRIPTION =
  "The people and organizations behind Terminal-Bench";

export const metadata: Metadata = {
  title: "Contributors",
  description: CONTRIBUTORS_DESCRIPTION,
};

export default function ContributorsPage() {
  return (
    <article
      className={cn(
        "content-page mx-auto w-full max-w-3xl flex-1 px-4 py-12",
        GeistSans.className,
      )}
    >
      <h1>Contributors</h1>
      <Suspense fallback={<ContributorsView version="3.0" />}>
        <ContributorsBody />
      </Suspense>
    </article>
  );
}
