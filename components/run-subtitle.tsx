"use client";

import { useHomeBenchmark } from "@/components/leaderboard/benchmark-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT_HOME_BENCHMARK_ID, HOME_BENCHMARKS } from "@/lib/leaderboard";

// The trigger renders as part of the subtitle sentence: same font, no box.
const TRIGGER_CLASS =
  "h-auto gap-1 rounded-none border border-input bg-transparent px-1.5 py-0 [font:inherit] tracking-[inherit] text-inherit transition-colors hover:text-foreground";

export function RunSubtitleView({
  versionId,
  onVersionChange,
}: {
  versionId: string;
  onVersionChange?: (next: string) => void;
}) {
  return (
    <p className="page-subtitle mb-10 mt-2 flex flex-wrap items-center gap-x-2 text-muted-foreground">
      How to run Terminal-Bench
      <Select
        value={versionId}
        onValueChange={(next) => {
          if (typeof next === "string") onVersionChange?.(next);
        }}
      >
        <SelectTrigger className={TRIGGER_CLASS} aria-label="Version">
          <SelectValue>{versionId}</SelectValue>
        </SelectTrigger>
        <SelectContent
          align="start"
          alignOffset={1}
          alignItemWithTrigger={false}
          className="w-fit min-w-0 font-[family-name:var(--font-google-sans-code)]"
        >
          {HOME_BENCHMARKS.map((benchmark) => (
            <SelectItem
              key={benchmark.id}
              value={benchmark.id}
              className="pr-2 text-[1.125rem] tracking-[-0.05em] text-muted-foreground [&>span:last-child]:hidden"
            >
              {benchmark.id}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </p>
  );
}

export function RunSubtitle() {
  const { benchmark, setBenchmarkId } = useHomeBenchmark();
  return (
    <RunSubtitleView
      versionId={benchmark.id}
      onVersionChange={setBenchmarkId}
    />
  );
}

export function RunSubtitleFallback() {
  return <RunSubtitleView versionId={DEFAULT_HOME_BENCHMARK_ID} />;
}
