import {useEffect, useLayoutEffect, useReducer, useState} from 'react';
import {createHistoryController, type HistoryController, type HistoryOptions} from './history-controller';
import type {Route} from '../domain/types';

const copyRoute = (route: Route): Route => ({...route, selected: route.selected ? {...route.selected} : null});
const sameRoute = (a: Route, b: Route) => a.view === b.view && a.archiveId === b.archiveId
  && a.selected?.kind === b.selected?.kind && a.selected?.id === b.selected?.id;

function createBinding(options: HistoryOptions, reconcile: () => void) {
  let latest = options;
  let projected: Route | null = null;
  const controller = createHistoryController({
    history: options.history,
    subscribePopState: options.subscribePopState,
    readRoute: () => projected ?? latest.readRoute(),
    applyRoute: (route) => {
      // setState is batched: another intent in the same event must see the route just
      // applied. A synchronous consumer may already have normalized that selection.
      const before = copyRoute(latest.readRoute());
      latest.applyRoute(route);
      const after = latest.readRoute();
      projected = copyRoute(!sameRoute(before, after) ? after : route);
      // A normalizer may keep the consumer's state unchanged. Still commit this hook so
      // its layout effect reconciles the projection, without forcing a synchronous render.
      reconcile();
    },
    guardNavigation: (target, resume) => latest.guardNavigation(target, resume),
    setTitle: (route) => latest.setTitle(route),
  });
  // The committed consumer remains authoritative, including selection normalization.
  return {controller, update(next: HistoryOptions) { latest = next; projected = null; }};
}

export function useHistory(options: HistoryOptions): HistoryController {
  // Initialization has no external side effects, so StrictMode may safely evaluate it twice.
  // Transport is fixed for a mount; callbacks follow the latest committed render.
  const [, reconcile] = useReducer((revision: number) => revision + 1, 0);
  const [binding] = useState(() => createBinding(options, reconcile));
  useLayoutEffect(() => { binding.update(options); });
  const {controller} = binding;
  useEffect(() => { controller.start(); return () => controller.dispose(); }, [controller]);
  useLayoutEffect(() => { options.setTitle(options.readRoute()); });
  return controller;
}
