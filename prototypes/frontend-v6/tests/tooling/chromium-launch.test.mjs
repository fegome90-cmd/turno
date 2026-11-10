import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {test} from 'node:test';

function chromiumOptions(executablePath) {
  const env = {...process.env};
  delete env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  if (executablePath !== undefined) env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = executablePath;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e',
    'import config from "./playwright.config.ts"; console.log(JSON.stringify(config.projects.find((p) => p.name === "chromium").use.launchOptions ?? {}));'],
  {encoding: 'utf8', env});
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('Chromium uses the installed Playwright browser by default', () => {
  assert.equal(chromiumOptions().executablePath, undefined);
});

test('an explicit Chromium executable override reaches the launch boundary', () => {
  assert.equal(chromiumOptions('/tmp/turno-test-chromium').executablePath, '/tmp/turno-test-chromium');
});
