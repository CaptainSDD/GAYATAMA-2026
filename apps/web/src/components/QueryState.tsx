import { errorMessage, isRetryable } from '../lib/copy';

export function Loading({ message }: { message: string }) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <div>
        <p>{message}</p>
        <p className="muted">The first request for a new area can take several seconds while map data loads.</p>
      </div>
    </div>
  );
}

export function QueryError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className="error" role="alert">
      <p>{errorMessage(error)}</p>
      {isRetryable(error) && (
        <button type="button" className="button-secondary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
