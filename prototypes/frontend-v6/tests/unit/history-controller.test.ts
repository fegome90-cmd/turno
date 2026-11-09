import {describe, expect, it} from 'vitest';
import {createHistoryController, type HistoryOptions, type HistoryPort} from '../../src/navigation/history-controller';
import type {Route} from '../../src/domain/types';

const home: Route = {view: 'home', selected: null, archiveId: null};
const task = (id = 'task-1'): Route => ({view: 'workspace', selected: {kind: 'task', id}, archiveId: null});

// Asynchronous traversal: go() changes the stack, popstate is dispatched separately like the browser.
function stack(initial: unknown = null) {
  const entries: unknown[] = [initial];
  let index = 0;
  const listeners = new Set<(state: unknown) => void>();
  const events: unknown[] = [];
  const calls: {kind: string; delta?: number}[] = [];
  const move = (delta: number) => {
    const next = index + delta;
    if (next < 0 || next >= entries.length) return;
    index = next;
    events.push(entries[index]);
  };
  const history: HistoryPort = {
    get state() { return entries[index]; },
    replaceState(data) { calls.push({kind: 'replace'}); entries[index] = structuredClone(data); },
    pushState(data) { calls.push({kind: 'push'}); entries.splice(index + 1); entries.push(structuredClone(data)); index++; },
    go(delta) { calls.push({kind: 'go', delta}); move(delta); },
  };
  return {
    history, entries, calls, listeners,
    get index() { return index; },
    subscribe(listener: (state: unknown) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    move,
    flushOne() { const state = events.shift(); for (const listener of listeners) listener(state); },
    flush() { let n = 0; while (events.length) { if (++n > 50) throw new Error('history loop'); const state = events.shift(); for (const listener of listeners) listener(state); } },
  };
}

function setup(initial?: unknown) {
  const browser = stack(initial);
  let route = structuredClone(home);
  const applied: Route[] = [];
  const titles: string[] = [];
  let guard: HistoryOptions['guardNavigation'] = () => 'allow';
  let resume = () => {};
  const controller = createHistoryController({
    history: browser.history,
    subscribePopState: (listener) => browser.subscribe(listener),
    readRoute: () => route,
    applyRoute: (next) => { route = next; applied.push(next); },
    guardNavigation: (target, next) => { resume = next; return guard(target, next); },
    setTitle: (next) => titles.push(next.view === 'home' ? 'Inicio · Turno' : `${next.selected?.id} · Turno`),
  });
  return {
    ...browser, browser, controller, applied, titles,
    get route() { return route; },
    guard(value: HistoryOptions['guardNavigation']) { guard = value; },
    resume() { resume(); },
    getResume() { return resume; },
  };
}

function threeEntries() {
  const ctx = setup();
  ctx.controller.start();
  ctx.controller.push(task());
  ctx.controller.push(task('task-2'));
  ctx.browser.move(-1); ctx.browser.flush();
  return ctx;
}

describe('G2B · indexed history contract (technical harness, not product parity)', () => {
  it('initial load replaces once, never pushes, keeps foreign state and synchronizes the title', () => {
    const ctx = setup({hostKey: 'preserved'});
    ctx.controller.start(); ctx.controller.start();
    expect(ctx.browser.calls).toEqual([{kind: 'replace'}]);
    expect(ctx.browser.history.state).toMatchObject({hostKey: 'preserved', idx: 0, view: 'home'});
    expect(ctx.titles).toEqual(['Inicio · Turno']);
    expect(ctx.browser.listeners.size).toBe(1);
  });

  it('one push per distinct route; repeated render does not push; kind is part of selection identity', () => {
    const ctx = setup(); ctx.controller.start();
    ctx.controller.push(task()); ctx.controller.push(task());
    ctx.controller.push({view: 'notes', selected: {kind: 'note', id: 'task-1'}, archiveId: null});
    expect(ctx.browser.entries).toHaveLength(3);
    expect(ctx.browser.history.state).toMatchObject({idx: 2});
    expect(ctx.route.selected?.kind).toBe('note');
    expect(ctx.titles.at(-1)).toBe('task-1 · Turno');
  });

  it('Back and Forward restore Home and the exact task without pushing or changing URL', () => {
    const ctx = setup(); ctx.controller.start(); ctx.controller.push(task('task-2'));
    ctx.browser.move(-1); ctx.browser.flush();
    expect(ctx.route).toEqual(home); expect(ctx.titles.at(-1)).toBe('Inicio · Turno');
    ctx.browser.move(1); ctx.browser.flush();
    expect(ctx.route).toEqual(task('task-2'));
    expect(ctx.browser.calls.filter((call) => call.kind === 'push')).toHaveLength(1);
  });

  it.each(['overlay', 'busy'])('%s blocks Back, closes at the guard, and preserves all Forward entries', () => {
    const ctx = threeEntries();
    let blocks = 0;
    ctx.guard(() => { blocks++; return 'blocked'; });
    ctx.browser.move(-1); ctx.browser.flush();
    expect(blocks).toBe(1); expect(ctx.browser.index).toBe(1);
    expect(ctx.route).toEqual(task()); expect(ctx.browser.entries).toHaveLength(3);
    ctx.guard(() => 'allow'); ctx.browser.move(1); ctx.browser.flush();
    expect(ctx.route).toEqual(task('task-2'));
    expect(ctx.browser.calls.filter((call) => call.kind === 'push')).toHaveLength(2);
  });

  it.each([-1, 1])('cancel then discard repeats original direction %i once, without losing Forward', (direction) => {
    const ctx = threeEntries(); ctx.guard(() => 'pending');
    ctx.browser.move(direction); ctx.browser.flush();
    expect(ctx.route).toEqual(task()); expect(ctx.browser.index).toBe(1);
    // Cancel belongs to the guard: dropping its callback has no navigation side effect.
    const cancelled = ctx.applied.length;
    expect(ctx.applied).toHaveLength(cancelled);
    ctx.browser.move(direction); ctx.browser.flush();
    ctx.resume(); ctx.resume(); ctx.browser.flush();
    expect(ctx.route).toEqual(direction === -1 ? home : task('task-2'));
    expect(ctx.browser.index).toBe(1 + direction); expect(ctx.browser.entries).toHaveLength(3);
    expect(ctx.browser.calls.filter((call) => call.kind === 'push')).toHaveLength(2);
  });

  it('save-and-continue may resolve before restoration popstate and still replays only once', () => {
    const ctx = threeEntries(); ctx.guard(() => 'pending');
    ctx.browser.move(-1);
    // Dispatch the user event only, leaving the return trip queued.
    // flush also handles the queued return; a synchronous resume exercises the earlier boundary.
    ctx.guard((_target, resume) => { resume(); resume(); return 'pending'; });
    ctx.browser.flush();
    expect(ctx.route).toEqual(home); expect(ctx.browser.index).toBe(0);
    expect(ctx.applied.filter((item) => item.view === 'home')).toHaveLength(1);
  });

  it('failed save does not resume: current view, draft owner and title remain untouched', () => {
    const ctx = threeEntries(); ctx.guard(() => 'pending');
    const before = ctx.applied.length; const title = ctx.titles.at(-1);
    ctx.browser.move(-1); ctx.browser.flush();
    expect(ctx.applied).toHaveLength(before); expect(ctx.route).toEqual(task());
    expect(ctx.titles.at(-1)).toBe(title); expect(ctx.browser.index).toBe(1);
  });

  it('a newer navigation invalidates the old guard response; it cannot change selection or title', () => {
    const ctx = threeEntries(); ctx.guard(() => 'pending');
    ctx.browser.move(-1); ctx.browser.flush();
    const oldResume = ctx.getResume();
    ctx.guard(() => 'allow'); ctx.controller.push(task('task-new'));
    oldResume(); ctx.browser.flush();
    expect(ctx.route).toEqual(task('task-new'));
    expect(ctx.titles.at(-1)).toBe('task-new · Turno');
  });

  it('push is protected too; a pending approved route is copied and applied once', () => {
    const ctx = setup(); ctx.controller.start(); ctx.guard(() => 'pending');
    const destination = task(); ctx.controller.push(destination);
    destination.selected!.id = 'mutated-outside';
    expect(ctx.route).toEqual(home); ctx.resume(); ctx.resume();
    expect(ctx.route).toEqual(task()); expect(ctx.browser.entries).toHaveLength(2);
  });

  it('route values passed out of the controller cannot mutate a stored history entry', () => {
    const ctx = setup(); ctx.controller.start(); ctx.controller.push(task());
    ctx.route.selected!.id = 'changed-by-consumer';
    expect(ctx.browser.history.state).toMatchObject({selected: {id: 'task-1'}});
  });

  it('foreign entries without idx or with another owner are not replaced, bounced or applied', () => {
    const ctx = setup(); ctx.controller.start(); ctx.controller.push(task());
    const own = ctx.browser.entries[1];
    ctx.browser.history.pushState({view: 'home', selected: null, archiveId: null, idx: 0}, '');
    ctx.browser.history.pushState({host: 'outside'}, '');
    ctx.browser.move(-1); ctx.browser.flush();
    expect(ctx.route).toEqual(task()); expect(ctx.browser.index).toBe(2);
    expect(ctx.browser.entries[1]).toEqual(own);
    expect(ctx.browser.calls.filter((call) => call.kind === 'go')).toHaveLength(0);
  });

  it('multi-entry traversal replays the original delta, not a single Back', () => {
    const ctx = setup(); ctx.controller.start(); ctx.controller.push(task()); ctx.controller.push(task('task-2'));
    ctx.guard(() => 'pending'); ctx.browser.move(-2); ctx.browser.flush();
    expect(ctx.browser.index).toBe(2); ctx.resume(); ctx.browser.flush();
    expect(ctx.route).toEqual(home); expect(ctx.browser.index).toBe(0);
  });

  it('a click during the return trip waits for restoration and supersedes the old pending intent', () => {
    const ctx = threeEntries();
    let oldResume = () => {};
    ctx.guard((_target, resume) => {
      oldResume = resume;
      // A follow-up intent arrives while the browser is still completing its return trip.
      return 'pending';
    });
    // Process the original traversal and pause before the restoration event.
    ctx.browser.move(-1);
    ctx.browser.flushOne();
    ctx.guard(() => 'allow'); ctx.controller.push(task('newer'));
    oldResume(); ctx.browser.flush();
    expect(ctx.route).toEqual(task('newer'));
    expect(ctx.browser.history.state).toMatchObject({selected: {id: 'newer'}});
  });

  it('a same-route click during compensation is a no-op and retains the existing Forward entry', () => {
    const ctx = threeEntries(); ctx.guard(() => 'blocked');
    ctx.browser.move(-1); ctx.browser.flushOne();
    ctx.guard(() => 'allow'); ctx.controller.push(task()); ctx.browser.flush();
    expect(ctx.browser.index).toBe(1); expect(ctx.browser.entries).toHaveLength(3);
    expect(ctx.browser.calls.filter((call) => call.kind === 'push')).toHaveLength(2);
    ctx.browser.move(1); ctx.browser.flush();
    expect(ctx.route).toEqual(task('task-2'));
  });

  it.each([-1, 1])('a newer push during approved replay %i cannot be overwritten by its late popstate', (direction) => {
    const ctx = threeEntries(); ctx.guard(() => 'pending');
    ctx.browser.move(direction); ctx.browser.flush(); ctx.resume();
    ctx.guard(() => 'allow'); ctx.controller.push(task('newer')); ctx.browser.flush();
    expect(ctx.route).toEqual(task('newer'));
    expect(ctx.browser.history.state).toMatchObject({selected: {id: 'newer'}, idx: 2});
    expect(ctx.titles.at(-1)).toBe('newer · Turno');
    ctx.browser.move(-1); ctx.browser.flush();
    expect(ctx.route).toEqual(task());
  });

  it('same-route intent during approved replay cancels that replay and preserves Forward', () => {
    const ctx = threeEntries(); ctx.guard(() => 'pending');
    ctx.browser.move(-1); ctx.browser.flush(); ctx.resume();
    ctx.guard(() => 'allow'); ctx.controller.push(task()); ctx.browser.flush();
    expect(ctx.route).toEqual(task()); expect(ctx.browser.index).toBe(1);
    expect(ctx.browser.entries).toHaveLength(3);
    ctx.browser.move(1); ctx.browser.flush(); expect(ctx.route).toEqual(task('task-2'));
  });

  it.each([-1, 1])('newer push before user popstate %i is delivered restores the source before branching', (direction) => {
    const ctx = threeEntries(); ctx.browser.move(direction);
    ctx.controller.push(task('newer')); ctx.browser.flush();
    expect(ctx.route).toEqual(task('newer'));
    expect(ctx.browser.history.state).toMatchObject({selected: {id: 'newer'}, idx: 2});
    expect(ctx.titles.at(-1)).toBe('newer · Turno');
    ctx.browser.move(-1); ctx.browser.flush(); expect(ctx.route).toEqual(task());
  });

  it('after a foreign boundary, new navigation uses a fresh owned segment, not reused indices', () => {
    const ctx = setup(); ctx.controller.start(); ctx.controller.push(task());
    const old = ctx.browser.history.state as {__turnoHistory: string};
    ctx.browser.history.pushState({host: 'one'}, ''); ctx.browser.history.pushState({host: 'two'}, '');
    ctx.browser.move(-1); ctx.browser.flush();
    ctx.controller.push(task('new-segment'));
    expect((ctx.browser.history.state as {__turnoHistory: string}).__turnoHistory).not.toBe(old.__turnoHistory);
    ctx.browser.move(-2); ctx.browser.flush();
    expect(ctx.route).toEqual(task('new-segment'));
    expect(ctx.browser.calls.filter((call) => call.kind === 'go')).toHaveLength(0);
  });

  it('reattach on a foreign entry forgets the detached segment before a new push', () => {
    const ctx = setup(); ctx.controller.start(); ctx.controller.push(task());
    const old = ctx.browser.history.state as {__turnoHistory: string};
    ctx.controller.dispose();
    ctx.browser.history.pushState({host: 'detached'}, '');
    ctx.controller.start(); ctx.controller.push(task('after-reattach'));
    expect(ctx.browser.history.state).toMatchObject({idx: 0});
    expect((ctx.browser.history.state as {__turnoHistory: string}).__turnoHistory).not.toBe(old.__turnoHistory);
    ctx.browser.move(-2); ctx.browser.flush();
    expect(ctx.route).toEqual(task('after-reattach'));
    expect(ctx.browser.calls.filter((call) => call.kind === 'go')).toHaveLength(0);
  });

  it('unavailable history writes do not crash in-memory navigation', () => {
    let route = home;
    const controller = createHistoryController({
      history: {get state(): unknown { throw new Error('sandboxed'); }, pushState() { throw new Error('sandboxed'); }, replaceState() { throw new Error('sandboxed'); }, go() { throw new Error('sandboxed'); }},
      subscribePopState: () => () => {}, readRoute: () => route,
      applyRoute(next) { route = next; }, guardNavigation: () => 'allow', setTitle() {},
    });
    expect(() => controller.start()).not.toThrow();
    expect(() => controller.push(task())).not.toThrow();
    expect(route).toEqual(task()); controller.dispose();
    expect(() => controller.start()).not.toThrow(); controller.dispose();
  });

  it('EXTRA-LIFECYCLE-ASYNC · 20 start/dispose cycles and effect reattach have one listener, one replace and stale resumes are inert', () => {
    const ctx = setup();
    for (let i = 0; i < 20; i++) {
      ctx.controller.start(); ctx.controller.start(); expect(ctx.browser.listeners.size).toBe(1);
      ctx.controller.dispose(); ctx.controller.dispose(); expect(ctx.browser.listeners.size).toBe(0);
    }
    expect(ctx.browser.calls.filter((call) => call.kind === 'replace')).toHaveLength(1);
    ctx.controller.start(); ctx.guard(() => 'pending'); ctx.controller.push(task());
    ctx.controller.dispose(); ctx.resume(); ctx.browser.flush();
    expect(ctx.route).toEqual(home); expect(ctx.browser.entries).toHaveLength(1);
  });
});
