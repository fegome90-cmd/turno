import original from './source/prototypes/frontend-v6/playwright.config.ts';
const root = '/Users/felipe/turno-2b-qa-4f88fca-20261109/v3';
export default {
 ...original,
 testDir: root + '/source/prototypes/frontend-v6/tests/e2e',
 outputDir: process.env.QA_OUTPUT_DIR || root + '/test-results',
 reporter: [['list'], ['json', {outputFile: process.env.QA_JSON_FILE || root + '/logs/e2e.json'}]],
 webServer: {...original.webServer, cwd: root + '/source/prototypes/frontend-v6'},
 projects: original.projects?.map(project => ({...project, use: {...project.use, launchOptions: {...project.use?.launchOptions, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}}})),
};
