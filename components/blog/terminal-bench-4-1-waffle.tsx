"use client";

import { useMemo, useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import snapshot from "@/content/blog/data/terminal-bench-4-1-regrade.json";
import styles from "./terminal-bench-4-1-waffle.module.css";

type Trial = {
  id: string; job: string | null; submission: number; before: boolean; after: boolean;
  regradeId?: string; regradeJob?: string | null; reason?: string;
};
const status = (trial: Trial) => trial.before === trial.after ? (trial.after ? "pass" : "fail") : trial.after ? "gain" : "loss";
const rank = { pass: 0, gain: 1, loss: 2, fail: 3 };
const labels = { pass: "Still passing", gain: "New pass", loss: "New failure", fail: "Still failing" };


export function RegradeWaffle() {
  const [pinned, setPinned] = useState(false);
  const [active, setActive] = useState<{ row: number; col: number; x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const rows = useMemo(() => snapshot.tasks.map(task => {
    const trials: Trial[] = [...task.trials].sort((a, b) => rank[status(a)] - rank[status(b)] || a.submission - b.submission || a.id.localeCompare(b.id));
    const before = trials.filter(t => t.before).length;
    const after = trials.filter(t => t.after).length;
    return { task: task.task, trials: trials.filter(t => t.before !== t.after), before, after, delta: after - before };
  }).sort((a, b) => b.trials.filter(t => t.after).length - a.trials.filter(t => t.after).length || a.task.localeCompare(b.task))
    .filter(row => row.trials.length > 0), []);
  const width = 728;
  const left = 260;
  const cellWidth = 20;
  const rowHeight = 32;
  const height = 28 + rows.length * rowHeight;
  const trial = active && rows[active.row]?.trials[active.col];
  const submission = trial ? snapshot.submissions[trial.submission] : null;
  const task = active ? rows[active.row] : null;
  function show(row: number, col: number, element: Element) {
    const bounds = element.getBoundingClientRect();
    const surface = svgRef.current!.getBoundingClientRect();
    setActive({ row, col, x: bounds.left - surface.left + bounds.width / 2, y: bounds.bottom - surface.top });
  }
  const grid = useMemo(() => rows.map((row, rowIndex) => <g key={row.task}>
    <text x="12" y={38 + rowIndex * rowHeight} className={styles.task}>{row.task}</text>
    {row.trials.map((t, col) => <g key={t.id} role="button" aria-label={`${row.task}, ${snapshot.submissions[t.submission].model}, ${labels[status(t)]}`}>
      <rect data-cell="" data-row={rowIndex} data-col={col} x={left + col * cellWidth} y={25 + rowIndex * rowHeight} width="16" height="16" className={styles[status(t)]} />
    </g>)}
  </g>), [rows, cellWidth]);
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
        <span>Task-Level Score Changes in TB 4.1</span>
      </div>
      <div className={styles.scroll}>
        <div className={styles.surface}>
          <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} className={styles.chart}
            role="group" aria-label="Changed trials only: new passes and new failures by task. Use arrow keys to explore trials; Enter pins the trial details." tabIndex={0}
            onMouseLeave={() => { if (!pinned) setActive(null); }} onBlur={() => { if (!pinned) setActive(null); }}
            onClick={event => {
              const cell = (event.target as Element).closest('[data-cell]');
              if (cell) {
                show(Number(cell.getAttribute('data-row')), Number(cell.getAttribute('data-col')), cell);
                setPinned(true);
              }
            }}
            onMouseOver={event => {
              if (pinned) return;
              const cell = (event.target as Element).closest('[data-cell]');
              if (cell) show(Number(cell.getAttribute('data-row')), Number(cell.getAttribute('data-col')), cell);
            }}
            onKeyDown={event => {
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
            <text x="12" y="12" className={styles.column}>Task</text>
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
            <PopoverContent side="bottom" align="start" sideOffset={10} initialFocus={false} finalFocus={() => { svgRef.current?.focus(); return false; }} className={`w-72 max-w-[calc(100vw-2rem)] rounded-none border border-border bg-background p-3 text-xs shadow-none ring-0 ${pinned ? "" : "pointer-events-none"}`}>
              <PopoverTitle className="sr-only">Trial details</PopoverTitle>
              <button type="button" className={styles.close} aria-label="Close trial details" onClick={() => { setPinned(false); setActive(null); }}>×</button>
              {details}
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <span className="sr-only" aria-live="polite">{trial && submission && task ? `${task.task}, ${submission.model}, ${submission.agent}, ${submission.effort}: 4.0 ${trial.before ? "pass" : "fail"}, 4.1 ${trial.after ? "pass" : "fail"}. ${trial.reason ?? ""}` : ""}</span>
      <div className={styles.legend}>{(['gain', 'loss'] as const).map(key => <span key={key}><i className={styles[key]} />{labels[key]}</span>)}</div>
    </figure>
  );
  return chart;
}
