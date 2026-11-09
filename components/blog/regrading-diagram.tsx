import { useId } from 'react';
import styles from './terminal-bench-4-1-diagrams.module.css';

export function RegradingDiagram() {
  const arrowId = useId();
  return <figure id="regrading-boundary-diagram" className={`not-prose ${styles.figure}`}>
    <figcaption className={styles.header}>regrade tasks with cached artifacts</figcaption>
    <svg viewBox="0 0 520 316" className={styles.diagram} role="img" aria-label="The agent environment is inactive. A cached artifact is uploaded from the Harbor host into the verifier environment for regrading without running the agent again.">
      <defs>
        <marker id={arrowId} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M1 1L7 4L1 7Z" className={styles.arrowHead} />
        </marker>
      </defs>
      <g opacity=".3">
        <rect x="18" y="24" width="230" height="182" className={styles.environment} />
        <text x="34" y="48" className={styles.environmentLabel}>agent environment</text>
      </g>
      <rect x="272" y="24" width="230" height="182" className={styles.environment} />
      <text x="290" y="48" className={styles.environmentLabel}>verifier environment</text>
      <rect x="18" y="230" width="484" height="56" className={styles.host} />
      <text x="260" y="264" textAnchor="middle" className={styles.environmentLabel}>harbor host</text>
      <path d="M387 230V166" className={styles.flow} markerEnd={`url(#${arrowId})`} />
      <rect x="317" y="128" width="140" height="38" className={styles.artifact} />
      <text x="387" y="151" textAnchor="middle" className={styles.artifactLabel}>cached artifact</text>
    </svg>
  </figure>;
}
