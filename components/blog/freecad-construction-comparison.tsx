'use client';

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CAD_CAMERA, CAD_CHECKPOINTS, CAD_DURATION, CAD_END, CAD_INTRO, CAD_STARTS, cadPositions, createCadRenderer, decodeCadMeshes, type Camera, type CadData } from '@/lib/freecad-comparison';
import styles from './freecad-construction-comparison.module.css';

type Renderer = ReturnType<typeof createCadRenderer>;
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
  const [progress, setProgress] = useState(0);
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
        setPlaying(false); position.current = CAD_END; setProgress(CAD_END); draw();
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
    let frame = 0, previous = performance.now(), lastUpdate = previous;
    function tick(now: number) {
      position.current += Math.min(80, now - previous); previous = now;
      if (position.current > CAD_END) position.current = 0;
      draw();
      if (now - lastUpdate >= 33) { setProgress(position.current); lastUpdate = now; }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ready, playing, inView, visible, draw]);

  function seek(value: number) {
    setPlaying(false); position.current = Math.max(0, Math.min(CAD_END, value));
    setProgress(position.current); draw();
  }
  function toggle() {
    if (!playing && position.current >= CAD_END) { position.current = 0; setProgress(0); draw(); }
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
  const time = Math.max(0, Math.min(CAD_DURATION, progress - CAD_INTRO));
  const checkpoint = Math.max(0, CAD_STARTS.findLastIndex(start => time >= start));

  return (
    <figure ref={figure} className={`not-prose ${styles.figure}`} aria-label="Interactive comparison of two FreeCAD trial submissions">
      {error ? (
        <video className={styles.fallback} controls playsInline loop poster="/blog/freecad-comparison/poster.png" aria-label="FreeCAD construction comparison video">
          <source src="/blog/freecad-comparison/comparison.mp4" type="video/mp4" />
          <a href="/blog/freecad-comparison/comparison.mp4">Watch the construction comparison</a>
        </video>
      ) : <>
        <div className={styles.models}>
          {LABELS.map(([heading, model], lane) => <div key={heading} className={styles.model}>
            <h3 className={styles.heading}>{heading}</h3>
            <p className={styles.modelName}>{model}</p>
            <canvas
              ref={node => { canvases.current[lane] = node; }} className={styles.canvas}
              tabIndex={0} role="img" aria-label={`${heading}, ${model}. Drag or use arrow keys to rotate both models. Home resets the camera.`}
              onPointerDown={pointerDown} onPointerMove={pointerMove}
              onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
              onKeyDown={rotateWithKeys}
            />
          </div>)}
        </div>
        <div className={styles.controls}>
          <Button variant="ghost" size="icon" onClick={toggle} disabled={!ready} aria-label={playing ? 'Pause comparison' : 'Play comparison'} aria-pressed={playing}>
            {playing ? <Pause /> : <Play />}
          </Button>
          <div className={styles.timeline}>
            <div className={styles.track} aria-hidden="true">
              {CAD_CHECKPOINTS.map((segment, index) => <div key={segment.label} className={styles.segment} style={{ flex: segment.duration }}>
                <span className={styles.fill} style={{ width: `${Math.max(0, Math.min(1, (time - CAD_STARTS[index]) / segment.duration)) * 100}%` }} />
              </div>)}
            </div>
            <input className={styles.range} type="range" min={0} max={CAD_DURATION} step={10} value={time} disabled={!ready}
              onChange={event => seek(Number(event.target.value) + CAD_INTRO)}
              aria-label="Construction timeline" aria-valuetext={`${CAD_CHECKPOINTS[checkpoint].label}, ${(time / 1000).toFixed(1)} of 11 seconds`} />
            <div className={styles.checkpoints}>
              {CAD_CHECKPOINTS.map((segment, index) => <button key={segment.label} type="button" style={{ flex: segment.duration }}
                className={index === checkpoint ? styles.current : undefined} disabled={!ready}
                onClick={() => seek(CAD_STARTS[index] + CAD_INTRO)} aria-label={`Jump to ${segment.label.toLowerCase()} checkpoint`}>
                {segment.label}
              </button>)}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => { camera.current = { ...CAD_CAMERA }; draw(); }} disabled={!ready} aria-label="Reset model perspective"><RotateCcw /></Button>
        </div>
        <div className={styles.legend}>
          <span><i className={styles.addition} />Added material</span><span><i className={styles.cut} />Removed material</span>
          <span className={styles.hint}>{ready ? 'Drag either model to rotate both' : 'Loading comparison…'}</span>
        </div>
      </>}
      <figcaption className={styles.caption}>Two saved submissions for the same drawing, built with different editable feature trees. The animation illustrates their construction order; timing is synchronized for comparison.</figcaption>
    </figure>
  );
}
