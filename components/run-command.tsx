"use client";

import { useHomeBenchmark } from "@/components/leaderboard/benchmark-select";
import { MdxPre } from "@/components/mdx-codeblock";
import {
  DEFAULT_HOME_BENCHMARK_ID,
  homeBenchmarkById,
} from "@/lib/leaderboard";

export function RunCommandView({ dataset }: { dataset: string }) {
  const command = [
    `harbor run -d ${dataset} \\`,
    "  -e modal \\",
    "  -a claude-code \\",
    "  -m anthropic/claude-sonnet-5 \\",
    "  -k 5",
  ].join("\n");

  return (
    <MdxPre>
      <code>{command}</code>
    </MdxPre>
  );
}

/** The `harbor run` command for the version selected in the subtitle. */
export function RunCommand() {
  const { benchmark } = useHomeBenchmark();
  return <RunCommandView dataset={benchmark.runDataset} />;
}

export function RunCommandFallback() {
  return (
    <RunCommandView
      dataset={homeBenchmarkById(DEFAULT_HOME_BENCHMARK_ID).runDataset}
    />
  );
}
