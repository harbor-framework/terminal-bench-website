import { useId } from 'react';
import styles from './terminal-bench-4-1-diagrams.module.css';

export function GradingBoundaryDiagram({ regrade = false }: { regrade?: boolean }) {
  const arrowId = useId();
  return (
    <figure id={regrade ? 'regrading-boundary-diagram' : 'grading-boundary-diagram'} className={`not-prose ${styles.figure}`}>
      <div className={styles.diagramPane} role="region" tabIndex={0} aria-label={regrade ? 'Regrade artifact flow' : 'Agent trial artifact flow'}>
        <svg viewBox="0 0 520 383" className={styles.diagram} role="img" aria-label={regrade
          ? 'Harbor accesses a cached sanitized artifact and uploads it to the separate verifier container. RewardKit isolates its execution from the trusted grader.'
          : 'The agent authors code artifacts in the agent environment. Harbor sanitizes it on the way to the host, then uploads it to the separate verifier container. RewardKit isolates artifact execution from the trusted grader.'}>
          <defs>
            <marker id={arrowId} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M1 1L7 4L1 7" className={styles.arrowHead} />
            </marker>
          </defs>

          {!regrade && <>
            <rect x="18" y="24" width="230" height="190" className={styles.environment} />
            <text x="34" y="52" className={styles.environmentLabel}>Agent Environment</text>
            <text x="34" y="94" className={styles.detail}>Agent authors code artifacts</text>
          </>}
          <rect x="30" y={regrade ? 141 : 112} width="206" height={regrade ? 46 : 75} className={styles.artifact} />
          <text x="133" y={regrade ? 169 : 155} textAnchor="middle" className={styles.body}>{regrade ? 'Cached Sanitized Artifact' : 'Artifact'}</text>

          <rect x="272" y="24" width="230" height="246" className={styles.environment} />
          <text x="290" y="48" className={styles.environmentLabel}><tspan x="290">Separate Verifier</tspan><tspan x="290" dy="19">Container</tspan></text>
          <text x="290" y="94" className={styles.small}>Trusted process assigns award</text>
          <rect x="290" y="112" width="194" height="140" className={styles.worker} />
          <text x="304" y="136" className={styles.workerLabel}>RewardKit Worker</text>
          <text x="304" y="158" className={styles.small}>Separate process</text>
          <text x="304" y="177" className={styles.small}>Unprivileged user</text>
          <rect x="302" y="196" width="170" height="40" className={styles.artifact} />
          <text x="387" y="221" textAnchor="middle" className={styles.body}>Clean Artifact</text>

          {regrade ? <path d="M133 187V288" className={styles.flow} markerEnd={`url(#${arrowId})`} /> : <>
            <path d="M133 187V230" className={styles.flow} markerEnd={`url(#${arrowId})`} />
            <rect x="18" y="230" width="230" height="40" className={styles.sanitizer} />
            <text x="133" y="255" textAnchor="middle" className={styles.body}>Sanitize</text>
            <path d="M133 270V288" className={styles.flow} markerEnd={`url(#${arrowId})`} />
          </>}
          <rect x="18" y="288" width="484" height="64" className={styles.host} />
          <text x="260" y="326" textAnchor="middle" className={styles.environmentLabel}>Harbor Host</text>
          <path d="M387 288V236" className={styles.flow} markerEnd={`url(#${arrowId})`} />
        </svg>
      </div>
    </figure>
  );
}
