import { useEffect } from 'react';

/** Pixels moved per arrow press, and per press with Shift held. */
const STEP = 120;
const COARSE_STEP = 480;

const DELTAS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/**
 * Arrow-key panning for whichever map engine is drawing.
 *
 * Both Leaflet and the Google Maps JS API document keyboard panning as a
 * default, and both were verified not to do it here — tested on the running
 * app, arrows moved nothing. Rather than debug two third-party focus models,
 * the behaviour is implemented once, against the `panBy` both engines expose,
 * so it works the same whichever one an API key selects.
 *
 * This is the missing half of the keyboard route to the product's primary
 * action. Without it, "Pilih titik tengah peta" can only ever commit whatever
 * happens to be centred already, which is not a way to choose a location.
 *
 * `container` is made focusable if the engine did not do it, so Tab can reach
 * the map at all.
 */
export function useKeyboardPan(
  container: HTMLElement | null | undefined,
  panBy: (dx: number, dy: number) => void,
): void {
  useEffect(() => {
    if (container === null || container === undefined) return;

    if (container.getAttribute('tabindex') === null) container.setAttribute('tabindex', '0');
    // The stop has to say what it is and what the keys do. Without this a
    // screen reader lands on an unnamed box in the middle of the tab order.
    if (container.getAttribute('aria-label') === null) {
      container.setAttribute(
        'aria-label',
        'Peta lokasi. Gunakan tombol panah untuk menggeser peta, tahan Shift untuk menggeser lebih jauh, lalu pilih titik tengahnya.',
      );
    }
    if (container.getAttribute('aria-keyshortcuts') === null) {
      container.setAttribute('aria-keyshortcuts', 'ArrowUp ArrowDown ArrowLeft ArrowRight');
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const delta = DELTAS[event.key];
      if (delta === undefined) return;
      // Arrows scroll the page by default, which would move the whole app
      // instead of the map the visitor is aiming.
      event.preventDefault();
      const step = event.shiftKey ? COARSE_STEP : STEP;
      panBy(delta[0] * step, delta[1] * step);
    };

    container.addEventListener('keydown', onKeyDown);
    return () => container.removeEventListener('keydown', onKeyDown);
  }, [container, panBy]);
}
