// Dedicated technical artifact, never a second product entry.
import {build} from 'vite';
import react from '@vitejs/plugin-react';
import {viteSingleFile} from 'vite-plugin-singlefile';
await build({configFile: false, plugins: [react(), viteSingleFile()], build: {target: 'esnext', outDir: 'dist-layout', emptyOutDir: true, assetsInlineLimit: 100_000_000, cssCodeSplit: false, modulePreload: false, rollupOptions: {input: 'layout-harness.html'}}});
