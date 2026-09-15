/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the LOKABIS API, without `/api/v1`. Defaults to http://localhost:3000. */
  readonly VITE_API_BASE_URL?: string;
  /** Browser key for the Maps JavaScript API. When set, the map is a Google map and Google business counts are used. */
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  /** Map ID for the Google map. Defaults to Google's DEMO_MAP_ID. */
  readonly VITE_GOOGLE_MAP_ID?: string;
  /** Firebase Web SDK config — public by design, see docs/installation.md. */
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
