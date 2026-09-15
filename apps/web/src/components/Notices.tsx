import type { DataSource, Warning } from '../lib/api-types';
import { formatDateTime } from '../lib/format';
import { AlertIcon } from './Icons';

interface DataNoticesProps {
  dataSource: DataSource;
  onRefresh: () => void;
  refreshing: boolean;
}

/**
 * Tells the reader when a result rests on incomplete or out-of-date data.
 * Interface rule: this is never hidden or collapsed away.
 */
export function DataNotices({ dataSource, onRefresh, refreshing }: DataNoticesProps) {
  const retry = (
    <button type="button" className="button-secondary" onClick={onRefresh} disabled={refreshing}>
      {refreshing ? 'Memuat…' : 'Coba muat ulang'}
    </button>
  );

  return (
    <>
      {dataSource.places.status === 'unavailable' && (
        <div className="notice" role="status">
          <p>
            Jumlah usaha dari Google Maps gagal dimuat, jadi semua fasilitas memakai data OpenStreetMap, yang sering
            tidak mencatat usaha-usaha kecil. Skor di bawah mungkin belum lengkap.
          </p>
          {retry}
        </div>
      )}
      {dataSource.places.status === 'not_configured' && (
        <p className="notice" role="status">
          Jumlah usaha dari Google Maps belum disiapkan di server, jadi semua fasilitas memakai data OpenStreetMap,
          yang sering tidak mencatat usaha-usaha kecil.
        </p>
      )}
      {dataSource.siteConditions === 'unavailable' && (
        <div className="notice" role="status">
          <p>
            Data jalan, kemudahan jalan kaki, dan perkiraan banjir untuk titik ini gagal dimuat. Agar kegagalan data
            tidak menurunkan skor menjadi nol, jalan dan jalan kaki memakai nilai netral 50, sedangkan transportasi
            dan parkir tetap dihitung dari data fasilitas. Keamanan operasional juga memakai nilai netral 50.
          </p>
          {retry}
        </div>
      )}
      {dataSource.stale && <StaleDataNotice fetchedAt={dataSource.fetchedAt} />}
    </>
  );
}

export function StaleDataNotice({ fetchedAt }: { fetchedAt: string }) {
  return (
    <p className="notice">
      OpenStreetMap sedang tidak bisa dihubungi, jadi ini memakai data tersimpan dari {formatDateTime(fetchedAt)}.
    </p>
  );
}

export function WarningList({ warnings }: { warnings: readonly Warning[] }) {
  if (warnings.length === 0) return null;
  return (
    <div className="warnings" role="alert">
      <h3>
        <AlertIcon size={16} /> Peringatan
      </h3>
      <ul>
        {warnings.map((warning) => (
          <li key={warning.code}>{warning.message}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * ODbL requires attribution wherever OpenStreetMap data is shown, Google Maps
 * Platform policies require "Google Maps" wherever its counts feed a result, and
 * Overture asks to be credited for its data.
 */
export function Attribution({ dataSource, modelVersion }: { dataSource: DataSource; modelVersion?: string }) {
  return (
    <footer className="attribution">
      Data © OpenStreetMap contributors, {dataSource.licence} ·{' '}
      {dataSource.via === 'snapshot'
        ? `snapshot ${formatDateTime(dataSource.fetchedAt)}`
        : `diambil ${formatDateTime(dataSource.fetchedAt)}`}
      {dataSource.places.status === 'used' && ` · Jumlah usaha: ${dataSource.places.attribution ?? 'Google Maps'}`}
      {dataSource.overture !== null && ` · Fotokopi & ATK: ${dataSource.overture.attribution}`}
      {modelVersion !== undefined && ` · model ${modelVersion}`}
    </footer>
  );
}
