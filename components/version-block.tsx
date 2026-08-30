"use client";

import type { ReactNode } from "react";

import { useHomeBenchmark } from "@/components/leaderboard/benchmark-select";

/** Renders its children only when the selected version is in `versions`. */
export function VersionBlockClient({
  versions,
  children,
}: {
  versions: string[];
  children: ReactNode;
}) {
  const { benchmark } = useHomeBenchmark();
  return versions.includes(benchmark.id) ? <>{children}</> : null;
}
