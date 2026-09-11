/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the GAYATAMA API, without `/api/v1`. Defaults to http://localhost:3000. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
