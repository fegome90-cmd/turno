import {defineConfig, devices} from '@playwright/test';
import {chromiumLaunchOptions} from './scripts/chromium-launch.ts';

// Full regression runs on Chromium. Firefox/WebKit run only the explicit smoke suite.
// file:// cases read built artifacts; the primitive harness uses the local server below.
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
    // Video stays off; traces and failure screenshots are retained.
    video: 'off',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: chromiumLaunchOptions(),
      },
    },
    {name: 'firefox', testMatch: '**/smoke.spec.ts', use: {...devices['Desktop Firefox']}},
    {name: 'webkit', testMatch: '**/smoke.spec.ts', use: {...devices['Desktop Safari']}},
  ],
});
