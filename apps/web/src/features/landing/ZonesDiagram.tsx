import { ZONE_LIMITS_METERS, zoneWeight, type Zone } from '@gayatama/scoring';
import { useEffect, useRef, useState } from 'react';

interface CompetitorMarker {
  x: number;
  y: number;
}

const ZONES: Zone[] = ['c', 'b', 'a'];
const STEPS: Zone[] = ['a', 'b', 'c'];
const OUTER = ZONE_LIMITS_METERS.c;
const VIEW = 260;
const CENTRE = VIEW / 2;
const MAX_R = 124;
const COMPETITOR_MARKER_PATH = 'M0 8C-1.8 5.1-6 1.9-6-2.2A6 6 0 1 1 6-2.2C6 1.9 1.8 5.1 0 8Z';

/**
 * Deliberately illustrative positions: two markers in the 0–300 m disc,
 * four in the 300–800 m annulus, and six in the 800–1,500 m annulus.
 * They explain spatial weighting and must never be presented as fetched POIs.
 */
const COMPETITOR_MARKERS: Record<Zone, readonly CompetitorMarker[]> = {
  a: [
    { x: 118, y: 124 },
    { x: 143, y: 137 },
  ],
  b: [
    { x: 90, y: 110 },
    { x: 165, y: 100 },
    { x: 158, y: 170 },
    { x: 112, y: 77 },
  ],
  c: [
    { x: 55, y: 82 },
    { x: 85, y: 40 },
    { x: 170, y: 48 },
    { x: 215, y: 105 },
    { x: 200, y: 188 },
    { x: 103, y: 230 },
  ],
};

function radiusFor(zone: Zone): number {
  return (ZONE_LIMITS_METERS[zone] / OUTER) * MAX_R;
}

function rangeFor(zone: Zone): string {
  const from = zone === 'a' ? 0 : zone === 'b' ? ZONE_LIMITS_METERS.a : ZONE_LIMITS_METERS.b;
  return `${from.toLocaleString('id-ID')}–${ZONE_LIMITS_METERS[zone].toLocaleString('id-ID')} m`;
}

function descriptionFor(zone: Zone): string {
  if (zone === 'a') return 'Tetangga langsung. Apa pun di sini dihitung penuh.';
  if (zone === 'b') return 'Masih sejalan kaki atau semotor. Andilnya turun, tidak hilang.';
  return 'Ujung radius. Masih terbaca, tapi seperempat beratnya.';
}

/** The engine's true zone radii, selectable directly as well as through scroll. */
export function ZonesDiagram() {
  const [activeZone, setActiveZone] = useState<Zone>('a');
  const stepRefs = useRef<(HTMLLIElement | null)[]>([]);
  const activeCompetitorCount = COMPETITOR_MARKERS[activeZone].length;

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        const current = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (current) setActiveZone((current.target as HTMLElement).dataset.zone as Zone);
      },
      { rootMargin: '-34% 0px -44% 0px', threshold: [0.01, 0.35, 0.7] },
    );
    stepRefs.current.forEach((node) => node && observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return (
    <section className="landing-zones" id="zona" aria-labelledby="landing-zones-title">
      <div className="landing-zones-lede" data-reveal="rise">
        <h2 id="landing-zones-title">Yang dekat dihitung lebih berat.</h2>
        <p>
          Radius analisisnya 1,5 km, tapi tidak rata. Warung sejenis 250 meter dari pintu Anda berpengaruh penuh; yang
          1,2 km jauhnya dihitung seperempatnya. Ini bukan penyederhanaan untuk halaman ini — ini cara mesinnya bekerja.
        </p>
        <p className="landing-zones-guide">Pilih jarak untuk melihat zona dan pesaing ilustratif yang sedang dibaca.</p>
      </div>

      <div className="landing-zones-body">
        <figure className="landing-zones-figure" id="landing-zones-figure">
          <svg
            viewBox={`0 0 ${VIEW} ${VIEW}`}
            className="landing-zones-svg"
            role="img"
            aria-describedby="landing-zones-caption"
            aria-label={`Tiga zona jarak di sekitar titik. Zona aktif ${rangeFor(activeZone)}, dihitung ${zoneWeight(activeZone).toLocaleString('id-ID')} kali, dengan ${activeCompetitorCount} penanda pesaing ilustratif.`}
          >
            {ZONES.map((zone) => (
              <circle
                key={zone}
                cx={CENTRE}
                cy={CENTRE}
                r={radiusFor(zone)}
                className={`landing-zone-ring landing-zone-${zone}`}
                data-active={zone === activeZone}
              />
            ))}

            {ZONES.map((zone) => (
              <g
                key={`competitors-${zone}`}
                className="landing-zone-competitors"
                data-zone={zone}
                data-active={zone === activeZone}
                aria-hidden="true"
              >
                {COMPETITOR_MARKERS[zone].map((marker, index) => (
                  <g key={`${marker.x}-${marker.y}`} transform={`translate(${marker.x} ${marker.y})`}>
                    <path className="landing-zone-competitor-marker" d={COMPETITOR_MARKER_PATH} />
                    <circle className="landing-zone-competitor-core" cy={-2.2} r={1.7} />
                    <title>Pesaing ilustratif {index + 1}</title>
                  </g>
                ))}
              </g>
            ))}

            <circle cx={CENTRE} cy={CENTRE} r={4} className="landing-zone-point" />
          </svg>
          <figcaption className="landing-zones-caption" id="landing-zones-caption">
            Ilustrasi, bukan data lokasi nyata: Zona A 2 penanda pesaing, Zona B 4, Zona C 6.
          </figcaption>
        </figure>

        <ol className="landing-zone-steps">
          {STEPS.map((zone, index) => {
            const competitorCount = COMPETITOR_MARKERS[zone].length;
            return (
              <li
                key={zone}
                ref={(node) => {
                  stepRefs.current[index] = node;
                }}
                className="landing-zone-step"
                data-zone={zone}
                data-active={zone === activeZone}
                data-reveal="step"
                style={{ ['--delay' as string]: `${index * 40}ms` }}
              >
                <button
                  type="button"
                  className="landing-zone-step-button"
                  aria-pressed={zone === activeZone}
                  aria-controls="landing-zones-figure"
                  onClick={() => setActiveZone(zone)}
                  onMouseEnter={() => setActiveZone(zone)}
                  onFocus={() => setActiveZone(zone)}
                >
                  <span className="landing-zone-range">{rangeFor(zone)}</span>
                  <span className="landing-zone-weight">
                    <strong>{zoneWeight(zone).toLocaleString('id-ID')}×</strong>
                  </span>
                  <span className="landing-zone-competitor-count">{competitorCount} penanda pesaing</span>
                  <span className="landing-zone-say">{descriptionFor(zone)}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <p className="visually-hidden" aria-live="polite">
          Zona {rangeFor(activeZone)} disorot, bobot {zoneWeight(activeZone).toLocaleString('id-ID')} kali, dengan{' '}
          {activeCompetitorCount} penanda pesaing ilustratif.
        </p>
      </div>
    </section>
  );
}
