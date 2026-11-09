'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import snapshot from '@/content/blog/data/terminal-bench-4-1-score-comparison.json';
import styles from './terminal-bench-4-1-score-comparison.module.css';

const TOP = 25;
const BAR_HEIGHT = 12.6;
const signed = (delta: number) => delta === 0 ? '0.0' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}`;

export function LeaderboardScoreComparison() {
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(768);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(1, entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const stacked = width < 500;
  const effortX = expanded ? 132 : 100;
  const agentX = expanded ? 206 : 158;
  const left = stacked ? 0 : expanded ? 313 : 264;
  const plot = Math.max(1, width - left - 60);
  const rowHeight = stacked ? 40 : 22;
  const submissions = [...snapshot.submissions].sort((a, b) => b.before - a.before);
  const maxEntries = submissions.filter(row => row.effort === 'max');
  const rows = expanded ? submissions : maxEntries.slice(0, 10);
  const height = TOP + rows.length * rowHeight + 4;
  const axisMinimum = 0;
  const axisMaximum = 75;
  const ticks = plot < 240 ? [0, 25, 50, 75] : [0, 10, 20, 30, 40, 50, 60, 70];
  const x = (score: number) => left + ((score - axisMinimum) / (axisMaximum - axisMinimum)) * plot;

  return (
    <figure id="regraded-scores-remain-within-original-confidence-intervals" className={`not-prose ${styles.figure}`}>
      <figcaption className={styles.header}>regraded leaderboard scores</figcaption>
      <div className={styles.legend}>
        <span><i className={styles.before} aria-hidden="true" />4.0 scores</span>
        <span><svg viewBox="0 0 22 12" width="22" height="12" aria-hidden="true"><path d="M2 2v8m0-4h18m0-4v8" fill="none" stroke="currentColor" /></svg>4.0 confidence interval</span>
        <span><i className={styles.gain} aria-hidden="true" />4.1 increase</span>
        <span><i className={styles.loss} aria-hidden="true" />4.1 decrease</span>
      </div>
      <div ref={container} className={styles.plot} role="region" aria-label="Leaderboard score comparison chart" tabIndex={0}>
        <svg id="leaderboard-score-comparison-plot" viewBox={`0 0 ${width} ${height}`} width={width} height={height} className={styles.chart} role="group" aria-label={`TB 4.0 versus TB 4.1 scores for ${expanded ? "all leaderboard entries" : "the top 10 max-effort leaderboard entries"}`}>
          {!stacked && <>
            <text x="0" y="16" className={styles.axis}>model</text>
            <text x={effortX} y="16" className={styles.axis}>effort</text>
            <text x={agentX} y="16" className={styles.axis}>agent</text>
          </>}
          {ticks.map(tick => (
            <g key={tick}>
              <line x1={x(tick)} x2={x(tick)} y1="25" y2={height - 8} className={styles.grid} />
              <text x={x(tick)} y="16" textAnchor="middle" className={styles.axis}>{tick}%</text>
            </g>
          ))}
          <text x={width - 2} y="16" textAnchor="end" className={styles.axis}>change</text>
          {rows.map((row, index) => {
            const cy = TOP + index * rowHeight + (stacked ? 25 : BAR_HEIGHT / 2);
            const low = row.before - row.ci95;
            const high = row.before + row.ci95;
            const description = `${row.model}, ${row.agent}, effort ${row.effort}: 4.0 ${row.before.toFixed(2)}%, 95% confidence interval ${low.toFixed(2)} to ${high.toFixed(2)}%; 4.1 ${row.after.toFixed(2)}%; change ${signed(row.delta)} percentage points.`;
            return (
              <g key={`${row.agent}/${row.model}/${row.effort}`} tabIndex={0} role="img" aria-label={description} className={styles.row}>
                <title>{description}</title>
                <text x="0" y={stacked ? cy - 11.4 : cy + 4} className={styles.model}>{row.model.toLowerCase()}</text>
                <text x={effortX} y={stacked ? cy - 11.4 : cy + 4} className={styles.model}>[{row.effort.toLowerCase()}]</text>
                <text x={agentX} y={stacked ? cy - 11.4 : cy + 4} className={styles.model}>{row.agent.toLowerCase()}</text>
                <rect x={left} y={cy - BAR_HEIGHT / 2} width={x(row.before) - left} height={BAR_HEIGHT} className={styles.before} />
                {row.delta !== 0 && <rect x={x(Math.min(row.before, row.after))} y={cy - BAR_HEIGHT / 2} width={Math.abs(x(row.after) - x(row.before))} height={BAR_HEIGHT} className={row.delta > 0 ? styles.gain : styles.loss} />}
                <path d={`M${x(low)} ${cy - 4.6}v9.2 M${x(low)} ${cy}H${x(high)} M${x(high)} ${cy - 4.6}v9.2`} className={styles.whisker} />
                <text x={width - 2} y={cy + 4} textAnchor="end" className={`${styles.value} ${row.delta > 0 ? styles.positive : row.delta < 0 ? styles.negative : ''}`}>{signed(row.delta)}%</text>
              </g>
            );
          })}
        </svg>
      </div>
      <button type="button" className={styles.expand} aria-expanded={expanded} aria-controls="leaderboard-score-comparison-plot" onClick={() => setExpanded(value => !value)}>
        {expanded ? 'show fewer' : 'show all leaderboard entries'}
        <ChevronDown size={14} aria-hidden="true" className={expanded ? styles.chevronOpen : undefined} />
      </button>
    </figure>
  );
}
