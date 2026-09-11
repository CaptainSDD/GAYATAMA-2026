import type { DataSource, Warning } from '../lib/api-types';
import { formatDateTime } from '../lib/format';

interface DataNoticesProps {
  dataSource: DataSource;
  onRefresh: () => void;
  refreshing: boolean;
}

/** Tells the reader when a result rests on incomplete or out-of-date data. */
export function DataNotices({ dataSource, onRefresh, refreshing }: DataNoticesProps) {
  return (
    <>
      {dataSource.siteConditions === 'unavailable' && (
        <div className="notice" role="status">
          <p>
            Road, walkability and flood-proxy data for this spot could not be loaded, so those inputs count as unknown
            and these scores are incomplete.
          </p>
          <button type="button" className="button-secondary" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? 'Loading…' : 'Try loading it again'}
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
      OpenStreetMap is unavailable, so this uses cached data from {formatDateTime(fetchedAt)}.
    </p>
  );
}

export function WarningList({ warnings }: { warnings: readonly Warning[] }) {
  if (warnings.length === 0) return null;
  return (
    <div className="warnings" role="alert">
      <h3>Warnings</h3>
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
      Data © OpenStreetMap contributors, {dataSource.licence} · fetched {formatDateTime(dataSource.fetchedAt)}
      {modelVersion !== undefined && ` · model ${modelVersion}`}
    </footer>
  );
}
