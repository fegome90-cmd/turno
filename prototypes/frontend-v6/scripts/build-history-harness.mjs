// Separate technical artifact: production dist/preview.html is not replaced by this fixture.
import {build} from 'vite';

await build({
  configFile: 'vite.config.ts',
  build: {outDir: 'dist-history', rollupOptions: {input: 'history-harness.html'}},
});
