import defaultMdxComponents from 'fumadocs-ui/mdx';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import type { MDXComponents } from 'mdx/types';
import { Suspense } from 'react';

import { CostPassRateParetoChart } from '@/components/charts/cost-pass-rate-pareto-chart';
import { DiscriminationSlopeChart } from '@/components/charts/discrimination-slope-chart';
import { PassRateBarChart } from '@/components/charts/pass-rate-bar-chart';
import { RoadmapDiagram } from '@/components/charts/roadmap-diagram';
import { TaskReviewProcess } from '@/components/charts/task-review-process';
import { TokensVsStepsChart } from '@/components/charts/tokens-vs-steps-chart';
import { MdxPre } from '@/components/mdx-codeblock';
import { VersionBlockClient } from '@/components/version-block';
import { DEFAULT_HOME_BENCHMARK_ID } from '@/lib/leaderboard';
import { TbScienceLogo } from '@/components/tb-science-logo';
import { VirtuousCycleDiagram } from '@/components/virtuous-cycle-diagram';
import { YouTube } from '@/components/youtube';

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    Tab,
    Tabs,
    pre: MdxPre,
    VersionBlock: ({
      versions,
      children,
    }: {
      versions: string[];
      children: React.ReactNode;
    }) => (
      <Suspense
        fallback={
          versions.includes(DEFAULT_HOME_BENCHMARK_ID) ? children : null
        }
      >
        <VersionBlockClient versions={versions}>{children}</VersionBlockClient>
      </Suspense>
    ),
    PassRateBarChart,
    DiscriminationSlopeChart,
    CostPassRateParetoChart,
    TokensVsStepsChart,
    TaskReviewProcess,
    RoadmapDiagram,
    TbScienceLogo,
    VirtuousCycleDiagram,
    YouTube,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
