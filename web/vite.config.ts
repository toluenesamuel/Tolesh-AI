import { defineConfig } from 'vite';

// Dev server proxies /api to the Tolesh backend so the browser never needs a
// second origin; production build is static and pairs with the API server.
export default defineConfig({
  server: {
    port: 5173,
    // Dev-only: allow the sandbox preview host (*.e2b.app) and localhost.
    // Vite's host check does not affect the production build.
    allowedHosts: ['.e2b.app', 'localhost', '127.0.0.1'],
    proxy: {
      '/api': {
        // Override with TOLESH_API for tests that run the server on another port.
        target: process.env.TOLESH_API ?? 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
