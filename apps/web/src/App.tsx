import type { BusinessType, LatLng } from '@gayatama/scoring';
import { useEffect, useState } from 'react';
import { MapPinIcon } from './components/Icons';
import { ShareButton } from './components/ShareButton';
import { ThemeToggle } from './components/ThemeToggle';
import { LocationView } from './features/location/LocationView';
import { LocationControls } from './features/map/LocationControls';
import { MapPicker } from './features/map/MapPicker';
import { DEFAULT_CENTER, parseSelection, roundPoint, serializeSelection, type Selection } from './lib/location';
import { USE_GOOGLE_MAP } from './lib/map-config';

export function App() {
  const [selection, setSelection] = useState<Selection>(() => parseSelection(window.location.search));
  const [initialCenter] = useState<LatLng>(() => selection.point ?? DEFAULT_CENTER);
  const [mapCenter, setMapCenter] = useState<LatLng>(initialCenter);
  const [sheetCollapsed, setSheetCollapsed] = useState(false);

  // Keep the URL in step with the selection, so any result can be shared as a link.
  useEffect(() => {
    const search = serializeSelection(selection);
    if (search !== window.location.search) {
      window.history.replaceState(null, '', `${window.location.pathname}${search}`);
    }
  }, [selection]);

  const pick = (point: LatLng) => {
    setSelection((current) => ({ ...current, point: roundPoint(point) }));
    setSheetCollapsed(false);
  };
  const chooseBusinessType = (businessType: BusinessType) => setSelection((current) => ({ ...current, businessType }));

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand-block">
          <h1 className="brand">
            <MapPinIcon size={20} />
            LOKABIS
          </h1>
        </div>
        <div className="header-actions">
          <ShareButton disabled={selection.point === null} />
          <ThemeToggle />
        </div>
      </header>

      <main className="layout">
        <section className="map-pane" aria-label="Peta. Klik untuk memilih lokasi.">
          <MapPicker initialCenter={initialCenter} point={selection.point} onPick={pick} onCenterChange={setMapCenter} />
        </section>

        <aside className="panel" aria-label="Analisis" data-collapsed={sheetCollapsed}>
          <button
            type="button"
            className="sheet-handle"
            onClick={() => setSheetCollapsed((collapsed) => !collapsed)}
            aria-expanded={!sheetCollapsed}
            aria-label={sheetCollapsed ? 'Buka panel analisis' : 'Tutup panel analisis'}
          />
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
      <h2>Cocok tidak lokasi ini untuk usaha Anda?</h2>
      <ol className="intro-steps">
        <li>
          <span>Klik satu titik di peta, atau pakai titik tengah peta.</span>
        </li>
        <li>
          <span>
            Pilih jenis usaha yang Anda rencanakan — atau buka tab “Rekomendasi” untuk membandingkan ketujuhnya
            sekaligus.
          </span>
        </li>
        <li>
          <span>
            Baca skornya bersama rentangnya. Lokasi bernilai <strong>75 ± 8</strong>, tidak pernah cuma 75.
          </span>
        </li>
      </ol>
      <p className="muted">
        Skor dihitung dari{' '}
        {USE_GOOGLE_MAP ? 'jumlah usaha Google Maps dan data OpenStreetMap' : 'data OpenStreetMap'} dalam radius 1,5
        km. Kalau datanya tipis, LOKABIS mengatakannya terus terang, bukan menebak.
      </p>
    </section>
  );
}
