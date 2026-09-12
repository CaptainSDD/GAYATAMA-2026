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

export function QueryError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className="error" role="alert">
      <p className="error-title">
        <AlertIcon size={16} /> {errorTitle(error)}
      </p>
      <p>{errorMessage(error)}</p>
      {isRetryable(error) && (
        <button type="button" className="button-secondary" onClick={onRetry}>
          Coba lagi
        </button>
      )}
    </div>
  );
}
