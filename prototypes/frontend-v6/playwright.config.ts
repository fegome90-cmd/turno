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
  use: {
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
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
