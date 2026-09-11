import type { BusinessType, LatLng } from '@gayatama/scoring';
import { useEffect, useState } from 'react';
import { LocationView } from './features/location/LocationView';
import { LocationControls } from './features/map/LocationControls';
import { MapPicker } from './features/map/MapPicker';
import { DEFAULT_CENTER, parseSelection, roundPoint, serializeSelection, type Selection } from './lib/location';

export function App() {
  const [selection, setSelection] = useState<Selection>(() => parseSelection(window.location.search));
  const [initialCenter] = useState<LatLng>(() => selection.point ?? DEFAULT_CENTER);
  const [mapCenter, setMapCenter] = useState<LatLng>(initialCenter);

  // Keep the URL in step with the selection, so any result can be shared as a link.
  useEffect(() => {
    const search = serializeSelection(selection);
    if (search !== window.location.search) {
      window.history.replaceState(null, '', `${window.location.pathname}${search}`);
    }
  }, [selection]);

  const pick = (point: LatLng) => setSelection((current) => ({ ...current, point: roundPoint(point) }));
  const chooseBusinessType = (businessType: BusinessType) => setSelection((current) => ({ ...current, businessType }));

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="brand">GAYATAMA</h1>
        <p className="tagline">Location intelligence for micro-entrepreneurs, built on open data</p>
      </header>

      <main className="layout">
        <section className="map-pane" aria-label="Map. Click to choose a location.">
          <MapPicker initialCenter={initialCenter} point={selection.point} onPick={pick} onCenterChange={setMapCenter} />
        </section>

        <aside className="panel" aria-label="Analysis">
          <LocationControls
            point={selection.point}
            businessType={selection.businessType}
            onBusinessTypeChange={chooseBusinessType}
            onUseMapCenter={() => pick(mapCenter)}
          />
          {selection.point === null ? (
            <Intro />
          ) : (
            <LocationView
              point={selection.point}
              businessType={selection.businessType}
              onBusinessTypeChange={chooseBusinessType}
            />
          )}
        </aside>
      </main>
    </div>
  );
}

function Intro() {
  return (
    <section className="intro">
      <h2>Is this a good place for your business?</h2>
      <ol>
        <li>Click a location on the map, or use the map centre.</li>
        <li>Choose the kind of business you have in mind — or open “What to open” to compare all seven.</li>
        <li>Read the score together with its range — a location scores <strong>75 ± 8</strong>, never a bare 75.</li>
      </ol>
      <p className="muted">
        Scores come from OpenStreetMap data within 1.5 km. Where that data is thin, GAYATAMA says so instead of
        guessing.
      </p>
    </section>
  );
}
