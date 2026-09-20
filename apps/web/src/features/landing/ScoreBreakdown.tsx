import { COMPONENT_KEYS, COMPONENT_WEIGHTS, type ComponentKey } from '@gayatama/scoring';
import { useRef, useState } from 'react';
import { COMPONENT_LABELS } from '../../lib/copy';

interface Part {
  key: ComponentKey;
  value: number;
  weight: number;
  contribution: number;
  share: number;
}

const formatDecimal = (value: number) => value.toFixed(1).replace('.', ',');

/**
 * The worked score, laid out as the five weighted contributions that form it.
 * The persistent legend makes every segment understandable at rest; interaction
 * reveals the full arithmetic without mutating the engine result.
 */
export function ScoreBreakdown({ components, total }: { components: Record<ComponentKey, number>; total: number }) {
  const parts: Part[] = COMPONENT_KEYS.map((key) => {
    const weight = COMPONENT_WEIGHTS[key];
    const contribution = weight * components[key];
    return { key, value: components[key], weight, contribution, share: (contribution / total) * 100 };
  });

  const [active, setActive] = useState<ComponentKey | null>(null);
  const [focusIndex, setFocusIndex] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const detail = active === null ? null : parts.find((part) => part.key === active)!;

  const focusPart = (index: number) => {
    const next = (index + parts.length) % parts.length;
    setFocusIndex(next);
    setActive(parts[next]!.key);
    refs.current[next]?.focus();
  };

  const move = (delta: number) => focusPart(focusIndex + delta);

  return (
    <div className="landing-breakdown">
      <div
        className="landing-breakdown-bar"
        role="group"
        aria-label="Susunan skor: lima komponen dan andilnya. Gunakan tombol panah untuk berpindah."
        onMouseLeave={() => {
          if (!refs.current.includes(document.activeElement as HTMLButtonElement)) setActive(null);
        }}
      >
        {parts.map((part, index) => (
          <button
            key={part.key}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            className="landing-breakdown-segment"
            style={{ width: `${part.share}%` }}
            data-active={active === part.key}
            data-dimmed={active !== null && active !== part.key}
            tabIndex={index === focusIndex ? 0 : -1}
            onMouseEnter={() => setActive(part.key)}
            onFocus={() => {
              setFocusIndex(index);
              setActive(part.key);
            }}
            onBlur={(event) => {
              if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node | null)) setActive(null);
            }}
            onClick={() => setActive(part.key)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                event.preventDefault();
                move(1);
              } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                event.preventDefault();
                move(-1);
              } else if (event.key === 'Home') {
                event.preventDefault();
                focusPart(0);
              } else if (event.key === 'End') {
                event.preventDefault();
                focusPart(parts.length - 1);
              }
            }}
          >
            <span className="landing-breakdown-segment-index" aria-hidden="true">
              {index + 1}
            </span>
            <span className="visually-hidden">
              {COMPONENT_LABELS[part.key]}, nilai {Math.round(part.value)} dari 100, bobot{' '}
              {Math.round(part.weight * 100)} persen, menyumbang {formatDecimal(part.contribution)} poin dari{' '}
              {formatDecimal(total)}.
            </span>
          </button>
        ))}
      </div>

      <ol className="landing-breakdown-legend" aria-label="Rincian kontribusi komponen skor">
        {parts.map((part, index) => (
          <li key={part.key} data-active={active === part.key}>
            <span className="landing-breakdown-legend-index" aria-hidden="true">
              {index + 1}
            </span>
            <span className="landing-breakdown-legend-name">{COMPONENT_LABELS[part.key]}</span>
            <span className="landing-breakdown-legend-value">
              {Math.round(part.weight * 100)}% · {formatDecimal(part.contribution)} poin
            </span>
          </li>
        ))}
      </ol>

      <p className="landing-breakdown-detail" data-active={detail !== null} aria-live="polite">
        {detail === null ? (
          <span className="muted">Pilih bagian bernomor untuk melihat rumus lengkapnya.</span>
        ) : (
          <>
            <strong>{COMPONENT_LABELS[detail.key]}</strong>
            <span className="muted">
              {' '}
              nilai {Math.round(detail.value)} × bobot {Math.round(detail.weight * 100)}% ={' '}
            </span>
            <strong>{formatDecimal(detail.contribution)} poin</strong>
            <span className="muted"> dari {formatDecimal(total)}</span>
          </>
        )}
      </p>
    </div>
  );
}
