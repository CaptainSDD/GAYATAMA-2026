import { errorMessage, errorTitle, isRetryable } from '../lib/copy';
import { AlertIcon } from './Icons';
import { ScoreSkeleton } from './Skeleton';

export function Loading({ message }: { message: string }) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <div className="loading-head">
        <span className="spinner" aria-hidden="true" />
        <div>
          <p>{message}</p>
          <p className="muted">Permintaan pertama untuk area baru bisa makan beberapa detik sambil data peta diambil.</p>
        </div>
      </div>
      <ScoreSkeleton />
    </div>
  );
}

/**
 * Two different things were wearing one face.
 *
 * `RATE_LIMITED`, `UPSTREAM_TIMEOUT` and `NETWORK_ERROR` are failures: something
 * broke and a retry may fix it. Red, `role="alert"`, a warning mark — correct.
 *
 * The three `isRetryable` excludes are not failures at all. Below the
 * confidence floor the engine is working exactly as designed and declining to
 * guess; a point in water is a mis-click; outside Semarang is a limit of the
 * product, not a mistake by the visitor. Dressing those as errors told people
 * they had broken something at the moment the product was being most honest
 * with them — and, because no retry could help, left them with no button at all.
 *
 * Same words, different register, and an exit that actually exists.
 */
export function QueryError({
  error,
  onRetry,
  onPickAnother,
}: {
  error: unknown;
  onRetry: () => void;
  onPickAnother?: () => void;
}) {
  if (!isRetryable(error)) return <HeldBack error={error} onPickAnother={onPickAnother} />;

  return (
    <div className="error" role="alert">
      <p className="error-title">
        <AlertIcon size={16} /> {errorTitle(error)}
      </p>
      <p>{errorMessage(error)}</p>
      <button type="button" className="button-secondary" onClick={onRetry}>
        Coba lagi
      </button>
    </div>
  );
}

/**
 * The product declining to answer, stated as a decision rather than a fault.
 * `role="status"` because nothing went wrong: this is the result.
 */
export function HeldBack({ error, onPickAnother }: { error: unknown; onPickAnother?: () => void }) {
  return (
    <div className="held-back" role="status">
      <p className="held-back-title">{errorTitle(error)}</p>
      <p>{errorMessage(error)}</p>
      {onPickAnother !== undefined && (
        <button type="button" className="button-secondary" onClick={onPickAnother}>
          Pilih titik lain di peta
        </button>
      )}
    </div>
  );
}
