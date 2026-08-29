"use client";

import { useRouter } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const CONTRIBUTOR_BENCHMARKS = [
  {
    id: "terminal-bench",
    label: "Terminal-Bench",
    versions: [
      { version: "3.0", href: "/contributors" },
      { version: "2.0", href: "/contributors/terminal-bench-2" },
      { version: "1.0", href: "/contributors/terminal-bench-1" },
    ],
  },
  {
    id: "terminal-bench-challenges",
    label: "Terminal-Bench-Challenges",
    versions: [
      { version: "1.0", href: "/contributors/terminal-bench-challenges" },
    ],
  },
] as const;

export type ContributorHref =
  (typeof CONTRIBUTOR_BENCHMARKS)[number]["versions"][number]["href"];

// Triggers render as part of the subtitle sentence: same font, no box.
const TRIGGER_CLASS =
  "h-auto gap-1 rounded-none border-0 bg-transparent p-0 [font:inherit] tracking-[inherit] text-inherit transition-colors hover:text-foreground";

/**
 * The contributors subtitle with inline benchmark + version dropdowns that
 * navigate between contributor pages.
 */
export function ContributorPicker({
  currentHref,
}: {
  currentHref: ContributorHref;
}) {
  const router = useRouter();
  const benchmark =
    CONTRIBUTOR_BENCHMARKS.find((entry) =>
      entry.versions.some((release) => release.href === currentHref),
    ) ?? CONTRIBUTOR_BENCHMARKS[0];
  const release =
    benchmark.versions.find((entry) => entry.href === currentHref) ??
    benchmark.versions[0];

  return (
    <p className="page-subtitle mb-10 mt-2 flex flex-wrap items-center gap-x-2 text-muted-foreground">
      The people and organizations behind
      <Select
        value={benchmark.id}
        onValueChange={(next) => {
          if (typeof next !== "string" || next === benchmark.id) return;
          const target = CONTRIBUTOR_BENCHMARKS.find(
            (entry) => entry.id === next,
          );
          // Jump to the selected benchmark's latest version.
          if (target) router.push(target.versions[0].href);
        }}
      >
        <SelectTrigger className={TRIGGER_CLASS} aria-label="Benchmark">
          <SelectValue>{benchmark.label}</SelectValue>
        </SelectTrigger>
        <SelectContent
          align="start"
          alignItemWithTrigger={false}
          className="min-w-(--anchor-width)"
        >
          {CONTRIBUTOR_BENCHMARKS.map((entry) => (
            <SelectItem key={entry.id} value={entry.id}>
              {entry.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
          alignItemWithTrigger={false}
          className="min-w-(--anchor-width)"
        >
          {benchmark.versions.map((entry) => (
            <SelectItem key={entry.href} value={entry.href}>
              {entry.version}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </p>
  );
}
