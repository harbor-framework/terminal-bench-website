"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Embeds one card from the static TB 4.0 chart page. The page posts its
 * rendered height so the iframe hugs the chart with no inner scrollbars.
 */
export function ChartFrame({
  chart,
  model,
  title,
  initialHeight,
}: {
  chart: string;
  model?: string;
  title: string;
  initialHeight: number;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(initialHeight);
  const heightRef = useRef(initialHeight);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== frameRef.current?.contentWindow) return;
      const data = event.data as {
        type?: string;
        height?: number;
        fromToggle?: boolean;
      };
      if (data?.type === "tb-chart-height" && typeof data.height === "number") {
        const next = Math.ceil(data.height);
        // When an in-card collapse shrinks the chart, scroll up by the same
        // amount so the content below it stays put on screen.
        if (data.fromToggle && next < heightRef.current) {
          window.scrollBy({ top: next - heightRef.current });
        }
        heightRef.current = next;
        setHeight(next);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Tell the chart page the site theme so it can keep fixed-color elements
  // (error pink, dark tooltips) exact under the light-mode invert filter.
  useEffect(() => {
    const root = document.documentElement;
    const frame = frameRef.current;
    function send() {
      frame?.contentWindow?.postMessage(
        { type: "tb-theme", dark: root.classList.contains("dark") },
        "*",
      );
    }
    const observer = new MutationObserver(send);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    frame?.addEventListener("load", send);
    send();
    return () => {
      observer.disconnect();
      frame?.removeEventListener("load", send);
    };
  }, []);

  const src = `/blog/terminal-bench-4-0/rollout-charts.html?chart=${encodeURIComponent(chart)}${model ? `&model=${encodeURIComponent(model)}` : ""}`;

  return (
    // The chart page is dark by design; in light mode invert+hue-rotate
    // approximates a light theme while keeping the accent hues.
    <iframe
      ref={frameRef}
      src={src}
      title={title}
      className="invert hue-rotate-180 dark:invert-0 dark:hue-rotate-0"
      style={{
        width: "100%",
        height,
        border: 0,
        overflow: "hidden",
        display: "block",
      }}
      scrolling="no"
      loading="lazy"
    />
  );
}
