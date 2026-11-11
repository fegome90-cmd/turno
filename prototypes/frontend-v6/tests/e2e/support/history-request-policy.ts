// Test transport policy, kept outside runtime code.
export function allowHistoryHarnessRequest(requestUrl: string, documentUrl: string): boolean {
  try {
    const request = new URL(requestUrl);
    const document = new URL(documentUrl);
    if (document.protocol === 'file:') return request.href === document.href;
    return document.protocol === 'http:' && request.protocol === 'http:' && document.hostname === '127.0.0.1'
      && request.origin === document.origin && !request.username && !request.password;
  } catch { return false; }
}
