"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import snapshot from "@/content/blog/data/terminal-bench-4-1-regrade.json";
import styles from "./terminal-bench-4-1-waffle.module.css";

type Trial = {
  id: string; job: string | null; submission: number; before: boolean; after: boolean;
  regradeId?: string; regradeJob?: string | null; reason?: string;
};
const status = (trial: Trial) => trial.before === trial.after ? (trial.after ? "pass" : "fail") : trial.after ? "gain" : "loss";
const rank = { pass: 0, gain: 1, loss: 2, fail: 3 };
const labels = { pass: "Still passing", gain: "fail to pass", loss: "pass to fail", fail: "Still failing" };


export function RegradeWaffle() {
  const [pinned, setPinned] = useState(false);
  const [active, setActive] = useState<{ row: number; col: number; x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const hoverFrame = useRef(0);
  const hoverPoint = useRef({ x: 0, y: 0 });
  const hoverCell = useRef<{ row: number; col: number } | null>(null);
  function cancelHover() {
    cancelAnimationFrame(hoverFrame.current);
    hoverFrame.current = 0;
    hoverCell.current = null;
  }
  useEffect(() => () => cancelAnimationFrame(hoverFrame.current), []);
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(728);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(1, entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const rows = useMemo(() => snapshot.tasks.map(task => {
    const trials: Trial[] = [...task.trials].sort((a, b) => rank[status(a)] - rank[status(b)] || a.submission - b.submission || a.id.localeCompare(b.id));
    const before = trials.filter(t => t.before).length;
    const after = trials.filter(t => t.after).length;
    return { task: task.task, trials: trials.filter(t => t.before !== t.after), before, after, delta: after - before };
  }).sort((a, b) => b.trials.length - a.trials.length || a.task.localeCompare(b.task))
    .filter(row => row.trials.length > 0), []);
  const stacked = width < 500;
  const left = stacked ? 0 : 240;
  const cellWidth = Math.min(18, (width - left) / Math.max(...rows.map(row => row.trials.length)));
  const cellSize = Math.max(1, Math.min(12.6, cellWidth - 3));
  const rowHeight = stacked ? 40 : 22;
  const height = 25 + rows.length * rowHeight + 4;
  const trial = active && rows[active.row]?.trials[active.col];
  const submission = trial ? snapshot.submissions[trial.submission] : null;
  const task = active ? rows[active.row] : null;
  function show(row: number, col: number, element: Element) {
    const bounds = element.getBoundingClientRect();
    const surface = svgRef.current!.getBoundingClientRect();
    setActive({ row, col, x: bounds.left - surface.left + bounds.width / 2, y: bounds.bottom - surface.top });
  }
  const grid = useMemo(() => rows.map((row, rowIndex) => <g key={row.task}>
    <a href={`https://hub.harborframework.com/tasks/terminal-bench/${row.task}`} target="_blank" rel="noopener noreferrer" className={styles.taskLink}>
      <text x="0" y={25 + rowIndex * rowHeight + (stacked ? 4 : 10.3)} className={styles.task}>{row.task}</text>
    </a>
    {row.trials.map((t, col) => <g key={t.id} role="button" aria-label={`${row.task}, ${snapshot.submissions[t.submission].model}, ${labels[status(t)]}`}>
      <rect data-cell="" data-row={rowIndex} data-col={col} x={left + col * cellWidth} y={25 + rowIndex * rowHeight + (stacked ? 18 : 6.3) - cellSize / 2} width={cellSize} height={cellSize} className={styles[status(t)]} />
    </g>)}
  </g>), [rows, cellWidth, cellSize, rowHeight, stacked, left]);
  const details = trial && submission && task && <div className={styles.tip}>
    <strong>{task.task}</strong>
    <span>{submission.model} · {submission.effort}</span>
    <span>{submission.agent}</span>
    <span className={status(trial) === 'gain' ? styles.positive : styles.negative}>TB 4.0 {trial.before ? 'pass' : 'fail'} → TB 4.1 {trial.after ? 'pass' : 'fail'}</span>
    {trial.reason && <p>{trial.reason}</p>}
    <div className={styles.links}>
      <a href={`https://hub.harborframework.com/jobs/${trial.job}/trials/${trial.id}`} target="_blank" rel="noopener noreferrer">Original TB 4.0 trial</a>
      <a href={`https://hub.harborframework.com/jobs/6179005b-d9e6-5304-8eb3-5564518ac97b/trials/${trial.regradeId}`} target="_blank" rel="noopener noreferrer">Regrade trial</a>
    </div>
  </div>;
  const chart = (
    <figure className={`not-prose ${styles.figure}`}>
      <div className={styles.header}>
        <span>regraded leaderboard trials</span>
      </div>
      <div className={styles.legend}>{(['gain', 'loss'] as const).map(key => <span key={key}><i className={styles[key]} />{labels[key]}</span>)}</div>
      <div ref={container} className={styles.scroll}>
        <div className={styles.surface}>
          <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} className={styles.chart}
            role="group" aria-label="Changed trials only: new passes and new failures by task. Use arrow keys to explore trials; Enter pins the trial details." tabIndex={0}
            onMouseLeave={() => { cancelHover(); if (!pinned) setActive(null); }} onBlur={() => { cancelHover(); if (!pinned) setActive(null); }}
            onClick={event => {
              const cell = (event.target as Element).closest('[data-cell]');
              if (cell) {
                cancelHover();
                show(Number(cell.getAttribute('data-row')), Number(cell.getAttribute('data-col')), cell);
                setPinned(true);
              }
            }}
            onMouseMove={event => {
              if (pinned) return;
              hoverPoint.current = { x: event.clientX, y: event.clientY };
              const cell = (event.target as Element).closest('[data-cell]');
              if (cell) hoverCell.current = { row: Number(cell.getAttribute('data-row')), col: Number(cell.getAttribute('data-col')) };
              if (hoverFrame.current) return;
              hoverFrame.current = requestAnimationFrame(() => {
                hoverFrame.current = 0;
                const svg = svgRef.current;
                if (!svg) return;
                const bounds = svg.getBoundingClientRect();
                const x = hoverPoint.current.x - bounds.left;
                const y = hoverPoint.current.y - bounds.top;
                const svgX = x * width / bounds.width;
                const svgY = y * height / bounds.height;
                const row = Math.floor((svgY - 25) / rowHeight);
                const rowEnd = left + (rows[row]?.trials.length ?? 0) * cellWidth;
                if (svgX < left || svgX > rowEnd || row < 0 || row >= rows.length) {
                  hoverCell.current = null;
                  setActive(null);
                  return;
                }
                const next = hoverCell.current;
                hoverCell.current = null;
                // Preserve the details while crossing the gaps between squares.
                setActive(previous => next ? { ...next, x: x + 19, y } : previous ? { ...previous, x: x + 19, y } : null);
              });
            }}
            onKeyDown={event => {
              if ((event.target as Element).closest('a')) return;
              cancelHover();
              if (event.key === 'Escape') { setPinned(false); setActive(null); return; }
              if ((event.key === 'Enter' || event.key === ' ') && trial) { event.preventDefault(); setPinned(true); return; }
              if (pinned) return;
              if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
              event.preventDefault();
              const row = Math.max(0, Math.min(rows.length - 1, (active?.row ?? 0) + (event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0)));
              const col = Math.max(0, Math.min(rows[row].trials.length - 1, (active?.col ?? 0) + (event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0)));
              const cell = svgRef.current?.querySelector(`[data-row="${row}"][data-col="${col}"]`);
              if (cell) show(row, col, cell);
            }}>
            <text x="0" y="16" className={styles.column}>task</text>
            {grid}

          </svg>
          <Popover open={!!trial} onOpenChange={(open, details) => {
            if (!open) {
              const target = details.event.target;
              if (target instanceof Element && svgRef.current?.contains(target) && target.closest('[data-cell]')) { details.cancel(); return; }
              setPinned(false);
              setActive(null);
            }
          }}>
            <PopoverTrigger tabIndex={-1} aria-hidden className={styles.anchor} style={{ left: active?.x ?? 0, top: active?.y ?? 0 }} />
            <PopoverContent side="bottom" align="start" sideOffset={10} initialFocus={false} finalFocus={() => { svgRef.current?.focus(); return false; }} className={`data-open:animate-none data-closed:animate-none w-72 max-w-[calc(100vw-2rem)] rounded-none border border-border bg-background p-3 text-xs shadow-none ring-0 ${pinned ? "" : "pointer-events-none"}`}>
              <PopoverTitle className="sr-only">Trial details</PopoverTitle>
              <button type="button" className={styles.close} aria-label="Close trial details" onClick={() => { setPinned(false); setActive(null); }}>×</button>
              {details}
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <span className="sr-only" aria-live="polite">{trial && submission && task ? `${task.task}, ${submission.model}, ${submission.agent}, ${submission.effort}: 4.0 ${trial.before ? "pass" : "fail"}, 4.1 ${trial.after ? "pass" : "fail"}. ${trial.reason ?? ""}` : ""}</span>
      <p className={styles.hint}>hover over trial square for details</p>
    </figure>
  );
  return chart;
}
