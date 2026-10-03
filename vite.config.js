import { defineConfig } from 'vite';

// Relative base so the same build works on the web (PWA), inside Electron (file://)
// and inside the Capacitor Android WebView.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1500,
  },
});
