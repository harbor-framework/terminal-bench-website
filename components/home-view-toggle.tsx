"use client";

import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";
import { useRouter } from "next/navigation";
import { createParser, useQueryState } from "nuqs";
import { useCallback } from "react";
import { useHotkeys } from "react-hotkeys-hook";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const VIEWS = ["leaderboard", "pareto", "waffle"] as const;
export type HomeViewId = (typeof VIEWS)[number];

const VIEW_LABELS: Record<HomeViewId, string> = {
  leaderboard: "TABLE",
  pareto: "PARETO",
  waffle: "WAFFLE",
};

export const parseHomeView = createParser({
  parse(value) {
    // Former bar/charts view — resolution bars live on the leaderboard now.
    if (value === "bar" || value === "charts") return "leaderboard" as const;
    if ((VIEWS as readonly string[]).includes(value))
      return value as HomeViewId;
    return null;
  },
  serialize(value) {
    return value;
  },
}).withDefault("leaderboard" satisfies HomeViewId);

/** Smoothly bring the view section near the top of the viewport. */
// Sticky nav (56px) plus the same 6px gap that sits between the toggles
// and the view box.
const VIEW_SCROLL_MARGIN = 62;

function scrollToViewSection() {
  const element = document.getElementById("home-view-section");
  if (!element) return;
  const target =
    window.scrollY + element.getBoundingClientRect().top - VIEW_SCROLL_MARGIN;
  // Keep the page tall enough for the target to stay reachable even while
  // the outgoing view unmounts (otherwise the scroll clamps and bounces).
  // The body is a flex column, so the extra height pushes the footer to the
  // true bottom of the page instead of leaving space below it.
  const minHeight = Math.ceil(target + window.innerHeight);
  document.body.style.minHeight = `${minHeight}px`;
  try {
    // Survives reloads so restored scroll positions don't clamp.
    sessionStorage.setItem("tb-home-min-height", String(minHeight));
  } catch {
    // Storage may be unavailable; the snap still works for this page view.
  }
  window.scrollTo({ top: target, behavior: "smooth" });
}

/** URL params that belong to a single view; stashed while it isn't active. */
const VIEW_PARAMS: Record<HomeViewId, string[]> = {
  leaderboard: ["hide"],
  pareto: ["x", "marks"],
  waffle: ["rows", "group", "labels"],
};

const stashKey = (view: HomeViewId) => `tb-view-params:${view}`;

export function HomeViewToggle({ className }: { className?: string }) {
  const [view] = useQueryState("view", parseHomeView);
  const router = useRouter();

  // Move the outgoing view's params out of the URL (kept in sessionStorage so
  // toggling back restores them) and bring the incoming view's params back.
  const switchView = useCallback(
    (next: HomeViewId) => {
      if (next === view) return;
      const url = new URL(window.location.href);
      try {
        const stash: Record<string, string> = {};
        for (const key of VIEW_PARAMS[view]) {
          const value = url.searchParams.get(key);
          if (value !== null) {
            stash[key] = value;
            url.searchParams.delete(key);
          }
        }
        sessionStorage.setItem(stashKey(view), JSON.stringify(stash));
        const saved = JSON.parse(
          sessionStorage.getItem(stashKey(next)) ?? "{}",
        ) as Record<string, string>;
        for (const [key, value] of Object.entries(saved)) {
          url.searchParams.set(key, value);
        }
      } catch {
        // Storage unavailable: params simply stay in the URL.
      }
      if (next === "leaderboard") url.searchParams.delete("view");
      else url.searchParams.set("view", next);
      router.replace(url.pathname + url.search + url.hash, { scroll: false });
      scrollToViewSection();
    },
    [router, view],
  );

  const cycleView = useCallback(
    (direction: 1 | -1) => {
      const index = VIEWS.indexOf(view);
      const next = VIEWS[(index + direction + VIEWS.length) % VIEWS.length]!;
      switchView(next);
    },
    [switchView, view],
  );

  useHotkeys(
    "right,j",
    () => cycleView(1),
    { enableOnFormTags: false, preventDefault: true },
    [cycleView],
  );
  useHotkeys(
    "left,k",
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
          switchView(value as HomeViewId);
        }
      }}
      className={cn(
        "inline-flex h-8 items-center overflow-hidden rounded-lg border border-border",
        className,
      )}
    >
      {VIEWS.map((item) => (
        <TogglePrimitive
          key={item}
          value={item}
          className={cn(
            buttonVariants({ variant: "ghost", size: "default" }),
            "relative h-8 rounded-none border-0 px-3",
            "not-last:border-r not-last:border-border",
            "text-muted-foreground",
            "data-pressed:bg-muted data-pressed:text-foreground",
            "dark:data-pressed:bg-input",
          )}
        >
          {VIEW_LABELS[item]}
        </TogglePrimitive>
      ))}
    </ToggleGroupPrimitive>
  );
}
