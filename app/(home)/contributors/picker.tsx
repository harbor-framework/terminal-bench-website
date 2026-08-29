"use client";

import { useRouter } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const CONTRIBUTOR_RELEASES = [
  { version: "3.0", href: "/contributors" },
  { version: "2.0", href: "/contributors/terminal-bench-2" },
  { version: "1.0", href: "/contributors/terminal-bench-1" },
] as const;

export type ContributorHref = (typeof CONTRIBUTOR_RELEASES)[number]["href"];

// The trigger renders as part of the subtitle sentence: same font, no box.
const TRIGGER_CLASS =
  "h-auto gap-1 rounded-none border-0 bg-transparent p-0 [font:inherit] tracking-[inherit] text-inherit transition-colors hover:text-foreground";

/**
 * The contributors subtitle with an inline version dropdown that navigates
 * between contributor pages.
 */
export function ContributorPicker({
  currentHref,
}: {
  currentHref: ContributorHref;
}) {
  const router = useRouter();
  const release =
    CONTRIBUTOR_RELEASES.find((entry) => entry.href === currentHref) ??
    CONTRIBUTOR_RELEASES[0];

  return (
    <p className="page-subtitle mb-10 mt-2 flex flex-wrap items-center gap-x-2 text-muted-foreground">
      The people and organizations behind Terminal-Bench
      <Select
        value={release.href}
        onValueChange={(next) => {
          if (typeof next === "string" && next !== release.href)
            router.push(next);
        }}
      >
        <SelectTrigger className={TRIGGER_CLASS} aria-label="Version">
          <SelectValue>{release.version}</SelectValue>
        </SelectTrigger>
        <SelectContent
          align="start"
          alignOffset={-6}
          alignItemWithTrigger={false}
          className="w-fit min-w-0 font-[family-name:var(--font-google-sans-code)]"
        >
          {CONTRIBUTOR_RELEASES.map((entry) => (
            <SelectItem
              key={entry.href}
              value={entry.href}
              className="pr-1.5 text-[1.125rem] tracking-[-0.05em] text-muted-foreground [&>span:last-child]:hidden"
            >
              {entry.version}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </p>
  );
}
