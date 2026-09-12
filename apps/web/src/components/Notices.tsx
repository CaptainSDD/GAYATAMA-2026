import type { DataSource, Warning } from '../lib/api-types';
import { formatDateTime } from '../lib/format';

interface DataNoticesProps {
  dataSource: DataSource;
  onRefresh: () => void;
  refreshing: boolean;
}

/** Tells the reader when a result rests on incomplete or out-of-date data. */
export function DataNotices({ dataSource, onRefresh, refreshing }: DataNoticesProps) {
  const retry = (
    <button type="button" className="button-secondary" onClick={onRefresh} disabled={refreshing}>
      {refreshing ? 'Loading…' : 'Try loading it again'}
    </button>
  );

  return (
    <>
      {dataSource.places.status === 'unavailable' && (
        <div className="notice" role="status">
          <p>
            Business counts from Google Maps could not be loaded, so every facility comes from OpenStreetMap, which
            misses many small businesses. These scores may be incomplete.
          </p>
          {retry}
        </div>
      )}
      {dataSource.places.status === 'not_configured' && (
        <p className="notice" role="status">
          Google Maps business counts are not set up on the server, so every facility comes from OpenStreetMap, which
          misses many small businesses.
        </p>
      )}
      {dataSource.siteConditions === 'unavailable' && (
        <div className="notice" role="status">
          <p>
            Road, walkability and flood-proxy data for this spot could not be loaded, so those inputs count as unknown
            and these scores are incomplete.
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
        ? `snapshot of ${formatDateTime(dataSource.fetchedAt)}`
        : `fetched ${formatDateTime(dataSource.fetchedAt)}`}
      {dataSource.places.status === 'used' && ` · Business counts: ${dataSource.places.attribution ?? 'Google Maps'}`}
      {dataSource.overture !== null && ` · Photocopy and stationery shops: ${dataSource.overture.attribution}`}
      {modelVersion !== undefined && ` · model ${modelVersion}`}
    </footer>
  );
}
