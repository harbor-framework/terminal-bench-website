'use client';

import { parseAsStringLiteral, useQueryState } from 'nuqs';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DEFAULT_HOME_BENCHMARK_ID,
  HOME_BENCHMARKS,
  homeBenchmarkById,
  type HomeBenchmark,
} from '@/lib/leaderboard';

const parseBenchmarkId = parseAsStringLiteral(
  HOME_BENCHMARKS.map((benchmark) => benchmark.id),
);

/** Selected homepage benchmark, shared across views via ?benchmark=. */
export function useHomeBenchmark(): {
  benchmark: HomeBenchmark;
  setBenchmarkId: (id: string) => void;
} {
  const [benchmarkId, setBenchmarkId] = useQueryState(
    'benchmark',
    parseBenchmarkId.withDefault(DEFAULT_HOME_BENCHMARK_ID),
  );
  return {
    benchmark: homeBenchmarkById(benchmarkId),
    setBenchmarkId: (id: string) => void setBenchmarkId(id),
  };
}

export function BenchmarkSelect() {
  const { benchmark, setBenchmarkId } = useHomeBenchmark();

  return (
    <Select
      value={benchmark.id}
      onValueChange={(next) => {
        if (typeof next === 'string') setBenchmarkId(next);
      }}
    >
      <SelectTrigger
        className="bg-background uppercase dark:bg-card"
        aria-label="Benchmark"
      >
        <SelectValue>{benchmark.id}</SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        {HOME_BENCHMARKS.map((option) => (
          <SelectItem key={option.id} value={option.id} className="uppercase">
            {option.id}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
