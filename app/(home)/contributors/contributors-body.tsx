"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";

import { CONTRIBUTORS } from "@/app/(home)/contributors/data";
import { ContributorsGrid } from "@/components/contributors-grid";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CONTRIBUTOR_GROUPS } from "@/lib/contributors";

const RELEASE_VERSIONS = ["3.0", "2.0", "1.0"] as const;
export type ContributorVersion = (typeof RELEASE_VERSIONS)[number];

const parseContributorVersion =
  parseAsStringLiteral(RELEASE_VERSIONS).withDefault("3.0");

// The trigger renders as part of the subtitle sentence: same font, no box.
const TRIGGER_CLASS =
  "h-auto gap-1 rounded-none border border-input bg-transparent px-1.5 py-0 [font:inherit] tracking-[inherit] text-inherit transition-colors hover:text-foreground";

const ROLE_GROUPS = [
  { role: "Co-Lead", title: "Project Leadership" },
  { role: "Contributor", title: "Contributors" },
  { role: "Advisor", title: "Advisors" },
];

const legacyContributorGroups = ROLE_GROUPS.map((group) => ({
  title: group.title,
  contributors: CONTRIBUTORS.filter(
    (contributor) => contributor.role === group.role,
  ).map((contributor) => ({
    name: contributor.name,
    href: contributor.link,
  })),
})).filter((group) => group.contributors.length > 0);

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

const currentAcknowledgements = (
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
);

const legacyAcknowledgements = (
  <div className="mt-10 space-y-4 text-sm text-muted-foreground">
    <p>
      Built with support from the Microsoft Grant in Customer Experience
      Innovation and{" "}
      <CreditLink href="https://www.2077ai.com/">2077AI</CreditLink>.
    </p>
    <p>
      Thanks for feedback from the teams at OpenHands, Anthropic, Cognition,
      Aider, Goose, Manus, and Replit.
    </p>
  </div>
);

export function ContributorsView({
  version,
  onVersionChange,
}: {
  version: ContributorVersion;
  onVersionChange?: (next: ContributorVersion) => void;
}) {
  const isCurrent = version === "3.0";

  return (
    <>
      <p className="page-subtitle mb-10 mt-2 flex flex-wrap items-center gap-x-2 text-muted-foreground">
        The people and organizations behind Terminal-Bench
        <Select
          value={version}
          onValueChange={(next) => {
            if (
              typeof next === "string" &&
              (RELEASE_VERSIONS as readonly string[]).includes(next)
            )
              onVersionChange?.(next as ContributorVersion);
          }}
        >
          <SelectTrigger className={TRIGGER_CLASS} aria-label="Version">
            <SelectValue>{version}</SelectValue>
          </SelectTrigger>
          <SelectContent
            align="start"
            alignOffset={0}
            alignItemWithTrigger={false}
            className="min-w-0 font-[family-name:var(--font-google-sans-code)]"
          >
            {RELEASE_VERSIONS.map((entry) => (
              <SelectItem
                key={entry}
                value={entry}
                className="text-[1.125rem] tracking-[-0.05em] text-muted-foreground"
              >
                {entry}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </p>

      <ContributorsGrid
        groups={isCurrent ? CONTRIBUTOR_GROUPS : legacyContributorGroups}
      />

      {isCurrent ? currentAcknowledgements : legacyAcknowledgements}
    </>
  );
}

export function ContributorsBody() {
  const [version, setVersion] = useQueryState(
    "version",
    parseContributorVersion,
  );
  return (
    <ContributorsView
      version={version}
      onVersionChange={(next) => void setVersion(next)}
    />
  );
}
