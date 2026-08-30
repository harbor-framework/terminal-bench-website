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
// Sticky nav (56px) plus the same 6px gap that sits between the toggles
// and the view box.
const VIEW_SCROLL_MARGIN = 62;

function adjustViewSnap() {
  const element = document.getElementById('home-view-section');
  if (!element) return;
  const target = () =>
    window.scrollY + element.getBoundingClientRect().top - VIEW_SCROLL_MARGIN;
  // Short views (e.g. pareto on a phone) don't leave enough page below the
  // section for the scroll to reach the target; pad the body by exactly the
  // missing amount so the snap lands, and drop the padding when it isn't
  // needed so no dead space is reserved otherwise.
  const currentPad = parseFloat(document.body.style.paddingBottom) || 0;
  const baseHeight = document.documentElement.scrollHeight - currentPad;
  const needed = Math.max(
    0,
    Math.ceil(target() + window.innerHeight - baseHeight),
  );
  document.body.style.paddingBottom = needed > 0 ? `${needed}px` : '';
  window.scrollTo({ top: target(), behavior: 'smooth' });
}

function scrollToViewSection() {
  adjustViewSnap();
  // The clicked view may swap in shorter content after the scroll starts,
  // clamping it short of the target; re-adjust once the new view has
  // rendered, unless the user has since scrolled somewhere else.
  window.setTimeout(() => {
    const element = document.getElementById('home-view-section');
    if (!element) return;
    const target =
      window.scrollY + element.getBoundingClientRect().top - VIEW_SCROLL_MARGIN;
    if (Math.abs(window.scrollY - target) <= 150) adjustViewSnap();
  }, 450);
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
