import { ZONE_LIMITS_METERS, zoneWeight, type Zone } from '@gayatama/scoring';
import { useEffect, useRef, useState } from 'react';

const ZONES: Zone[] = ['c', 'b', 'a'];
const STEPS: Zone[] = ['a', 'b', 'c'];
const OUTER = ZONE_LIMITS_METERS.c;
const VIEW = 260;
const CENTRE = VIEW / 2;
const MAX_R = 124;

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
        <p className="landing-zones-guide">Pilih jarak untuk melihat zona yang sedang dibaca.</p>
      </div>

      <div className="landing-zones-body">
        <div className="landing-zones-figure" id="landing-zones-figure">
          <svg
            viewBox={`0 0 ${VIEW} ${VIEW}`}
            className="landing-zones-svg"
            role="img"
            aria-label={`Tiga zona jarak di sekitar titik. Zona aktif ${rangeFor(activeZone)}, dihitung ${zoneWeight(activeZone).toLocaleString('id-ID')} kali.`}
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
            <circle cx={CENTRE} cy={CENTRE} r={4} className="landing-zone-point" />
          </svg>
        </div>

        <ol className="landing-zone-steps">
          {STEPS.map((zone, index) => (
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
                <span className="landing-zone-say">{descriptionFor(zone)}</span>
              </button>
            </li>
          ))}
        </ol>
        <p className="visually-hidden" aria-live="polite">
          Zona {rangeFor(activeZone)} disorot, bobot {zoneWeight(activeZone).toLocaleString('id-ID')} kali.
        </p>
      </div>
    </section>
  );
}
