import {readFileSync} from 'node:fs';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {createPreviewAdapter} from '../../src/adapters/preview-adapter';

afterEach(() => vi.useRealTimers());
describe('4A delayed product data-boundary fixture', () => {
  it('limits the harness delay to a fixed finite value and mounts the real App without globals', () => {
    const entry = readFileSync('src/harness/layout-main.tsx', 'utf8');
    expect(entry).toContain("fixture === 'product-delayed'");
    expect(entry).toContain('const delay = delayedFixture ? 1500 : 0;');
    expect(entry).toContain('createPreviewAdapter({delay})');
    expect(entry).toContain('<App session={session}/>');
    expect(entry).not.toMatch(/window\.__|globalThis\.__|parseInt\(|Number\(.*searchParams/);
  });

  it('has no fixture backdoor in the normal product entry or bootstrap', () => {
    const source = ['src/main.tsx', 'src/app/bootstrap.tsx'].map((path) => readFileSync(path, 'utf8')).join('\n');
    expect(source).not.toMatch(/fixture|product-delayed|window\.__|globalThis\.__/);
  });

  it('real adapter delay completes load and save after exactly the finite bound', async () => {
    vi.useFakeTimers(); const port = createPreviewAdapter({delay: 1500}); let loaded = false;
    const load = port.load().then((snapshot) => {loaded = true; return snapshot;});
    await vi.advanceTimersByTimeAsync(1499); expect(loaded).toBe(false);
    await vi.advanceTimersByTimeAsync(1); const snapshot = await load; expect(loaded).toBe(true);
    let saved = false; const save = port.saveTask({...snapshot.tasks[0]!, body: 'Finite save'}).then((task) => {saved = true; return task;});
    await vi.advanceTimersByTimeAsync(1499); expect(saved).toBe(false);
    await vi.advanceTimersByTimeAsync(1); expect((await save).body).toBe('Finite save'); expect(saved).toBe(true); expect(vi.getTimerCount()).toBe(0);
  });
});
