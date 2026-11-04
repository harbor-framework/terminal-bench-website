import snapshot from '@/content/blog/data/terminal-bench-4-1-score-comparison.json';
import styles from './terminal-bench-4-1-score-comparison.module.css';

const LEFT = 224;
const PLOT = 438;
const ROW = 39;
const TOP = 42;
const WIDTH = 728;
const signed = (delta: number) => delta === 0 ? '0.00' : `${delta > 0 ? '+' : ''}${delta.toFixed(2)}`;

export function LeaderboardScoreComparison() {
  const rows = snapshot.submissions;
  const height = TOP + rows.length * ROW + 10;
  const axisMinimum = 0;
  const axisMaximum = 75;
  const ticks = [0, 10, 20, 30, 40, 50, 60, 70];
  const x = (score: number) => LEFT + ((score - axisMinimum) / (axisMaximum - axisMinimum)) * PLOT;

  return (
    <figure id="regraded-scores-remain-within-original-confidence-intervals" className={`not-prose ${styles.figure}`}>
      <figcaption className={styles.header}>Regraded Scores Stay Within Original Confidence Intervals</figcaption>
      <div className={styles.legend}>
        <span><i className={styles.before} />TB4.0 score</span>
        <span><i className={styles.gain} />Increase</span>
        <span><i className={styles.loss} />Decrease</span>
        <span><svg width="22" height="12" aria-hidden="true"><path d="M2 2v8m0-4h18m0-4v8" fill="none" stroke="currentColor" /></svg>TB4.0 95% CI</span>
      </div>
      <div className={styles.scroll} role="region" aria-label="Leaderboard score comparison chart" tabIndex={0}>
        <svg viewBox={`0 0 ${WIDTH} ${height}`} width={WIDTH} height={height} className={styles.chart} role="group" aria-label={`4.0 versus 4.1 scores for ${rows.length} of 35 leaderboard submissions`}>
          {ticks.map(tick => (
            <g key={tick}>
              <line x1={x(tick)} x2={x(tick)} y1="28" y2={height - 8} className={styles.grid} />
              <text x={x(tick)} y="18" textAnchor="middle" className={styles.axis}>{tick}%</text>
            </g>
          ))}
          <text x="12" y="18" className={styles.axis}>Model / agent · effort</text>
          <text x="716" y="18" textAnchor="end" className={styles.axis}>Δ pp</text>
          {rows.map((row, index) => {
            const cy = TOP + index * ROW + 12;
            const low = row.before - row.ci95;
            const high = row.before + row.ci95;
            const description = `${row.model}, ${row.agent}, effort ${row.effort}: 4.0 ${row.before.toFixed(2)}%, 95% confidence interval ${low.toFixed(2)} to ${high.toFixed(2)}%; 4.1 ${row.after.toFixed(2)}%; change ${signed(row.delta)} percentage points.`;
            return (
              <g key={`${row.agent}/${row.model}/${row.effort}`} tabIndex={0} role="img" aria-label={description} className={styles.row}>
                <title>{description}</title>
                <text x="12" y={cy - 1} className={styles.model}>{row.model}</text>
                <text x="12" y={cy + 13} className={styles.meta}>{row.agent} · {row.effort}</text>
                <rect x={LEFT} y={cy - 4} width={x(row.before) - LEFT} height="12" className={styles.before} />
                {row.delta !== 0 && <rect x={x(Math.min(row.before, row.after))} y={cy - 4} width={Math.abs(x(row.after) - x(row.before))} height="12" className={row.delta > 0 ? styles.gain : styles.loss} />}
                <path d={`M${x(low)} ${cy - 2}v8 M${x(low)} ${cy + 2}H${x(high)} M${x(high)} ${cy - 2}v8`} className={styles.whisker} />
                <text x="716" y={cy + 7} textAnchor="end" className={`${styles.value} ${row.delta > 0 ? styles.positive : row.delta < 0 ? styles.negative : ''}`}>{signed(row.delta)}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </figure>
  );
}
