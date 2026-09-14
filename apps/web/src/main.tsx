import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import { AuthGate } from './features/auth/AuthGate';
import { LoginPage } from './features/auth/LoginPage';
import { PublicOnly } from './features/auth/PublicOnly';
import { SignupPage } from './features/auth/SignupPage';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

const root = document.getElementById('root');
if (root === null) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
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
          <Route path="*" element={<AuthGate />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
