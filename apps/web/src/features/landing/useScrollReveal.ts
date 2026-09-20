import { useEffect, useState } from 'react';

/** Everything the observer watches declares itself with this attribute. */
const SELECTOR = '[data-reveal]';
const EAGER = '[data-reveal-eager]';
/**
 * Opts a single node out of an eager ancestor, and out of the "already on
 * screen at load" shortcut below it.
 *
 * The opening act is eager because the slab's top edge is inside the first
 * viewport and may not be missing at load. Its cells are a different matter:
 * they sit below the fold, so marking them arrived at load spends their
 * choreography — the score rising, the segments assembling, the ruler drawing —
 * before the reader has scrolled far enough to see any of it. Deferred nodes
 * always go to the observer, which still fires on the first callback for
 * anything genuinely in view.
 */
const DEFER = 'data-reveal-defer';
const ROOT_MARGIN = '0px 0px -12% 0px';

/**
 * Reveal the landing page's discrete arrivals exactly once.
 *
 * Continuous hero motion remains in CSS. This observer only settles evidence
 * into place, then gets out of the way. Reduced-motion and older browsers see
 * the finished composition immediately.
 */
export function useScrollReveal(enabled = true): void {
  useEffect(() => {
    if (!enabled) return;

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (reduced?.matches || typeof IntersectionObserver === 'undefined') {
      document.querySelectorAll(SELECTOR).forEach((node) => node.setAttribute('data-revealed', ''));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute('data-revealed', '');
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: ROOT_MARGIN, threshold: 0.01 },
    );

    for (const node of Array.from(document.querySelectorAll(SELECTOR))) {
      if (node.hasAttribute(DEFER)) {
        observer.observe(node);
        continue;
      }
      const eager = node.closest(EAGER) !== null;
      if (eager || node.getBoundingClientRect().top < window.innerHeight) {
        node.setAttribute('data-revealed', '');
      } else {
        observer.observe(node);
      }
    }

    return () => observer.disconnect();
  }, [enabled]);
}

/**
 * Whether the reader has left the hero. The state settles the floating header
 * onto the page without running a scroll handler on the main thread.
 */
export function useHeroExit(sentinel: React.RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const node = sentinel.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        document.documentElement.toggleAttribute('data-landing-scrolled', !entry.isIntersecting);
      },
      { threshold: 0 },
    );
    observer.observe(node);

    return () => {
      observer.disconnect();
      document.documentElement.removeAttribute('data-landing-scrolled');
    };
  }, [sentinel]);
}

/**
 * Mark the section currently crossing the reader's upper scan line. This is a
 * navigation aid, not analytics: the narrow observer band keeps one destination
 * legible in the fixed header and `aria-current` exposes the same state.
 */
export function useActiveLandingSection(ids: readonly string[]): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;

    const nodes = ids.map((id) => document.getElementById(id)).filter((node): node is HTMLElement => node !== null);
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).id;
          if (entry.isIntersecting) visible.add(id);
          else visible.delete(id);
        }
        setActiveId(nodes.find((node) => visible.has(node.id))?.id ?? null);
      },
      { rootMargin: '-22% 0px -66% 0px', threshold: 0.01 },
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [ids]);

  return activeId;
}
