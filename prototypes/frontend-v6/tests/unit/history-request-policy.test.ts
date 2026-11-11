import {describe, expect, it} from 'vitest';
import {allowHistoryHarnessRequest} from '../e2e/support/history-request-policy';

const file = 'file:///Users/demo/turno/dist-history/history-harness.html';
const http = 'http://127.0.0.1:4182/history-harness.html';

describe('G2B · offline request policy for the browser test', () => {
  it('permits the exact local file document intercepted by Chromium', () => {
    expect(allowHistoryHarnessRequest(file, file)).toBe(true);
  });
  it('rejects other local files instead of allowing the entire file protocol', () => {
    expect(allowHistoryHarnessRequest('file:///Users/demo/unrelated.html', file)).toBe(false);
    expect(allowHistoryHarnessRequest(`${file}.other`, file)).toBe(false);
  });
  it('permits HTTP only on the document server origin', () => {
    expect(allowHistoryHarnessRequest(http, http)).toBe(true);
    expect(allowHistoryHarnessRequest('http://127.0.0.1:4182/favicon.ico', http)).toBe(true);
    expect(allowHistoryHarnessRequest('http://127.0.0.1:9999/other.html', http)).toBe(false);
    expect(allowHistoryHarnessRequest(http, file)).toBe(false);
  });
  it('rejects same-origin blob URLs rather than treating their inherited origin as HTTP', () => {
    expect(allowHistoryHarnessRequest('blob:http://127.0.0.1:4182/id', http)).toBe(false);
  });
  it.each([file, http])('blocks external requests when the document is %s', (document) => {
    for (const url of ['https://example.invalid/script.js', 'http://127.0.0.1.evil.invalid:4182/', 'https://127.0.0.1:4182/', 'data:text/html,external', 'blob:https://example.invalid/id', 'not a URL']) {
      expect(allowHistoryHarnessRequest(url, document), url).toBe(false);
    }
  });
});
