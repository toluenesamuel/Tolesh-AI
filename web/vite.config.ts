import { defineConfig } from 'vite';

// Dev server proxies /api to the Tolesh backend so the browser never needs a
// second origin; production build is static and pairs with the API server.
export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
