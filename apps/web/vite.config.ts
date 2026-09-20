import { readFile } from 'node:fs/promises';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const COMMON_END = '/* Layout ----------------------------------------------------------------- */';
const CHIP_START = '/* Chips ------------------------------------------------------------------- */';
const CHIP_END = '/* States ------------------------------------------------------------------ */';
const FALLBACK_START = '/* Route chunk fetch.';
const FALLBACK_END = '/* Grid because the <div> notices';
const LANDING_START = '/* Landing ====================================================================';
const LANDING_END = '/* Account -------------------------------------------------------------------';

/**
 * Keep one readable stylesheet as the source of truth while emitting route-owned
 * CSS. The public page needs the tokens/base plus its Studio Sheet block; app
 * routes need everything except that block. Query IDs remain CSS modules, so
 * Vite still resolves font/image URLs and performs ordinary CSS extraction.
 */
function routeStyles(): Plugin {
  return {
    name: 'gayatama-route-styles',
    enforce: 'pre',
    async load(id) {
      const [filePath, query = ''] = id.split('?', 2);
      if (!filePath.replaceAll('\\', '/').endsWith('/src/styles.css') || !['landing', 'app'].includes(query)) {
        return null;
      }

      const source = await readFile(filePath, 'utf8');
      this.addWatchFile(filePath);

      const commonEnd = source.indexOf(COMMON_END);
      const chipStart = source.indexOf(CHIP_START);
      const chipEnd = source.indexOf(CHIP_END);
      const fallbackStart = source.indexOf(FALLBACK_START);
      const fallbackEnd = source.indexOf(FALLBACK_END);
      const landingStart = source.indexOf(LANDING_START);
      const landingEnd = source.indexOf(LANDING_END);
      if (
        commonEnd < 0 ||
        chipStart < 0 ||
        chipEnd < 0 ||
        fallbackStart < 0 ||
        fallbackEnd < 0 ||
        landingStart < 0 ||
        landingEnd < 0 ||
        !(
          commonEnd < chipStart &&
          chipStart < chipEnd &&
          chipEnd < fallbackStart &&
          fallbackStart < fallbackEnd &&
          fallbackEnd < landingStart &&
          landingStart < landingEnd
        )
      ) {
        this.error('Unable to split src/styles.css: one or more route-style boundary comments are missing or out of order.');
      }

      const code =
        query === 'landing'
          ? `${source.slice(0, commonEnd)}${source.slice(chipStart, chipEnd)}${source.slice(fallbackStart, fallbackEnd)}${source.slice(landingStart, landingEnd)}`
          : `${source.slice(0, landingStart)}${source.slice(landingEnd)}`;

      return { code, map: null };
    },
  };
}

export default defineConfig({
  plugins: [routeStyles(), react()],
  // `.env` lives at the repository root and is shared with the API.
  envDir: '../../',
  server: { port: 5173, strictPort: true },
  build: {
    rollupOptions: {
      output: {
        // Vendors split apart so a change to app code does not invalidate the
        // cached copy of React, Firebase or the map engines. Firebase and the
        // two map libraries are the heaviest, and none of them is needed to
        // render the landing page.
        manualChunks: {
          // 'react-dom/client' is the specifier actually imported; listing
          // only 'react-dom' left the renderer in the entry chunk.
          react: ['react', 'react-dom', 'react-dom/client', 'react-router-dom'],
          firebase: ['firebase/app', 'firebase/auth'],
          maps: ['leaflet', 'react-leaflet', '@vis.gl/react-google-maps'],
          query: ['@tanstack/react-query'],
          // Imported by 30 modules across every lazy route, so without this it
          // is hoisted into the entry chunk and the landing page pays for the
          // whole scoring engine.
          scoring: ['@gayatama/scoring'],
        },
      },
    },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
