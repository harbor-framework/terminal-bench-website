import defaultMdxComponents from 'fumadocs-ui/mdx';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import type { MDXComponents } from 'mdx/types';

import { CostPassRateParetoChart } from '@/components/charts/cost-pass-rate-pareto-chart';
import { DiscriminationSlopeChart } from '@/components/charts/discrimination-slope-chart';
import { PassRateBarChart } from '@/components/charts/pass-rate-bar-chart';
import { RoadmapDiagram } from '@/components/charts/roadmap-diagram';
import { TaskReviewProcess } from '@/components/charts/task-review-process';
import { TokensVsStepsChart } from '@/components/charts/tokens-vs-steps-chart';
import { MdxPre } from '@/components/mdx-codeblock';
import { TbScienceLogo } from '@/components/tb-science-logo';
import { VirtuousCycleDiagram } from '@/components/virtuous-cycle-diagram';
import { YouTube } from '@/components/youtube';

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    Tab,
    Tabs,
    pre: MdxPre,
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
