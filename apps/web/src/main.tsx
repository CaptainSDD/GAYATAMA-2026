import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { RouteFallback } from './components/RouteFallback';
import { LandingPage } from './features/landing/LandingPage';
import './styles.css';

/* Every route used to be imported eagerly into one 1.12 MB chunk, so a first
   time visitor landing on `/` downloaded Leaflet, the Google Maps bindings and
   the whole analysis screen before they could read the pitch.

   `LandingPage` stays a static import: it owns `/`, so lazy-loading it put a
   second round trip in front of the most likely first visit to save 2 kB. This is the
   audience PRODUCT.md describes — Indonesian micro-entrepreneurs, often on
   mobile data — so that is a real cost, not a lint score.

   Split by route. `AuthGate` carries the app and both map engines, which is by
   far the largest piece and the one a visitor on the landing page never needs.
   Leaflet's stylesheet moves with it, into `MapPicker`. */
const LoginPage = lazy(() => import('./features/auth/LoginPage').then((m) => ({ default: m.LoginPage })));
const SignupPage = lazy(() => import('./features/auth/SignupPage').then((m) => ({ default: m.SignupPage })));
const ProfilePage = lazy(() => import('./features/account/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const MembershipPage = lazy(() => import('./features/membership/MembershipPage').then((m) => ({ default: m.MembershipPage })));
const AuthGate = lazy(() => import('./features/auth/AuthGate').then((m) => ({ default: m.AuthGate })));
// Lazy too, though it is only a wrapper: it reaches Firebase through
// `useAuthState`, and importing it eagerly pulled the whole auth SDK into the
// landing page's critical path.
const PublicOnly = lazy(() => import('./features/auth/PublicOnly').then((m) => ({ default: m.PublicOnly })));

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

const root = document.getElementById('root');
if (root === null) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* The landing page owns the root: a visitor who has never signed up
              used to be bounced straight to /login and never saw an argument
              for signing up at all. The app lives under /app. */}
          <Route path="/" element={<LandingPage />} />
          <Route
            path="/login"
            element={
              <PublicOnly>
                <LoginPage />
              </PublicOnly>
            }
          />
          {/* Not wrapped in PublicOnly: SignupPage guards itself, because creating
              an account signs the user in and would trip a blanket redirect. */}
          <Route path="/signup" element={<SignupPage />} />
          {/* Reachable at /membership but not linked from anywhere yet, by
              request: the page exists, the navigation is the user's call. */}
          <Route path="/akun" element={<ProfilePage />} />
          <Route path="/membership" element={<MembershipPage />} />
          <Route path="/app/*" element={<AuthGate />} />
          <Route path="*" element={<AuthGate />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
