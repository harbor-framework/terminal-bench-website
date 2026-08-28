'use client';

import { motion } from 'motion/react';
import { parseAsStringLiteral, useQueryState } from 'nuqs';

import {
  DEFAULT_HOME_BENCHMARK_ID,
  HOME_BENCHMARKS,
} from '@/lib/leaderboard';

const parseBenchmarkId = parseAsStringLiteral(
  HOME_BENCHMARKS.map((benchmark) => benchmark.id),
);

/** Highest digit first so increasing values roll downward (new digit from above). */
const DIGITS = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0] as const;

function offsetFor(digit: number) {
  return `${-(9 - digit)}em`;
}

function DigitReel({ initialFrom, to }: { initialFrom: number; to: number }) {
  return (
    <span className="relative inline-block h-[1em] w-[1ch] overflow-hidden">
      {/* Keeps the reel on the text baseline while the strip is absolutely positioned. */}
      <span aria-hidden className="invisible">
        0
      </span>
      <motion.span
        className="absolute inset-x-0 top-0 flex flex-col will-change-transform"
        initial={{ y: offsetFor(initialFrom) }}
        animate={{ y: offsetFor(to) }}
        transition={{
          type: 'spring',
          stiffness: 90,
          damping: 8,
          mass: 1.1,
          delay: 0.08,
        }}
      >
        {DIGITS.map((digit) => (
          <span
            key={digit}
            className="block h-[1em] w-[1ch] text-center leading-[1em]"
          >
            {digit}
          </span>
        ))}
      </motion.span>
    </span>
  );
}

export function HeroTitle() {
  const [benchmarkId] = useQueryState(
    'benchmark',
    parseBenchmarkId.withDefault(DEFAULT_HOME_BENCHMARK_ID),
  );
  const [majorPart = '4', minorPart = '0'] = benchmarkId.split('.');
  const major = Number(majorPart);
  const minor = Number(minorPart);

  return (
    <h1 className="max-w-full px-1 text-pretty text-4xl font-normal tracking-tighter uppercase sm:text-5xl md:text-7xl">
      TERMINAL-BENCH{' '}
      <span className="inline-flex items-baseline leading-none tracking-tighter tabular-nums">
        <DigitReel initialFrom={Math.max(0, major - 1)} to={major} />
        .
        <DigitReel initialFrom={minor} to={minor} />
      </span>
    </h1>
  );
}
