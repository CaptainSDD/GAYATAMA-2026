import { Skeleton } from '../../components/Skeleton';

/** Shown while Firebase resolves whether anyone is already signed in. */
export function AuthLoading() {
  return (
    <div className="auth-page">
      <Skeleton height="22rem" width="26rem" />
    </div>
  );
}
