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
  return (
    <>
      {dataSource.siteConditions === 'unavailable' && (
        <div className="notice" role="status">
          <p>
            Data jalan, kemudahan jalan kaki, dan perkiraan banjir untuk titik ini gagal dimuat. Input itu dihitung
            sebagai tidak diketahui, jadi skor di bawah belum lengkap.
          </p>
          <button type="button" className="button-secondary" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? 'Memuat…' : 'Coba muat ulang'}
          </button>
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

/** ODbL requires attribution wherever OpenStreetMap data is shown. */
export function Attribution({ dataSource, modelVersion }: { dataSource: DataSource; modelVersion?: string }) {
  return (
    <footer className="attribution">
      Data © OpenStreetMap contributors, {dataSource.licence} · diambil {formatDateTime(dataSource.fetchedAt)}
      {modelVersion !== undefined && ` · model ${modelVersion}`}
    </footer>
  );
}
