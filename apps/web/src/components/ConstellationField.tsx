import { useEffect, useRef } from 'react';

interface Point {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

const MAX_CONNECTION_DISTANCE = 150;
const MOUSE_CONNECTION_DISTANCE = 210;

/**
 * A quiet, pointer-aware field for the public-facing LOKABIS surfaces. It is
 * deliberately a canvas: the field can remain beneath real content, has no
 * focusable or clickable surface, and redraws without adding dozens of DOM
 * nodes to the landing page.
 */
export function ConstellationField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;

    const context = canvas.getContext('2d');
    if (context === null) return;

    const parent = canvas.parentElement;
    if (parent === null) return;

    let width = 0;
    let height = 0;
    let frame = 0;
    let previousTime = 0;
    let paused = document.hidden;
    let reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let fieldColor = '15 118 110';
    let points: Point[] = [];
    const pointer = { x: -Infinity, y: -Infinity, active: false };

    const randomPoint = (): Point => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.03,
      vy: (Math.random() - 0.5) * 0.03,
    });

    const drawLine = (fromX: number, fromY: number, toX: number, toY: number, opacity: number) => {
      context.beginPath();
      context.moveTo(fromX, fromY);
      context.lineTo(toX, toY);
      context.strokeStyle = `rgb(${fieldColor} / ${opacity})`;
      context.stroke();
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);
      context.lineWidth = 1;

      for (const [index, point] of points.entries()) {
        for (const neighbour of points.slice(index + 1)) {
          const distance = Math.hypot(point.x - neighbour.x, point.y - neighbour.y);
          if (distance < MAX_CONNECTION_DISTANCE) {
            drawLine(point.x, point.y, neighbour.x, neighbour.y, (1 - distance / MAX_CONNECTION_DISTANCE) * 0.2);
          }
        }
      }

      if (pointer.active) {
        const nearby = points
          .map((point) => ({ point, distance: Math.hypot(point.x - pointer.x, point.y - pointer.y) }))
          .filter(({ distance }) => distance < MOUSE_CONNECTION_DISTANCE)
          .sort((first, second) => first.distance - second.distance)
          .slice(0, 5);

        for (const { point, distance } of nearby) {
          drawLine(point.x, point.y, pointer.x, pointer.y, (1 - distance / MOUSE_CONNECTION_DISTANCE) * 0.5);
        }
      }

      for (const point of points) {
        context.beginPath();
        context.arc(point.x, point.y, 1.5, 0, Math.PI * 2);
        context.fillStyle = `rgb(${fieldColor} / 0.5)`;
        context.fill();
      }
    };

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      width = bounds.width;
      height = bounds.height;
      canvas.width = Math.max(1, Math.floor(width * pixelRatio));
      canvas.height = Math.max(1, Math.floor(height * pixelRatio));
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      fieldColor = getComputedStyle(parent).getPropertyValue('--constellation-rgb').trim() || fieldColor;
      const count = Math.min(72, Math.max(26, Math.round((width * height) / 28_000)));
      points = Array.from({ length: count }, randomPoint);
      draw();
    };

    const update = (time: number) => {
      if (paused || reducedMotion) {
        frame = 0;
        return;
      }
      const elapsed = Math.min(32, time - previousTime || 16);
      previousTime = time;
      for (const point of points) {
        point.x += point.vx * elapsed;
        point.y += point.vy * elapsed;
        if (point.x < -8 || point.x > width + 8) point.vx *= -1;
        if (point.y < -8 || point.y > height + 8) point.vy *= -1;
      }
      draw();
      frame = window.requestAnimationFrame(update);
    };

    const onPointerMove = (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.active = true;
      if (reducedMotion) draw();
    };

    const onPointerLeave = () => {
      pointer.active = false;
      if (reducedMotion) draw();
    };

    const onVisibilityChange = () => {
      paused = document.hidden;
      if (paused) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      } else if (!reducedMotion && frame === 0) {
        frame = window.requestAnimationFrame(update);
      }
    };

    const onMotionPreferenceChange = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
      window.cancelAnimationFrame(frame);
      frame = 0;
      draw();
      if (!reducedMotion && !paused) frame = window.requestAnimationFrame(update);
    };

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('blur', onPointerLeave);
    document.addEventListener('visibilitychange', onVisibilityChange);
    motionQuery.addEventListener('change', onMotionPreferenceChange);
    resize();
    if (!reducedMotion && !paused) frame = window.requestAnimationFrame(update);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('blur', onPointerLeave);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      motionQuery.removeEventListener('change', onMotionPreferenceChange);
    };
  }, []);

  return <canvas ref={canvasRef} className="constellation-field" aria-hidden="true" />;
}
