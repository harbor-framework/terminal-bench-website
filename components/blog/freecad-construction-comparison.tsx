'use client';

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRight02Icon } from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import { CAD_CAMERA, CAD_END, CAD_INTRO, cadPositions, createCadRenderer, decodeCadMeshes, type Camera, type CadData } from '@/lib/freecad-comparison';
import styles from './freecad-construction-comparison.module.css';

type Renderer = ReturnType<typeof createCadRenderer>;
const TRIAL_URLS = [
  'https://hub.harborframework.com/jobs/7595dfd2-22f0-4b03-81a9-c3c22b6ae047/trials/3e77fbd3-87c2-439c-9554-30cf284ba538',
  'https://hub.harborframework.com/jobs/5aebbab5-1f8f-4cdb-8073-c6ce785a930d/trials/abacdb00-da18-484c-8c29-2d58aa0b3bcd',
];
const LABELS = [
  ['2D sketches to 3D features', 'Opus 5 [Claude Code]'],
  ['Native 3D primitives', 'GPT-5.6 Sol [Codex]'],
];

export function FreecadConstructionComparison() {
  const figure = useRef<HTMLElement>(null);
  const canvases = useRef<(HTMLCanvasElement | null)[]>([]);
  const renderers = useRef<Renderer[]>([]);
  const camera = useRef<Camera>({ ...CAD_CAMERA });
  const position = useRef(0);
  const drag = useRef<{ id: number; x: number; y: number; azimuth: number; elevation: number } | null>(null);
  const [playing, setPlaying] = useState(true);
  const [ready, setReady] = useState(false);
  const [inView, setInView] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);
  const [visible, setVisible] = useState(true);
  const [error, setError] = useState(false);

  const draw = useCallback(() => {
    const positions = cadPositions(position.current - CAD_INTRO);
    renderers.current.forEach((renderer, lane) => renderer.render(positions[lane], camera.current));
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => {
      if (reduced.matches) {
        setPlaying(false); position.current = CAD_END; draw();
      }
    };
    updateMotion(); reduced.addEventListener('change', updateMotion);
    const updateVisibility = () => setVisible(!document.hidden);
    updateVisibility(); document.addEventListener('visibilitychange', updateVisibility);
    const observer = new IntersectionObserver(([entry]) => {
      setInView(entry.isIntersecting);
      if (entry.isIntersecting) setHasEntered(true);
    }, { threshold: .15 });
    if (figure.current) observer.observe(figure.current);
    return () => {
      observer.disconnect(); reduced.removeEventListener('change', updateMotion);
      document.removeEventListener('visibilitychange', updateVisibility);
    };
  }, [draw]);

  useEffect(() => {
    if (!hasEntered) return;
    const abort = new AbortController();
    let disposed = false;
    const created: Renderer[] = [];
    const resize = new ResizeObserver(draw);
    async function load() {
      try {
        const response = await fetch('/blog/freecad-comparison/meshes.json', { signal: abort.signal });
        if (!response.ok) throw new Error('Unable to load model geometry.');
        const data = await decodeCadMeshes(await response.json() as CadData);
        if (disposed) return;
        for (let lane = 0; lane < 2; lane++) {
          const canvas = canvases.current[lane];
          if (!canvas) throw new Error('Model view is unavailable.');
          created.push(createCadRenderer(canvas, data, lane)); resize.observe(canvas);
        }
        renderers.current = created; setReady(true); draw();
      } catch {
        if (!disposed) { setError(true); setPlaying(false); }
      }
    }
    void load();
    return () => {
      disposed = true; abort.abort(); resize.disconnect();
      created.forEach(renderer => renderer.dispose()); renderers.current = [];
    };
  }, [hasEntered, draw]);

  useEffect(() => {
    if (!ready || !playing || !inView || !visible) return;
    let frame = 0, previous = performance.now();
    function tick(now: number) {
      position.current += Math.min(80, now - previous); previous = now;
      if (position.current > CAD_END) position.current = 0;
      draw();
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ready, playing, inView, visible, draw]);

  function toggle() {
    if (!playing && position.current >= CAD_END) { position.current = 0; draw(); }
    setPlaying(!playing);
  }
  function pointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (event.button !== 0) return;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, ...camera.current };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pointerMove(event: PointerEvent<HTMLCanvasElement>) {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    camera.current = {
      azimuth: start.azimuth - (event.clientX - start.x) * .012,
      elevation: Math.max(.18, Math.min(1.45, start.elevation + (event.clientY - start.y) * .01)),
    };
    draw();
  }
  function rotateWithKeys(event: KeyboardEvent<HTMLCanvasElement>) {
    const steps: Record<string, [number, number]> = { ArrowLeft: [.1, 0], ArrowRight: [-.1, 0], ArrowUp: [0, .08], ArrowDown: [0, -.08] };
    if (event.key === 'Home') { event.preventDefault(); camera.current = { ...CAD_CAMERA }; draw(); }
    const step = steps[event.key]; if (!step) return;
    event.preventDefault(); camera.current.azimuth += step[0];
    camera.current.elevation = Math.max(.18, Math.min(1.45, camera.current.elevation + step[1])); draw();
  }
  return (
    <figure ref={figure} className={`not-prose ${styles.figure}`} aria-label="Interactive comparison of two FreeCAD trial submissions">
      <div className={styles.playback}>
      <div className={styles.header}>freecad-platform-drawing solved two ways</div>
        {!error && (
        <div className={styles.controls}>
          <Button variant="ghost" size="xs" className={styles.playToggle} onClick={toggle} disabled={!ready} aria-label={playing ? 'Pause comparison' : 'Play comparison'} aria-pressed={playing}>
            {playing ? <Pause fill="currentColor" strokeWidth={0} /> : <Play fill="currentColor" strokeWidth={0} />}
            <span>{playing ? 'pause' : 'play'}</span>
          </Button>
          <Button variant="ghost" size="xs" onClick={() => { position.current = 0; draw(); setPlaying(true); }} disabled={!ready} aria-label="Restart comparison">
            <RotateCcw />
            <span>restart</span>
          </Button>
        </div>
        )}
      </div>
      {error ? (
        <video className={styles.fallback} controls playsInline loop poster="/blog/freecad-comparison/poster.png" aria-label="FreeCAD construction comparison video">
          <source src="/blog/freecad-comparison/comparison.mp4" type="video/mp4" />
          <a href="/blog/freecad-comparison/comparison.mp4">Watch the construction comparison</a>
        </video>
      ) : <>
        <div className={styles.models}>
          {LABELS.map(([heading, model], lane) => <div key={heading} className={styles.model}>
            <canvas
              ref={node => { canvases.current[lane] = node; }} className={styles.canvas}
              tabIndex={0} role="img" aria-label={`${heading}, ${model}. Drag or use arrow keys to rotate both models. Home resets the camera.`}
              onPointerDown={pointerDown} onPointerMove={pointerMove}
              onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
              onKeyDown={rotateWithKeys}
            />
            <div className={styles.modelLabels}>
              <h3 className={styles.heading}>{heading}</h3>
              <p className={styles.modelName}><a href={TRIAL_URLS[lane]} target="_blank" rel="noopener noreferrer">{model}<HugeiconsIcon icon={ArrowRight02Icon} size={12} strokeWidth={2} className={styles.trialLinkIcon} aria-hidden="true" /></a></p>
            </div>
          </div>)}
        </div>
        <p className={styles.hint}>{ready ? 'drag models to rotate' : 'Loading comparison…'}</p>
      </>}
    </figure>
  );
}
