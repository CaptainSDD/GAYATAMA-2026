import { recommendationStatus, summarizeScore, type BusinessType } from '@gayatama/scoring';
import { useId, useRef, useState } from 'react';
import { bandTone, toneChip, toneColor, toneTextColor } from '../../lib/band-color';
import { BAND_LABELS, BUSINESS_TYPE_EXAMPLES, BUSINESS_TYPE_LABELS, STATUS_LABELS } from '../../lib/copy';
import { LANDING_EXAMPLE } from './landingExample';

const SNAPSHOT_DATE = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
}).format(new Date(LANDING_EXAMPLE.source.osmSnapshotAt));

/** One documented Semarang coordinate, asked all seven business questions. */
export function SevenAnswers() {
  const [selected, setSelected] = useState<BusinessType>(LANDING_EXAMPLE.featuredBusiness);
  const panelId = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const rows = LANDING_EXAMPLE.businessScores.map((entry) => {
    const summary = summarizeScore(entry.value, LANDING_EXAMPLE.confidence);
    return {
      ...entry,
      summary,
      band: summary.band,
      tone: bandTone(summary.band),
      status: recommendationStatus(entry.value, LANDING_EXAMPLE.confidence),
    };
  });

  const best = rows[0]!;
  const worst = rows[rows.length - 1]!;
  const spread = Math.round(best.summary.value - worst.summary.value);
  const openIndex = Math.max(0, rows.findIndex((row) => row.businessType === selected));
  const open = rows[openIndex] ?? best;

  const selectAt = (index: number, moveFocus = false) => {
    const next = (index + rows.length) % rows.length;
    setSelected(rows[next]!.businessType);
    if (moveFocus) tabRefs.current[next]?.focus();
  };

  return (
    <section className="landing-answers" id="jawaban" aria-labelledby="landing-answers-title">
      <div className="landing-answers-heading" data-reveal="rise">
        <h2 id="landing-answers-title" className="landing-answers-title">
          Titik yang sama.
          <br />
          Jawaban yang berbeda.
        </h2>
        <p className="landing-answers-guide">
          Pilih jenis usaha untuk melihat bagaimana {LANDING_EXAMPLE.label.toLowerCase()} dibaca ulang.
        </p>
      </div>

      <div className="landing-answers-body">
        <ol className="landing-rail" data-reveal="rail" role="tablist" aria-label="Jenis usaha">
          {rows.map((row, index) => {
            const isOpen = row.businessType === selected;
            const tabId = `${panelId}-tab-${row.businessType}`;
            return (
              <li key={row.businessType} role="presentation" style={{ ['--delay' as string]: `${index * 60}ms` }}>
                <button
                  ref={(node) => {
                    tabRefs.current[index] = node;
                  }}
                  id={tabId}
                  type="button"
                  role="tab"
                  className="landing-rail-item"
                  data-open={isOpen}
                  aria-selected={isOpen}
                  aria-controls={panelId}
                  tabIndex={isOpen ? 0 : -1}
                  onClick={() => selectAt(index)}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                      event.preventDefault();
                      selectAt(openIndex + 1, true);
                    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                      event.preventDefault();
                      selectAt(openIndex - 1, true);
                    } else if (event.key === 'Home') {
                      event.preventDefault();
                      selectAt(0, true);
                    } else if (event.key === 'End') {
                      event.preventDefault();
                      selectAt(rows.length - 1, true);
                    }
                  }}
                >
                  <span className="landing-rail-name">{BUSINESS_TYPE_LABELS[row.businessType]}</span>
                  <span className="landing-rail-sub">{BUSINESS_TYPE_EXAMPLES[row.businessType]}</span>
                  <span className="landing-rail-score" aria-hidden="true">
                    {Math.round(row.summary.value)}
                  </span>
                  <span className="visually-hidden">
                    skor {Math.round(row.summary.value)} ± {row.summary.margin}, {BAND_LABELS[row.band]}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <div
          className="landing-open"
          id={panelId}
          role="tabpanel"
          aria-labelledby={`${panelId}-tab-${open.businessType}`}
          data-reveal="slab"
        >
          <svg className="landing-open-rings" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
            <circle cx="60" cy="60" r="58" />
            <circle cx="60" cy="60" r="31" />
            <circle cx="60" cy="60" r="12" />
          </svg>

          <p className="visually-hidden" aria-live="polite">
            {BUSINESS_TYPE_LABELS[open.businessType]}, skor {Math.round(open.summary.value)} ± {open.summary.margin},{' '}
            {BAND_LABELS[open.band]}.
          </p>

          <div className="landing-open-card" key={open.businessType}>
            <h3 className="visually-hidden">{BUSINESS_TYPE_LABELS[open.businessType]}</h3>
            <p className="landing-open-figure">
              <span className="landing-open-value">{Math.round(open.summary.value)}</span>
              <span className="landing-open-margin">± {open.summary.margin}</span>
            </p>
            <p className="landing-open-band">
              <span className={toneChip(open.tone)}>{BAND_LABELS[open.band]}</span>
              {open.status === null ? null : <span className="muted">{STATUS_LABELS[open.status]}</span>}
            </p>
            <p className="landing-open-where">
              {BUSINESS_TYPE_LABELS[open.businessType]} <span className="muted">· {LANDING_EXAMPLE.label}</span>
            </p>
            <p className="landing-open-range">
              Kemungkinan sebenarnya antara {open.summary.range[0]} dan {open.summary.range[1]}.
            </p>
          </div>

          <ol className="landing-ruler" aria-hidden="true">
            {rows.map((row) => (
              <li
                key={row.businessType}
                className="landing-ruler-row"
                data-open={row.businessType === selected}
                data-reveal="ruler"
              >
                <span className="landing-ruler-name">{BUSINESS_TYPE_LABELS[row.businessType]}</span>
                <span className="landing-ruler-track">
                  <span
                    className="landing-ruler-interval"
                    style={{
                      left: `${row.summary.range[0]}%`,
                      width: `${row.summary.range[1] - row.summary.range[0]}%`,
                      background: toneColor(row.tone),
                    }}
                  />
                  <span
                    className="landing-ruler-marker"
                    style={{ left: `${row.summary.value}%`, background: toneTextColor(row.tone) }}
                  />
                </span>
              </li>
            ))}
            <li className="landing-ruler-axis">
              <span />
              <span className="landing-ruler-track">
                <span>0</span>
                <span>50</span>
                <span>100</span>
              </span>
            </li>
          </ol>
        </div>
      </div>

      <p className="landing-answers-note" data-reveal="rise">
        Selisih <strong>{spread} poin</strong> antara {BUSINESS_TYPE_LABELS[best.businessType].toLowerCase()} dan{' '}
        {BUSINESS_TYPE_LABELS[worst.businessType].toLowerCase()} — di titik contoh yang sama.{' '}
        <span className="muted">
          Tujuh skor dihitung model LOKABIS v{LANDING_EXAMPLE.source.modelVersion} dari snapshot OpenStreetMap{' '}
          {SNAPSHOT_DATE} dan Overture Maps {LANDING_EXAMPLE.source.overtureRelease}.
        </span>
      </p>
    </section>
  );
}
