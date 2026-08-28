'use client';

import { Toggle as TogglePrimitive } from '@base-ui/react/toggle';
import { ToggleGroup as ToggleGroupPrimitive } from '@base-ui/react/toggle-group';
import { createParser, useQueryState } from 'nuqs';
import { useCallback } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const VIEWS = ['leaderboard', 'pareto', 'waffle'] as const;
export type HomeViewId = (typeof VIEWS)[number];

const VIEW_LABELS: Record<HomeViewId, string> = {
  leaderboard: 'LEADERBOARD',
  pareto: 'PARETO',
  waffle: 'WAFFLE',
};

export const parseHomeView = createParser({
  parse(value) {
    // Former bar/charts view — resolution bars live on the leaderboard now.
    if (value === 'bar' || value === 'charts') return 'leaderboard' as const;
    if ((VIEWS as readonly string[]).includes(value)) return value as HomeViewId;
    return null;
  },
  serialize(value) {
    return value;
  },
}).withDefault('leaderboard' satisfies HomeViewId);

/** Smoothly bring the view section near the top of the viewport. */
const VIEW_SCROLL_MARGIN = 80;

function scrollToViewSection() {
  const element = document.getElementById('home-view-section');
  if (!element) return;
  const target = () =>
    window.scrollY + element.getBoundingClientRect().top - VIEW_SCROLL_MARGIN;
  window.scrollTo({ top: target(), behavior: 'smooth' });
  // The switched-to view can render mid-animation (and its data can land
  // later still), shifting the layout; re-correct until it settles.
  for (const delay of [500, 1100, 1800]) {
    window.setTimeout(() => {
      if (
        Math.abs(element.getBoundingClientRect().top - VIEW_SCROLL_MARGIN) > 8
      ) {
        window.scrollTo({ top: target(), behavior: 'smooth' });
      }
    }, delay);
  }
}

export function HomeViewToggle({ className }: { className?: string }) {
  const [view, setView] = useQueryState('view', parseHomeView);

  const cycleView = useCallback(
    (direction: 1 | -1) => {
      const index = VIEWS.indexOf(view);
      const next =
        VIEWS[(index + direction + VIEWS.length) % VIEWS.length]!;
      void setView(next);
      scrollToViewSection();
    },
    [setView, view],
  );

  useHotkeys(
    'right,j',
    () => cycleView(1),
    { enableOnFormTags: false, preventDefault: true },
    [cycleView],
  );
  useHotkeys(
    'left,k',
    () => cycleView(-1),
    { enableOnFormTags: false, preventDefault: true },
    [cycleView],
  );

  return (
    <ToggleGroupPrimitive
      value={[view]}
      onValueChange={(next) => {
        const value = next[0];
        if ((VIEWS as readonly string[]).includes(value)) {
          void setView(value as HomeViewId);
          scrollToViewSection();
        }
      }}
      className={cn(
        'inline-flex h-8 items-center overflow-hidden rounded-lg border border-border',
        className,
      )}
    >
      {VIEWS.map((item) => (
        <TogglePrimitive
          key={item}
          value={item}
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'default' }),
            'relative h-8 rounded-none border-0 px-3',
            'not-last:border-r not-last:border-border',
            'text-muted-foreground',
            'data-pressed:bg-muted data-pressed:text-foreground',
            'dark:data-pressed:bg-input',
          )}
        >
          {VIEW_LABELS[item]}
        </TogglePrimitive>
      ))}
    </ToggleGroupPrimitive>
  );
}
