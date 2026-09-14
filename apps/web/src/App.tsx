import type { BusinessType, LatLng } from '@gayatama/scoring';
import { useEffect, useState } from 'react';
import { ConfirmDialog } from './components/ConfirmDialog';
import { FloatingPanel } from './components/FloatingPanel';
import { HelpIcon, LogOutIcon, MapPinIcon } from './components/Icons';
import { ShareButton } from './components/ShareButton';
import { ThemeToggle } from './components/ThemeToggle';
import { LocationView } from './features/location/LocationView';
import { BusinessTypePicker, LocationSummary } from './features/map/LocationControls';
import { MapPicker } from './features/map/MapPicker';
import { Tour } from './features/tour/Tour';
import { DEFAULT_CENTER, parseSelection, roundPoint, serializeSelection, type Selection } from './lib/location';
import { USE_GOOGLE_MAP } from './lib/map-config';
import { resetProgress } from './lib/tour';

interface AppProps {
  /** Present only when AuthGate renders this — absent in tests that mount App on its own. */
  userEmail?: string | null;
  /** Scopes the onboarding tour to the signed-in account. */
  userId?: string;
  emailVerified?: boolean;
  verificationResent?: boolean;
  onSignOut?: () => void;
  onResendVerification?: () => void;
}

export function App({
  userEmail,
  userId = 'anon',
  emailVerified = true,
  verificationResent = false,
  onSignOut,
  onResendVerification,
}: AppProps) {
  const [selection, setSelection] = useState<Selection>(() => parseSelection(window.location.search));
  const [initialCenter] = useState<LatLng>(() => selection.point ?? DEFAULT_CENTER);
  const [mapCenter, setMapCenter] = useState<LatLng>(initialCenter);
  const [controlsCollapsed, setControlsCollapsed] = useState(false);
  const [resultsCollapsed, setResultsCollapsed] = useState(false);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  // Bumping this remounts the tour, which is how "replay" starts it over.
  const [tourRun, setTourRun] = useState(0);

  // Keep the URL in step with the selection, so any result can be shared as a link.
  useEffect(() => {
    const search = serializeSelection(selection);
    if (search !== window.location.search) {
      window.history.replaceState(null, '', `${window.location.pathname}${search}`);
    }
  }, [selection]);

  const pick = (point: LatLng) => {
    setSelection((current) => ({ ...current, point: roundPoint(point) }));
    setResultsCollapsed(false);
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
          <button
            type="button"
            className="icon-button"
            onClick={() => {
              resetProgress(userId);
              setTourRun((run) => run + 1);
            }}
            aria-label="Lihat panduan lagi"
            title="Lihat panduan lagi"
          >
            <HelpIcon size={20} />
            <span className="button-text">Panduan</span>
          </button>
          <ShareButton disabled={selection.point === null} />
          <ThemeToggle />
          {onSignOut !== undefined && (
            <button
              type="button"
              className="icon-button icon-button-danger"
              onClick={() => setConfirmingSignOut(true)}
              aria-label="Keluar"
              title={userEmail ?? 'Keluar'}
            >
              <LogOutIcon size={20} />
              <span className="button-text">Keluar</span>
            </button>
          )}
        </div>
      </header>

      {!emailVerified && onResendVerification !== undefined && (
        <div className="notice auth-banner" role="status">
          <span>Verifikasi email Anda untuk mengamankan akun ini.</span>
          <button type="button" className="button-secondary" onClick={onResendVerification} disabled={verificationResent}>
            {verificationResent ? 'Email terkirim' : 'Kirim ulang'}
          </button>
        </div>
      )}

      <main className="layout">
        <section className="map-pane" aria-label="Peta. Klik untuk memilih lokasi.">
          <MapPicker initialCenter={initialCenter} point={selection.point} onPick={pick} onCenterChange={setMapCenter} />
        </section>

        <div className="overlay overlay-left">
          <FloatingPanel
            title="Jenis usaha"
            collapsed={controlsCollapsed}
            onToggle={() => setControlsCollapsed((collapsed) => !collapsed)}
          >
            <BusinessTypePicker businessType={selection.businessType} onBusinessTypeChange={chooseBusinessType} />
            <LocationSummary point={selection.point} onUseMapCenter={() => pick(mapCenter)} />
          </FloatingPanel>
        </div>

        <div className="overlay overlay-right">
          {selection.point === null ? (
            <Intro />
          ) : (
            <FloatingPanel
              title="Analisis lokasi"
              tourId="score"
              className="results-panel"
              collapsed={resultsCollapsed}
              onToggle={() => setResultsCollapsed((collapsed) => !collapsed)}
            >
              <LocationView
                point={selection.point}
                businessType={selection.businessType}
                onBusinessTypeChange={chooseBusinessType}
              />
            </FloatingPanel>
          )}
        </div>
      </main>

      <ConfirmDialog
        open={confirmingSignOut}
        title="Keluar dari LOKABIS?"
        body="Anda perlu login lagi untuk membuka analisis berikutnya."
        confirmLabel="Keluar"
        onCancel={() => setConfirmingSignOut(false)}
        onConfirm={() => {
          setConfirmingSignOut(false);
          onSignOut?.();
        }}
      />

      <Tour key={tourRun} scope={userId} onNeedLocation={() => pick(mapCenter)} />
    </div>
  );
}

// Leads with the action and what it returns. The old version opened with a
// question and then talked about data sources, which told a first-time visitor
// neither what to do nor what they would get.
function Intro() {
  return (
    <section className="intro">
      <h2>Klik satu titik di peta</h2>
      <p>Anda akan melihat skor 0–100 seberapa cocok lokasi itu untuk jenis usaha yang dipilih.</p>
      <p className="muted">
        Dinilai dari {USE_GOOGLE_MAP ? 'jumlah usaha Google Maps dan data OpenStreetMap' : 'data OpenStreetMap'} dalam
        radius 1,5 km. Kalau datanya tipis, LOKABIS mengatakannya terus terang, bukan menebak.
      </p>
    </section>
  );
}
