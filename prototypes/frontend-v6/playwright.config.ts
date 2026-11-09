import {defineConfig, devices} from '@playwright/test';

// Chromium is the only browser gate of 1A. Firefox/WebKit are not installed and are not gates here.
// The file:// tests open dist/preview.html directly: no dev server or webServer is started.
export default defineConfig({
  testDir: 'tests/e2e',
  workers: 1,
  retries: 0,
  fullyParallel: false,
  reporter: [['list']],
  outputDir: 'test-results',
  // Harness 1B: servidor de desarrollo aparte (solo para tests/e2e/primitive-contract.spec.ts; harness.html no entra en dist).
  webServer: {
    command: 'npx vite --host 127.0.0.1 --port 4177 --strictPort',
    url: 'http://127.0.0.1:4177/harness.html',
    reuseExistingServer: false,
    timeout: 60_000,
  },
  use: {
    baseURL: 'http://127.0.0.1:4177',
    trace: 'retain-on-failure',
    // video desactivado en este entorno: falta /opt/pw-browsers/ffmpeg-1013 y no se instalan navegadores (1B, desviación documentada).
    video: 'off',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {executablePath: '/opt/pw-browsers/chromium'},
      },
    },
  ],
});
