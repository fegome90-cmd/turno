import original from '../candidate/prototypes/frontend-v6/playwright.config.ts';
const root = '/tmp/turno-macpro-jEERF9Kq';
export default {
  ...original,
  testDir: root + '/candidate/prototypes/frontend-v6/tests/e2e',
  outputDir: process.env.QA_OUTPUT_DIR || root + '/test-results',
  reporter: [['list'], ['json', {outputFile: process.env.QA_JSON_FILE || root + '/logs/e2e.json'}]],
  webServer: {...original.webServer, cwd: root + '/candidate/prototypes/frontend-v6'},
  projects: original.projects?.map(project => ({...project, use: {...project.use, launchOptions: {...project.use?.launchOptions, executablePath: "/Users/felipe_gonzalez/Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"}}})),
};
