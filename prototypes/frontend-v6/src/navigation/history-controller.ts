import type {Route} from '../domain/types';

export type HistoryPort = {
  readonly state: unknown;
  replaceState(data: unknown, unused: string): void;
  pushState(data: unknown, unused: string): void;
  go(delta: number): void;
};
export type HistoryOptions = {
  history: HistoryPort;
  subscribePopState(listener: (state: unknown) => void): () => void;
  readRoute(): Route;
  applyRoute(route: Route): void;
  guardNavigation(target: Route, resume: () => void): 'allow' | 'blocked' | 'pending';
  setTitle(route: Route): void;
};
export type HistoryController = {
  start(): void;
  push(route: Route): void;
  // Consumers must call this synchronously on every new draft or title edit.
  cancelPending(): void;
  dispose(): void;
};

type Entry = Route & {idx: number; __turnoHistory: string};
type Pending = {id: number; route: Route; target: Entry | null; decided: boolean; approved: boolean};
const copyRoute = (route: Route): Route => ({view: route.view, archiveId: route.archiveId, selected: route.selected ? {...route.selected} : null});
const sameRoute = (a: Route, b: Route) => a.view === b.view && a.archiveId === b.archiveId
  && a.selected?.kind === b.selected?.kind && a.selected?.id === b.selected?.id;

function validRoute(value: unknown): value is Route {
  if (!value || typeof value !== 'object') return false;
  const r = value as Partial<Route>;
  return ['home', 'workspace', 'notes', 'archive'].includes(r.view ?? '')
    && (r.archiveId === null || typeof r.archiveId === 'string')
    && (r.selected === null || (!!r.selected && ['task', 'note'].includes(r.selected.kind) && typeof r.selected.id === 'string'));
}

// This is an ownership namespace, not a credential. Crypto separates browser lifetimes;
// the monotonic suffix also separates instances/segments when entropy is unavailable or repeated.
let ownerSequence = 0n;
function newHistoryOwner(previous: unknown): string {
  let entropy = 'local';
  try {
    const crypto = globalThis.crypto;
    try {if (typeof crypto?.randomUUID === 'function') entropy = crypto.randomUUID();} catch { /* Try the other public crypto API below. */ }
    if (entropy === 'local' && typeof crypto?.getRandomValues === 'function') {
      entropy = Array.from(crypto.getRandomValues(new Uint32Array(4)), (value) => value.toString(16).padStart(8, '0')).join('');
    }
  } catch { /* Restricted/absent crypto must not prevent in-memory navigation. */ }
  let existing: unknown = null;
  try {if (previous && typeof previous === 'object') existing = (previous as Partial<Entry>).__turnoHistory;} catch { /* Host-owned state may expose inaccessible properties. */ }
  let owner: string;
  do {owner = `turno-v6-${Date.now().toString(36)}-${(++ownerSequence).toString(36)}-${entropy}`;} while (owner === existing);
  return owner;
}

