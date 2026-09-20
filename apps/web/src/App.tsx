import lokabisLogo from './assets/lokabis-logo.png';
import type { BusinessType, ComponentWeights, LatLng } from '@gayatama/scoring';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ConfirmDialog } from './components/ConfirmDialog';
import { FloatingPanel } from './components/FloatingPanel';
import { ChevronDownIcon, CloseIcon, HelpIcon, LogOutIcon, UserIcon } from './components/Icons';
import { ShareButton } from './components/ShareButton';
import { ThemeToggle } from './components/ThemeToggle';
import { LocationComparisonView } from './features/compare/LocationComparisonView';
import { LocationView } from './features/location/LocationView';
import { LocationPreview } from './features/location/LocationPreview';
import { BusinessTypePicker, LocationSummary, PointModeTabs, type PointMode } from './features/map/LocationControls';
import { MapPicker } from './features/map/MapPicker';
import { Tour } from './features/tour/Tour';
import { useIdToken } from './features/auth/useIdToken';
import { useProfile } from './lib/queries';
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
  /** Whether the link this page opened with already carried a weight set. */
  const [linkCarriedWeights] = useState(() => parseSelection(window.location.search).weights !== null);
  const [analysisSelection, setAnalysisSelection] = useState<Selection | null>(null);
  const [initialCenter] = useState<LatLng>(() => selection.point ?? DEFAULT_CENTER);
  const [mapCenter, setMapCenter] = useState<LatLng>(initialCenter);
  const [locationCollapsed, setLocationCollapsed] = useState(false);
  const [sheetCollapsed, setSheetCollapsed] = useState(false);
  const [outsideCoverage, setOutsideCoverage] = useState(false);
  /* Session-scoped on purpose: the reminder should stop nagging while someone
     is working, and come back next visit if the email is still unverified. */
  const [verifyBannerDismissed, setVerifyBannerDismissed] = useState(false);
  // Which route opened the result: a chosen category, or "compare them all".
  const [entryMode, setEntryMode] = useState<'score' | 'compare'>('score');
  // Comparing two sites for one category. `pointB` is filled by the next map click.
  const [siteCompare, setSiteCompare] = useState<{ active: boolean; pointB: LatLng | null }>({
    active: false,
    pointB: null,
  });
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  // Bumping this remounts the tour, which is how "replay" starts it over.
  const [tourRun, setTourRun] = useState(0);

  const idToken = useIdToken();
  const profile = useProfile(idToken);
  const savedWeights = profile.data?.profile?.weights ?? null;

  /**
   * Adopts the account's saved weight set once, on sign-in.
   *
   * A set named in the link wins: someone opening a shared result must see the
   * score that was shared, not their own weights applied to someone else's
   * point. After that the visitor's own edits win, which is why this runs only
   * while the selection is still on the baseline.
   */
  useEffect(() => {
    if (savedWeights === null || linkCarriedWeights) return;
    setSelection((current) => (current.weights === null ? { ...current, weights: savedWeights } : current));
  }, [savedWeights, linkCarriedWeights]);

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
    // While comparing, the map is choosing the second site rather than replacing the first.
    if (siteCompare.active) {
      setSiteCompare({ active: true, pointB: roundPoint(point) });
      setSheetCollapsed(false);
      return;
    }
    setSelection((current) => ({ ...current, point: roundPoint(point) }));
    setAnalysisSelection(null);
    setSheetCollapsed(false);
  };
  const clearPoint = () => {
    setSelection((current) => ({ ...current, point: null }));
    setAnalysisSelection(null);
    setSiteCompare({ active: false, pointB: null });
    setOutsideCoverage(false);
    setSheetCollapsed(false);
  };

  /**
   * The mode is derived rather than stored: `siteCompare.active` already says
   * whether a second point is in play, and two sources of truth for one fact
   * drift apart.
   */
  const pointMode: PointMode = siteCompare.active ? 'dua' : 'satu';

  const choosePointMode = (mode: PointMode) => {
    if (mode === pointMode) return;
    setSiteCompare({ active: mode === 'dua', pointB: null });
    setOutsideCoverage(false);
    setSheetCollapsed(false);
  };

  const clearSecondPoint = () => {
    setSiteCompare({ active: true, pointB: null });
    setOutsideCoverage(false);
  };

  const chooseWeights = (weights: ComponentWeights | null) => {
    setSelection((current) => ({ ...current, weights }));
    setAnalysisSelection((current) => (current === null ? null : { ...current, weights }));
  };

  const chooseBusinessType = (businessType: BusinessType) => {
    setSelection((current) => ({ ...current, businessType }));
    setAnalysisSelection(null);
  };

  const analyseLocation = () => {
    if (selection.point !== null) {
      setEntryMode('score');
      setAnalysisSelection(selection);
    }
  };

  /**
   * The location-first route. It analyses the same point as the button beside
   * it; only the tab it opens on differs, so the chosen category still applies
   * once a comparison sends the visitor to a full score.
   */
  const compareLocation = () => {
    if (selection.point !== null) {
      setEntryMode('compare');
      setAnalysisSelection(selection);
    }
  };

  const analyseBusinessType = (businessType: BusinessType) => {
    if (selection.point === null) return;
    const nextSelection = { point: selection.point, businessType, weights: selection.weights };
    setSelection(nextSelection);
    setAnalysisSelection(nextSelection);
  };

  /** Moves the analysis to a nearby point the opportunity grid suggested, keeping the category. */
  const analysePoint = (point: LatLng) => {
    if (!isInSemarangCoverage(point)) return;
    const nextSelection = { point: roundPoint(point), businessType: selection.businessType, weights: selection.weights };
    setEntryMode('score');
    setSelection(nextSelection);
    setAnalysisSelection(nextSelection);
  };

  /**
   * The tour blocks the page, so its later steps cannot wait for the visitor to
   * pick a point and press Analisis. It runs both stages here instead, on the
   * map centre — the one place left that still needs the tracked centre.
   */
  const prepareTourResult = () => {
    const point = selection.point ?? (isInSemarangCoverage(mapCenter) ? roundPoint(mapCenter) : null);
    if (point === null) return;
    const next = { point, businessType: selection.businessType, weights: selection.weights };
    setOutsideCoverage(false);
    setSelection(next);
    setAnalysisSelection(next);
    setSheetCollapsed(false);
  };

  return (
    <div className="app">
      {/* The screen had no h1 at all: the document outline opened on three peer
          h2s. Visually hidden because the brand mark is the sighted title. */}
      <h1 className="visually-hidden">LOKABIS — penilaian kelayakan lokasi usaha mikro</h1>

      <header className="app-header">
        <details className="brand-nav">
          <summary className="brand-summary">
            <img className="brand-logo" src={lokabisLogo} alt="LOKABIS" width={132} height={44} />
            <ChevronDownIcon size={16} />
          </summary>
          <div className="brand-nav-actions">
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
            <Link className="icon-button" to="/akun" aria-label="Akun" title="Akun">
              <UserIcon size={20} />
              <span className="button-text">Akun</span>
            </Link>
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
        </details>
      </header>

      {/* An account reminder, not a task message: it has no business sitting in
          the middle of the map, which is the one surface this screen is for. It
          moves to the top edge beside the brand, and it can be dismissed —
          nothing here is urgent enough to be permanent. */}
      {!emailVerified && onResendVerification !== undefined && !verifyBannerDismissed && (
        <div className="notice auth-banner" role="status">
          <span className="auth-banner-message">Verifikasi email Anda untuk mengamankan akun ini.</span>
          <button type="button" className="button-secondary" onClick={onResendVerification} disabled={verificationResent}>
            {verificationResent ? 'Email terkirim' : 'Kirim ulang'}
          </button>
          <button
            type="button"
            className="auth-banner-dismiss icon-button"
            onClick={() => setVerifyBannerDismissed(true)}
            aria-label="Tutup pengingat verifikasi"
          >
            <CloseIcon size={16} />
          </button>
        </div>
      )}

      <main className="layout">
        <section
          className="map-pane"
          aria-label="Peta. Klik untuk memilih lokasi, atau geser peta dengan tombol panah lalu pilih titik tengahnya."
        >
          <MapPicker
            initialCenter={initialCenter}
            point={selection.point}
            // Zone rings and facility dots belong to one analysed point, so they
            // stay off while two sites are being compared.
            analysisPoint={siteCompare.active ? null : analysisSelection?.point ?? null}
            comparing={siteCompare.active}
            secondPoint={siteCompare.pointB}
            onPick={pick}
            onCenterChange={setMapCenter}
          />
          {/* Picking was mouse-only: `MapPicker` binds `click` and nothing
              else, so the product's one primary action was unreachable by
              keyboard. Both map engines pan on arrow keys once focused, so the
              missing half was a way to commit the centre. `prepareTourResult`
              already did exactly this for the guided tour and kept it from
              users. */}
          <span className="map-centre-crosshair" aria-hidden="true" />
          <button
            type="button"
            className="map-centre-pick"
            onClick={() => pick(mapCenter)}
          >
            Pilih titik tengah peta
          </button>
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
            barControls={
              <PointModeTabs mode={pointMode} onModeChange={choosePointMode} disableTwo={selection.point === null} />
            }
            collapsed={locationCollapsed}
            onToggle={() => setLocationCollapsed((collapsed) => !collapsed)}
          >
            <LocationSummary
              mode={pointMode}
              point={selection.point}
              secondPoint={siteCompare.pointB}
              onClearPoint={clearPoint}
              onClearSecondPoint={clearSecondPoint}
            />
            <BusinessTypePicker businessType={selection.businessType} onBusinessTypeChange={chooseBusinessType} />
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
            ) : siteCompare.active ? (
              <LocationComparisonView
                pointA={selection.point}
                pointB={siteCompare.pointB}
                businessType={selection.businessType}
                onChangeSecondPoint={() => setSiteCompare({ active: true, pointB: null })}
                onExit={() => setSiteCompare({ active: false, pointB: null })}
              />
            ) : analysisSelection === null ? (
              <LocationPreview
                point={selection.point}
                businessType={selection.businessType}
                onAnalyse={analyseLocation}
                onCompare={compareLocation}
              />
            ) : (
              <LocationView
                point={analysisSelection.point!}
                businessType={analysisSelection.businessType}
                onBusinessTypeChange={analyseBusinessType}
                onAnalysePoint={analysePoint}
                weights={selection.weights}
                onWeightsChange={chooseWeights}
                entryMode={entryMode}
                onClearPoint={clearPoint}
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
