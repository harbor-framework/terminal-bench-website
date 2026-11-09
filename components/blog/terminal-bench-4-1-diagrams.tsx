import { useId } from 'react';
import { RegradingDiagram } from './regrading-diagram';
import styles from './terminal-bench-4-1-diagrams.module.css';

export function GradingBoundaryDiagram({ regrade = false }: { regrade?: boolean }) {
  const arrowId = useId();
  if (regrade) return <RegradingDiagram />;
  return (
    <figure id={regrade ? 'regrading-boundary-diagram' : 'grading-boundary-diagram'} className={`not-prose ${styles.figure}`}>
      <figcaption className={styles.header}>{regrade ? 'regrade tasks with cached artifacts' : 'reward hack resistant verification'}</figcaption>
      <div className={styles.diagramPane} role="region" tabIndex={0} aria-label={regrade ? 'Regrade artifact flow' : 'Agent trial artifact flow'}>
        <svg viewBox="0 0 520 340" className={styles.diagram} role="img" aria-label={regrade
          ? 'Harbor accesses a cached sanitized artifact and uploads it to the separate verifier container with updated tests. RewardKit isolates its execution from the trusted grader.'
          : 'The agent authors code artifacts in the agent environment. Harbor sanitizes it on the way to the host, then uploads it to the separate verifier container. RewardKit isolates artifact execution from the trusted grader.'}>
          <defs>
            <marker id={arrowId} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M1 1L7 4L1 7Z" className={styles.arrowHead} />
            </marker>
          </defs>

          {!regrade && <>
            <rect x="18" y="24" width="230" height="182" className={styles.environment} />
            <text x="34" y="48" className={styles.environmentLabel}>Agent Environment</text>
          </>}
          {!regrade && <>
            <rect x="63" y="128" width="140" height="38" className={styles.artifact} />
            <text x="133" y="151" textAnchor="middle" className={styles.artifactLabel}>Artifact</text>
          </>}

          <rect x="272" y="24" width="230" height="182" className={styles.environment} />
          <text x="290" y="48" className={styles.environmentLabel}>{regrade ? 'Verifier Container' : 'Verifier Environment'}</text>
          <rect x="290" y="76" width="194" height="112" className={styles.worker} />
          <text x="304" y="100" className={styles.workerLabel}>rewardkit worker</text>
          <rect x="317" y="128" width="140" height="38" className={styles.artifact} />
          <text x="387" y="151" textAnchor="middle" className={styles.artifactLabel}>{regrade ? 'Cached Artifact' : 'Artifact'}</text>

          {!regrade && <>
            <path d="M133 166V218" className={styles.flow} markerEnd={`url(#${arrowId})`} />
            <rect x="83" y="218" width="100" height="28" className={styles.sanitizer} />
            <text x="133" y="236" textAnchor="middle" className={styles.body}>Sanitize</text>
            <path d="M133 246V264" className={styles.flow} markerEnd={`url(#${arrowId})`} />
          </>}

          <rect x="18" y="264" width="484" height="56" className={styles.host} />
          <text x="260" y="298" textAnchor="middle" className={styles.environmentLabel}>Harbor Host</text>
          <path d="M387 264V166" className={styles.flow} markerEnd={`url(#${arrowId})`} />
        </svg>
      </div>
    </figure>
  );
}
