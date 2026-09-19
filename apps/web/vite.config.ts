import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
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
