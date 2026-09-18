import { useCallback, useEffect, useRef, useState } from 'react';
import { CloseIcon } from '../../components/Icons';
import { readProgress, storeProgress } from '../../lib/tour';
import { TOUR_STEPS, type Placement } from './steps';

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Breathing room between the highlight and the tooltip, and from the viewport edge. */
const GAP = 16;
const MARGIN = 12;
/** How far the lit area extends past the element, so it is framed rather than clipped. */
const PAD = 8;
const TOOLTIP_WIDTH = 300;
const TOOLTIP_HEIGHT = 252;
/** Matches .tour-mascot: 6rem wide at a 3:5 frame ratio, on a 16px root. */
const MASCOT_WIDTH = 96;
const MASCOT_HEIGHT = 160;
/** Sits off-centre along whatever it stands on, so it never covers the middle. */
const BIAS = 0.72;
/** How far the owl's feet sink into the highlight, so it perches rather than floats. */
const PERCH = 6;

function measure(element: Element): Rect {
  const { top, left, width, height } = element.getBoundingClientRect();
  // Padded here rather than at each use, so the spotlight and the tooltip agree
  // on where the highlight ends.
  return { top: top - PAD, left: left - PAD, width: width + 2 * PAD, height: height + 2 * PAD };
}

function same(a: Rect | null, b: Rect | null): boolean {
  if (a === null || b === null) return a === b;
  return a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Places the tooltip beside the highlight, then pulls it back inside the
 * viewport. Flipping to the opposite side first would be nicer still, but every
 * target here sits against the edge it points away from, so clamping is enough.
 */
function tooltipPosition(rect: Rect, placement: Placement) {
  const maxLeft = window.innerWidth - TOOLTIP_WIDTH - MARGIN;
  const maxTop = window.innerHeight - TOOLTIP_HEIGHT - MARGIN;

  const along = {
    horizontal: rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2,
    vertical: rect.top + rect.height / 2 - TOOLTIP_HEIGHT / 2,
  };

  const raw =
    placement === 'right'
      ? { top: along.vertical, left: rect.left + rect.width + GAP }
      : placement === 'left'
        ? { top: along.vertical, left: rect.left - TOOLTIP_WIDTH - GAP }
        : placement === 'bottom'
          ? { top: rect.top + rect.height + GAP, left: along.horizontal }
          : { top: rect.top - TOOLTIP_HEIGHT - GAP, left: along.horizontal };

  return {
    top: clamp(raw.top, MARGIN, Math.max(MARGIN, maxTop)),
    left: clamp(raw.left, MARGIN, Math.max(MARGIN, maxLeft)),
  };
}

/**
 * Stands the owl on the highlight rather than on the tooltip's corner, so it
 * points at whatever is being explained. Above the box when there is room,
 * below it when there is not, and always clamped inside the viewport — pinned
 * to a corner it was getting cropped by the screen edge.
 */
function mascotPosition(rect: Rect, tip: { top: number; left: number }) {
  const maxLeft = Math.max(MARGIN, window.innerWidth - MASCOT_WIDTH - MARGIN);
  const maxTop = Math.max(MARGIN, window.innerHeight - MASCOT_HEIGHT - MARGIN);

  // Standing somewhere sensible is not enough: the tooltip sits right beside
  // the highlight, so a perch chosen from the highlight alone lands on top of
  // the words. Each candidate is tried in order and the first one that clears
  // both the viewport and the tooltip wins.
  const candidates = [
    // On the highlight, above it — right of centre, then left.
    { top: rect.top - MASCOT_HEIGHT + PERCH, left: rect.left + rect.width * BIAS - MASCOT_WIDTH / 2 },
    { top: rect.top - MASCOT_HEIGHT + PERCH, left: rect.left + rect.width * (1 - BIAS) - MASCOT_WIDTH / 2 },
    // On the highlight, below it.
    { top: rect.top + rect.height - PERCH, left: rect.left + rect.width * BIAS - MASCOT_WIDTH / 2 },
    { top: rect.top + rect.height - PERCH, left: rect.left + rect.width * (1 - BIAS) - MASCOT_WIDTH / 2 },
    // Beside the highlight, level with its top.
    { top: rect.top, left: rect.left + rect.width - PERCH },
    { top: rect.top, left: rect.left - MASCOT_WIDTH + PERCH },
    // On the tooltip, above it — clear of the close button in its top corner.
    { top: tip.top - MASCOT_HEIGHT + PERCH, left: tip.left + TOOLTIP_WIDTH * BIAS - MASCOT_WIDTH / 2 },
    { top: tip.top - MASCOT_HEIGHT + PERCH, left: tip.left + TOOLTIP_WIDTH * (1 - BIAS) - MASCOT_WIDTH / 2 },
  ];

  const clearOfTooltip = (top: number, left: number) =>
    left + MASCOT_WIDTH <= tip.left ||
    left >= tip.left + TOOLTIP_WIDTH ||
    top + MASCOT_HEIGHT <= tip.top ||
    top >= tip.top + TOOLTIP_HEIGHT;

  const onScreen = (top: number, left: number) =>
    top >= MARGIN && top <= maxTop && left >= MARGIN && left <= maxLeft;

  const fits = candidates.find(({ top, left }) => onScreen(top, left) && clearOfTooltip(top, left));
  if (fits !== undefined) return fits;

  // Nothing clears it outright. Take the last resort — above the tooltip,
  // clamped — rather than dropping the owl somewhere arbitrary.
  return {
    top: clamp(tip.top - MASCOT_HEIGHT + PERCH, MARGIN, maxTop),
    left: clamp(tip.left + TOOLTIP_WIDTH * BIAS - MASCOT_WIDTH / 2, MARGIN, maxLeft),
  };
}

/**
 * First-visit walkthrough. Renders nothing at all once the visitor has finished
 * or skipped it, and nothing *yet* while the current step's target is missing —
 * the later steps point at results that only exist after a location is picked,
 * so the tour waits for the app to catch up rather than dropping those steps.
 */
export function Tour({ scope, onNeedLocation }: { scope: string; onNeedLocation: () => void }) {
  const [progress, setProgress] = useState(() => readProgress(scope));
  const [rect, setRect] = useState<Rect | null>(null);
  // Escape closes the tour for this page load only. It is a reflex key, far too
  // easy to hit by accident for it to retire the tour for good — that takes
  // pressing Lewati or Selesai.
  const [dismissed, setDismissed] = useState(false);
  const tooltip = useRef<HTMLDivElement>(null);
  /** Which step already asked for a location, so the request fires only once. */
  const asked = useRef<string | null>(null);

  const step = TOUR_STEPS[progress.step];
  const running = !progress.done && !dismissed && step !== undefined;

  const update = useCallback(
    (next: Partial<typeof progress>) => {
      setProgress((current) => {
        const merged = { ...current, ...next };
        storeProgress(scope, merged);
        return merged;
      });
    },
    [scope],
  );

  const finish = useCallback(() => {
    setRect(null);
    update({ done: true });
  }, [update]);

  // Track where the target is. It may not exist yet, may move as the layout
  // settles, and may resize with the window — so watch all three.
  useEffect(() => {
    if (!running) return;
    // A step with no target keeps no box. Clearing it matters on the way back:
    // a stale rect would both leave a spotlight behind and, as an inline style,
    // override the centring of the welcome card.
    if (step.target === undefined) {
      setRect(null);
      return;
    }
    const target = step.target;

    // Leaflet swaps tile elements constantly while the map pans, and every one
    // of those is a mutation here — so only re-render when the box truly moved.
    const locate = () => {
      const element = document.querySelector(target);
      const next = element === null ? null : measure(element);
      setRect((current) => (same(current, next) ? current : next));
    };

    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', locate);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', locate);
    };
  }, [running, step]);

  // A step that points at a result cannot wait for the visitor to pick a place:
  // the tour is blocking the page. Ask the app to use the map centre instead.
  useEffect(() => {
    if (!running || step.requiresLocation !== true || asked.current === step.id) return;
    if (step.target !== undefined && document.querySelector(step.target) !== null) return;
    asked.current = step.id;
    onNeedLocation();
  }, [running, step, onNeedLocation]);

  useEffect(() => {
    if (!running) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDismissed(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [running]);

  // Move focus to each step as it opens, so the tour is followable by keyboard
  // and announced by a screen reader.
  useEffect(() => {
    tooltip.current?.focus();
  }, [progress.step, rect === null]);

  if (!running || step === undefined) return null;

  // A step with no target is the welcome card: it needs no measuring. One that
  // has a target waits until the element is actually on screen.
  const centred = step.target === undefined;
  if (!centred && rect === null) return null;

  const last = progress.step === TOUR_STEPS.length - 1;
  // Guarded on `centred` as well as on the rect, because effects run after
  // paint: without it the welcome card would flash in the old position first.
  const position =
    centred || rect === null ? undefined : { ...tooltipPosition(rect, step.placement ?? 'bottom'), width: TOOLTIP_WIDTH };

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {!centred && rect !== null && (
        <>
          <div
            key={step.id}
            className="tour-spotlight"
            style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
          />
          <div
            className={`tour-mascot tour-mascot-free tour-mascot-${step.id}`}
            aria-hidden="true"
            style={mascotPosition(rect, position ?? { top: MARGIN, left: MARGIN })}
          />
        </>
      )}
      <div
        ref={tooltip}
        className={centred ? 'tour-tooltip tour-tooltip-centred' : 'tour-tooltip'}
        tabIndex={-1}
        style={position}
      >
        <button type="button" className="tour-close icon-button" onClick={finish} aria-label="Lewati tur">
          <CloseIcon size={16} />
        </button>
        <p className="tour-progress">
          Langkah {progress.step + 1} dari {TOUR_STEPS.length}
        </p>
        {centred && <div className={`tour-mascot tour-mascot-${step.id}`} aria-hidden="true" />}
        <h2 id="tour-title" className="tour-title">
          {step.title}
        </h2>
        <p className="tour-body">{step.body}</p>
        <div className="tour-actions">
          <button type="button" className="tour-skip" onClick={finish}>
            Lewati
          </button>
          {progress.step > 0 && (
            <button type="button" className="button-secondary" onClick={() => update({ step: progress.step - 1 })}>
              Kembali
            </button>
          )}
          <button
            type="button"
            className="button-primary"
            onClick={() => (last ? finish() : update({ step: progress.step + 1 }))}
          >
            {last ? 'Selesai' : centred ? 'Mulai' : 'Lanjut'}
          </button>
        </div>
      </div>
    </div>
  );
}
