import type { BusinessType, LatLng } from '@gayatama/scoring';
import { useEffect, useState } from 'react';
import { ConfirmDialog } from './components/ConfirmDialog';
import { LogOutIcon, MapPinIcon } from './components/Icons';
import { ShareButton } from './components/ShareButton';
import { ThemeToggle } from './components/ThemeToggle';
import { LocationView } from './features/location/LocationView';
import { LocationPreview } from './features/location/LocationPreview';
import { LocationControls } from './features/map/LocationControls';
import { MapPicker } from './features/map/MapPicker';
import {
  DEFAULT_CENTER,
  isInSemarangCoverage,
  parseSelection,
  roundPoint,
  serializeSelection,
  type Selection,
} from './lib/location';
import { USE_GOOGLE_MAP } from './lib/map-config';

interface AppProps {
  /** Present only when AuthGate renders this — absent in tests that mount App on its own. */
  userEmail?: string | null;
  /** Accepted from AuthGate even though the stage-2 UI has no per-user tour state. */
  userId?: string;
  emailVerified?: boolean;
  verificationResent?: boolean;
  onSignOut?: () => void;
  onResendVerification?: () => void;
}

export function App({
  userEmail,
  emailVerified = true,
  verificationResent = false,
  onSignOut,
  onResendVerification,
}: AppProps) {
  const [selection, setSelection] = useState<Selection>(() => parseSelection(window.location.search));
  const [analysisSelection, setAnalysisSelection] = useState<Selection | null>(null);
  const [initialCenter] = useState<LatLng>(() => selection.point ?? DEFAULT_CENTER);
  const [mapCenter, setMapCenter] = useState<LatLng>(initialCenter);
  const [sheetCollapsed, setSheetCollapsed] = useState(false);
  const [outsideCoverage, setOutsideCoverage] = useState(false);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);

  // Keep the URL in step with the selection, so any result can be shared as a link.
  useEffect(() => {
    const search = serializeSelection(selection);
    if (search !== window.location.search) {
      window.history.replaceState(null, '', `${window.location.pathname}${search}`);
    }
  }, [selection]);

  const pick = (point: LatLng) => {
    if (!isInSemarangCoverage(point)) {
      setOutsideCoverage(true);
      return;
    }
    setOutsideCoverage(false);
    setSelection((current) => ({ ...current, point: roundPoint(point) }));
    setAnalysisSelection(null);
    setSheetCollapsed(false);
  };
  const clearPoint = () => {
    setSelection((current) => ({ ...current, point: null }));
    setAnalysisSelection(null);
    setOutsideCoverage(false);
    setSheetCollapsed(false);
  };

  const chooseBusinessType = (businessType: BusinessType) => {
    setSelection((current) => ({ ...current, businessType }));
    setAnalysisSelection(null);
  };

  const analyseLocation = () => {
    if (selection.point !== null) setAnalysisSelection(selection);
  };

  const analyseBusinessType = (businessType: BusinessType) => {
    if (selection.point === null) return;
    const nextSelection = { point: selection.point, businessType };
    setSelection(nextSelection);
    setAnalysisSelection(nextSelection);
  };

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
          <ShareButton disabled={analysisSelection === null} />
          <ThemeToggle />
          {onSignOut !== undefined && (
            <button
              type="button"
              className="icon-button icon-button-danger"
              onClick={() => setConfirmingSignOut(true)}
              aria-label="Keluar"
              title={userEmail ?? 'Keluar'}
            >
              <LogOutIcon />
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
          <MapPicker
            initialCenter={initialCenter}
            point={selection.point}
            analysisPoint={analysisSelection?.point ?? null}
            onPick={pick}
            onCenterChange={setMapCenter}
          />
          {outsideCoverage && (
            <p className="coverage-warning" role="status">
              Lokasi itu berada di luar area cakupan Semarang. Pilih titik di dalam garis merah.
            </p>
          )}
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
            onClearPoint={clearPoint}
          />
          {selection.point === null ? (
            <Intro />
          ) : analysisSelection === null ? (
            <LocationPreview point={selection.point} businessType={selection.businessType} onAnalyse={analyseLocation} />
          ) : (
            <LocationView
              point={analysisSelection.point!}
              businessType={analysisSelection.businessType}
              onBusinessTypeChange={analyseBusinessType}
            />
          )}
        </aside>
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
    </div>
  );
}

function Intro() {
  return (
    <section className="intro">
      <span className="eyebrow">Analisis lokasi</span>
      <h2>Temukan tempat yang tepat.</h2>
      <p className="intro-copy">
        Pilih satu titik di dalam garis merah. LOKABIS akan merangkum potensi pelanggan, persaingan, dan kecocokan
        usaha di sekitarnya.
      </p>
      <details className="panel-disclosure intro-disclosure">
        <summary>Cara kerja penilaian</summary>
        <p>
          Penilaian memakai{' '}
          {USE_GOOGLE_MAP ? 'data Google Maps dan OpenStreetMap' : 'data OpenStreetMap'} dalam radius 1,5 km. Jika
          datanya terbatas, hasil akan ditandai agar Anda tahu bagian yang perlu dicek langsung.
        </p>
      </details>
    </section>
  );
}
