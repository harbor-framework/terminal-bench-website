"use client";

import { Maximize2, Minimize2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { useEffect, useMemo, useRef, useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import snapshot from "@/content/blog/data/terminal-bench-4-1-regrade.json";
import styles from "./terminal-bench-4-1-waffle.module.css";

type Trial = {
  id: string; job: string | null; submission: number; before: boolean; after: boolean;
  regradeId?: string; regradeJob?: string | null; reason?: string;
};
const status = (trial: Trial) => trial.before === trial.after ? (trial.after ? "pass" : "fail") : trial.after ? "gain" : "loss";
const rank = { pass: 0, gain: 1, loss: 2, fail: 3 };
const labels = { pass: "Still passing", gain: "New pass", loss: "New failure", fail: "Still failing" };
const signed = (n: number) => `${n > 0 ? "+" : ""}${n}`;
const trialUrl = (trial: Trial) => {
  const id = trial.regradeId ?? trial.id;
  const job = trial.regradeJob ?? trial.job;
  return job ? `https://hub.harborframework.com/jobs/${job}/trials/${id}` : undefined;
};

export function RegradeWaffle() {
  const [expanded, setExpanded] = useState(false);
  const [changedOnly, setChangedOnly] = useState(true);
  const [active, setActive] = useState<{ row: number; col: number; x: number; y: number } | null>(null);
  const expandRef = useRef<HTMLButtonElement>(null);
  const wasExpanded = useRef(false);
  useEffect(() => {
    if (wasExpanded.current && !expanded) expandRef.current?.focus();
    wasExpanded.current = expanded;
  }, [expanded]);
  const svgRef = useRef<SVGSVGElement>(null);
  const rows = useMemo(() => snapshot.tasks.map(task => {
    const trials: Trial[] = [...task.trials].sort((a, b) => rank[status(a)] - rank[status(b)] || a.submission - b.submission || a.id.localeCompare(b.id));
    const before = trials.filter(t => t.before).length;
    const after = trials.filter(t => t.after).length;
    return { task: task.task, trials, before, after, delta: after - before };
  }).sort((a, b) => b.after - a.after || a.task.localeCompare(b.task))
    .filter(row => !changedOnly || row.trials.some(t => t.before !== t.after)), [changedOnly]);
  const maxTrials = Math.max(...rows.map(row => row.trials.length));
  const width = 292 + maxTrials * 8;
  const height = 28 + rows.length * 22;
  const trial = active && rows[active.row]?.trials[active.col];
  const submission = trial ? snapshot.submissions[trial.submission] : null;
  const task = active ? rows[active.row] : null;
  function show(row: number, col: number, element: Element) {
    const bounds = element.getBoundingClientRect();
    const surface = svgRef.current!.getBoundingClientRect();
    setActive({ row, col, x: bounds.left - surface.left + bounds.width / 2, y: bounds.bottom - surface.top });
  }
  const grid = useMemo(() => rows.map((row, rowIndex) => <g key={row.task}>
    <text x="244" y={32 + rowIndex * 22} textAnchor="end" className={styles.task}>{row.task}</text>
    {row.trials.map((t, col) => <a key={t.id} href={trialUrl(t)} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-label={`${row.task}, ${snapshot.submissions[t.submission].model}, ${labels[status(t)]}`}>
      <rect data-cell="" data-row={rowIndex} data-col={col} x={254 + col * 8} y={23 + rowIndex * 22} width="7" height="7" className={styles[status(t)]} />
    </a>)}
    <text x={width - 2} y={32 + rowIndex * 22} textAnchor="end" className={`${styles.task} ${row.delta > 0 ? styles.positive : row.delta < 0 ? styles.negative : styles.neutral}`}>{signed(row.delta)}</text>
  </g>), [rows, width]);
  const chart = (
    <figure className={`not-prose ${styles.figure} ${expanded ? styles.expanded : ""}`}>
      <div className={styles.header}>
        <span>Task-Level Score Changes in TB4.1</span>
        <label><input type="checkbox" checked={changedOnly} onChange={event => { setActive(null); setChangedOnly(event.target.checked); }} /> Changed tasks only</label>
        {expanded ? <DialogClose className={styles.expandButton} aria-label="Collapse chart"><Minimize2 size={16} /> Collapse</DialogClose> : <DialogTrigger ref={expandRef} className={styles.expandButton} aria-label="Expand chart"><Maximize2 size={16} /> Expand</DialogTrigger>}
      </div>
      <div className={styles.scroll}>
        <div className={styles.surface} style={{ minWidth: expanded ? width : 800 }}>
          <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} className={styles.chart}
            role="group" aria-label="Regraded trial outcomes by task. Use arrow keys to explore trials; Enter opens the trial." tabIndex={0}
            onMouseLeave={() => setActive(null)} onBlur={() => setActive(null)}
            onMouseOver={event => {
              const cell = (event.target as Element).closest('[data-cell]');
              if (cell) show(Number(cell.getAttribute('data-row')), Number(cell.getAttribute('data-col')), cell);
            }}
            onKeyDown={event => {
              if (event.key === 'Escape') { setActive(null); return; }
              if (event.key === 'Enter' && trial) { const url = trialUrl(trial); if (url) window.open(url, '_blank', 'noopener,noreferrer'); return; }
              if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
              event.preventDefault();
              const row = Math.max(0, Math.min(rows.length - 1, (active?.row ?? 0) + (event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0)));
              const col = Math.max(0, Math.min(rows[row].trials.length - 1, (active?.col ?? 0) + (event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0)));
              const cell = svgRef.current?.querySelector(`[data-row="${row}"][data-col="${col}"]`);
              if (cell) show(row, col, cell);
            }}>
            <text x="244" y="12" textAnchor="end" className={styles.column}>Task</text>
            <text x={width - 2} y="12" textAnchor="end" className={styles.column}>Net Δ</text>
            {grid}
            {active && <rect x={253.5 + active.col * 8} y={22.5 + active.row * 22} width="8" height="8" fill="none" stroke="var(--foreground)" strokeWidth="1" pointerEvents="none" />}

          </svg>
          <Tooltip open={!!trial}>
            <TooltipTrigger tabIndex={-1} aria-hidden className={styles.anchor} style={{ left: active?.x ?? 0, top: active?.y ?? 0 }} />
            <TooltipContent variant="chart" side="bottom" align="start" sideOffset={10} className="pointer-events-none w-72 max-w-72">
              {trial && submission && task && <div className={styles.tip}>
                <strong>{task.task}</strong>
                <span>{submission.model} · {submission.effort}</span>
                <span>{submission.agent}</span>
                <span className={status(trial) === 'gain' ? styles.positive : status(trial) === 'loss' ? styles.negative : ''}>4.0 {trial.before ? 'pass' : 'fail'} → 4.1 {trial.after ? 'pass' : 'fail'}</span>
                {trial.reason && <p>{trial.reason}</p>}
                <span className={styles.neutral}>Task: {task.before} → {task.after} passes · net {signed(task.delta)}</span>
                <small>{trial.regradeId ? 'Click to view regrade trial' : 'Click to view original trial'} · {trial.id.slice(0, 8)}</small>
              </div>}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
      <span className="sr-only" aria-live="polite">{trial && submission && task ? `${task.task}, ${submission.model}, ${submission.agent}, ${submission.effort}: 4.0 ${trial.before ? "pass" : "fail"}, 4.1 ${trial.after ? "pass" : "fail"}. ${trial.reason ?? ""}` : ""}</span>
      <div className={styles.legend}>{(['pass', 'gain', 'loss', 'fail'] as const).map(key => <span key={key}><i className={styles[key]} />{labels[key]}</span>)}</div>
    </figure>
  );
  return <Dialog open={expanded} onOpenChange={open => { setActive(null); setExpanded(open); }}>
    {!expanded && chart}
    <DialogContent finalFocus={false} showCloseButton={false} className="w-[calc(100vw-2rem)] max-w-none sm:max-w-none max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-none p-0 gap-0">
      <DialogTitle className="sr-only">Expanded regrade chart</DialogTitle>
      {expanded && chart}
    </DialogContent>
  </Dialog>;
}
