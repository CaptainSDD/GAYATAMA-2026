import type { BusinessType, LatLng } from '@gayatama/scoring';
import { useEffect, useState } from 'react';
import { ConfirmDialog } from './components/ConfirmDialog';
import { FloatingPanel } from './components/FloatingPanel';
import { CompassIcon, HelpIcon, LogOutIcon, MapPinIcon } from './components/Icons';
import { ShareButton } from './components/ShareButton';
import { ThemeToggle } from './components/ThemeToggle';
import { LocationView } from './features/location/LocationView';
import { LocationPreview } from './features/location/LocationPreview';
import { BusinessTypePicker, LocationSummary } from './features/map/LocationControls';
import { MapPicker } from './features/map/MapPicker';
import { Tour } from './features/tour/Tour';
import {
  DEFAULT_CENTER,
  isInSemarangCoverage,
  parseSelection,
  roundPoint,
  serializeSelection,
  type Selection,
} from './lib/location';
import { BUSINESS_TYPE_LABELS } from './lib/copy';
import { USE_GOOGLE_MAP } from './lib/map-config';
import { useOpportunities } from './lib/queries';
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
  const [analysisSelection, setAnalysisSelection] = useState<Selection | null>(null);
  const [opportunityCenter, setOpportunityCenter] = useState<LatLng | null>(null);
  const [initialCenter] = useState<LatLng>(() => selection.point ?? DEFAULT_CENTER);
  const [mapCenter, setMapCenter] = useState<LatLng>(initialCenter);
  const [locationCollapsed, setLocationCollapsed] = useState(false);
  const [sheetCollapsed, setSheetCollapsed] = useState(false);
  const [outsideCoverage, setOutsideCoverage] = useState(false);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  // Bumping this remounts the tour, which is how "replay" starts it over.
  const [tourRun, setTourRun] = useState(0);
  const opportunities = useOpportunities(opportunityCenter, selection.businessType);

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

  const toggleOpportunityMap = () => {
    setOpportunityCenter((current) => (current === null ? roundPoint(mapCenter) : null));
  };

  const chooseOpportunity = (point: LatLng) => {
    const next = { point: roundPoint(point), businessType: selection.businessType };
    setOutsideCoverage(false);
    setSelection(next);
    setAnalysisSelection(next);
    setOpportunityCenter(null);
    setSheetCollapsed(false);
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

  /**
   * The tour blocks the page, so its later steps cannot wait for the visitor to
   * pick a point and press Analisis. It runs both stages here instead, on the
   * map centre, which is the same path the "Pakai titik tengah" button takes.
   */
  const prepareTourResult = () => {
    const point = selection.point ?? (isInSemarangCoverage(mapCenter) ? roundPoint(mapCenter) : null);
    if (point === null) return;
    const next = { point, businessType: selection.businessType };
    setOutsideCoverage(false);
    setSelection(next);
    setAnalysisSelection(next);
    setSheetCollapsed(false);
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
          <MapPicker
            initialCenter={initialCenter}
            point={selection.point}
            analysisPoint={analysisSelection?.point ?? null}
            onPick={pick}
            onCenterChange={setMapCenter}
            opportunities={opportunityCenter === null ? null : opportunities.data ?? null}
            onOpportunityPick={chooseOpportunity}
          />
          {outsideCoverage && (
            <p className="coverage-warning" role="status">
              Lokasi itu berada di luar area cakupan Semarang. Pilih titik di dalam garis merah.
            </p>
          )}
        </section>

        {/* One card, read top to bottom: which place, then what to build there. */}
        <div className="overlay overlay-left">
          <FloatingPanel
            title="Lokasi"
            collapsed={locationCollapsed}
            onToggle={() => setLocationCollapsed((collapsed) => !collapsed)}
          >
            <LocationSummary
              point={selection.point}
              onUseMapCenter={() => pick(mapCenter)}
              onClearPoint={clearPoint}
            />
            <BusinessTypePicker businessType={selection.businessType} onBusinessTypeChange={chooseBusinessType} />
            <div className="opportunity-control">
              <div>
                <strong>Peta peluang area</strong>
                <p>Bandingkan 9 titik di sekitar tengah peta dengan data OpenStreetMap.</p>
              </div>
              <button type="button" className="button-secondary" onClick={toggleOpportunityMap} disabled={opportunities.isFetching}>
                <CompassIcon size={17} />
                {opportunityCenter === null ? 'Tampilkan peluang' : opportunities.isFetching ? 'Menghitung…' : 'Sembunyikan peta'}
              </button>
              {opportunityCenter !== null && opportunities.error !== null && (
                <p className="notice" role="alert">Peta peluang belum dapat dimuat. Coba lagi beberapa saat lagi.</p>
              )}
              {opportunityCenter !== null && opportunities.data !== undefined && (
                <p className="opportunity-hint" role="status">Hijau lebih potensial. Klik sel berwarna untuk analisis lengkap.</p>
              )}
            </div>
          </FloatingPanel>
        </div>

        {/* `panel` is kept on the results card so the styling written against
            `.panel .x` keeps applying; `floating-panel` restates only its box. */}
        <div className="overlay overlay-right">
          <FloatingPanel
            title="Analisis lokasi"
            // Carries the chosen category, so it stays visible while reading the
            // result instead of having to be recalled from the other card.
            badge={BUSINESS_TYPE_LABELS[selection.businessType]}
            tourId="score"
            className="panel results-panel"
            collapsed={sheetCollapsed}
            onToggle={() => setSheetCollapsed((collapsed) => !collapsed)}
          >
            {selection.point === null ? (
              <Intro />
            ) : analysisSelection === null ? (
              <LocationPreview
                point={selection.point}
                businessType={selection.businessType}
                onAnalyse={analyseLocation}
              />
            ) : (
              <LocationView
                point={analysisSelection.point!}
                businessType={analysisSelection.businessType}
                onBusinessTypeChange={analyseBusinessType}
              />
            )}
          </FloatingPanel>
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

      <Tour key={tourRun} scope={userId} onNeedLocation={prepareTourResult} />
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
