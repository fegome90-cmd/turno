import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {viteSingleFile} from 'vite-plugin-singlefile';

// Single HTML artifact: the only entry is preview.html, so the build output is dist/preview.html.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  server: {host: '127.0.0.1', port: 4176, strictPort: true},
  preview: {host: '127.0.0.1', port: 4176, strictPort: true},
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: {input: 'preview.html'},
  },
});