// No window/document access here. The browser adapter and the guard are separate authorities.
export function createHistoryController(options: HistoryOptions): HistoryController {
  const {history, readRoute, applyRoute, guardNavigation, setTitle} = options;
  const newOwner = () => {
    let previous: unknown;
    try {previous = history.state;} catch { /* An unavailable history has no readable owner to avoid. */ }
    return newHistoryOwner(previous);
  };
  let owner = newOwner();
  let initialized = false;
  let unsubscribe: (() => void) | null = null;
  let current: Entry | null = null;
  let revision = 0;
  let pending: Pending | null = null;
  let returning: Entry | null = null;
  let replay: Entry | null = null;
  let replayCancelled = false;
  let queuedPush: Route | null = null;

  const owned = (value: unknown): value is Entry => validRoute(value)
    && (value as Entry).__turnoHistory === owner && Number.isSafeInteger((value as Entry).idx) && (value as Entry).idx >= 0;
  const invalidate = () => { revision++; pending = null; replay = null; replayCancelled = false; };
  const readState = (): unknown => { try { return history.state; } catch { return null; } };
  const apply = (route: Route) => {
    applyRoute(copyRoute(route));
    // readRoute may normalize a missing selection; the title describes what the application actually shows.
    setTitle(copyRoute(readRoute()));
  };
  const traverse = (delta: number) => {
    try { history.go(delta); return true; }
    catch { returning = null; replay = null; pending = null; current = null; return false; }
  };
  const commitPush = (route: Route) => {
    // After crossing an unindexed boundary, start a new owned segment. Old indices are no longer comparable.
    if (!current) owner = newOwner();
    const entry: Entry = {...copyRoute(route), idx: (current?.idx ?? -1) + 1, __turnoHistory: owner};
    try { history.pushState(entry, ''); current = entry; }
    catch { current = null; } // Sandboxed/absent history must not make in-memory navigation unusable.
    apply(route);
  };
  const continuePending = () => {
    const next = pending;
    if (!unsubscribe || !next || next.id !== revision || !next.decided || !next.approved || returning) return;
    pending = null;
    if (next.target && current) {
      replay = next.target;
      traverse(next.target.idx - current.idx);
    } else if (next.target) {
      current = next.target;
      apply(next.route);
    } else commitPush(next.route);
  };
  const request = (route: Route, target: Entry | null) => {
    invalidate();
    const next: Pending = {id: revision, route: copyRoute(route), target, decided: false, approved: false};
    pending = next;
    const result = guardNavigation(copyRoute(route), () => {
      if (!unsubscribe || pending !== next || next.id !== revision) return;
      next.approved = true;
      continuePending();
    });
    // A guard is allowed to synchronously cause a newer intent or dispose the controller.
    if (pending !== next || !unsubscribe) return;
    next.decided = true;
    if (result === 'allow') {
      pending = null;
      if (target) { current = target; apply(route); } else commitPush(route);
      return;
    }
    if (result === 'blocked') pending = null;
    if (target && current && target.idx !== current.idx) {
      returning = current;
      traverse(current.idx - target.idx);
    }
    continuePending();
  };
  const onPopState = (state: unknown) => {
    // A queued popstate can arrive after another traversal has already changed the actual entry.
    // It must never apply an old route over a newer intent or alter the logical source index.
    const actual = readState();
    if (owned(actual)) {
      if (!owned(state) || actual.idx !== state.idx || !sameRoute(actual, state)) return;
    } else if (owned(state)) return;
    if (!owned(state)) {
      // Never fabricate an index, replace a foreign entry, or push a compensating route.
      invalidate(); returning = null; queuedPush = null; current = null;
      return;
    }
    const target: Entry = {...copyRoute(state), idx: state.idx, __turnoHistory: owner};
    if (returning && target.idx === returning.idx) {
      current = target;
      returning = null;
      if (queuedPush) {
        const route = queuedPush; queuedPush = null;
        if (sameRoute(readRoute(), route)) setTitle(copyRoute(readRoute()));
        else request(route, null);
      }
      else continuePending();
      return;
    }
    returning = null;
    if (replay && target.idx === replay.idx) {
      // A newer intent cancels the replay, not its in-flight browser event. Return to the source
      // before branching so the original source entry and its Forward stack stay consistent.
      if ((queuedPush || replayCancelled) && current) {
        replay = null; replayCancelled = false; returning = current; traverse(current.idx - target.idx); return;
      }
      replay = null; current = target; apply(target); return;
    }
    if (current && target.idx === current.idx) {
      // An opposite traversal can supersede a replay before its event is delivered. Reaching
      // the visible source settles that replay, even when its destination event was stale.
      const route = queuedPush; queuedPush = null; invalidate();
      if (route && !sameRoute(readRoute(), route)) request(route, null);
      return;
    }
    queuedPush = null;
    request(target, target);
  };

  return {
    start() {
      if (unsubscribe) return;
      unsubscribe = options.subscribePopState(onPopState);
      if (!initialized) {
        initialized = true;
        const route = copyRoute(readRoute());
        current = {...route, idx: 0, __turnoHistory: owner};
        try {
          const previous = readState();
          history.replaceState({...previous && typeof previous === 'object' ? previous : {}, ...current}, '');
        }
        catch { current = null; }
        setTitle(copyRoute(route));
      } else {
        const state = readState();
        if (owned(state)) {
          // Traversal can finish while an effect is detached. Reconcile once on reattach.
          current = {...copyRoute(state), idx: state.idx, __turnoHistory: owner};
          if (!sameRoute(readRoute(), current)) apply(current);
        } else current = null;
      }
    },
    push(route) {
      if (!unsubscribe) return;
      const next = copyRoute(route);
      const inFlightReplay = replay;
      invalidate();
      replay = inFlightReplay;
      if (returning || replay) { queuedPush = next; return; }
      const actual = readState();
      if (current && owned(actual) && actual.idx !== current.idx) {
        queuedPush = next; returning = current; traverse(current.idx - actual.idx); return;
      }
      if (!owned(actual)) current = null;
      if (sameRoute(readRoute(), next)) { setTitle(copyRoute(readRoute())); return; }
      request(next, null);
    },
    cancelPending() {
      if (!unsubscribe) return;
      // Draft authority belongs to the consumer. Every new edit revokes the previous
      // decision, including a replay already handed to the browser, without branching.
      const inFlightReplay = replay;
      invalidate(); queuedPush = null;
      replay = inFlightReplay; replayCancelled = !!inFlightReplay;
      if (returning || replay) return;
      const actual = readState();
      if (current && owned(actual) && actual.idx !== current.idx) {
        returning = current; traverse(current.idx - actual.idx);
      }
    },
    dispose() {
      unsubscribe?.(); unsubscribe = null;
      invalidate(); returning = null; queuedPush = null;
    },
  };
}
