import {useEffect, useLayoutEffect, useState} from 'react';
import {createHistoryController, type HistoryController, type HistoryOptions} from './history-controller';

function createBinding(options: HistoryOptions) {
  let latest = options;
  const controller = createHistoryController({
    history: options.history,
    subscribePopState: options.subscribePopState,
    readRoute: () => latest.readRoute(),
    applyRoute: (route) => latest.applyRoute(route),
    guardNavigation: (target, resume) => latest.guardNavigation(target, resume),
    setTitle: (route) => latest.setTitle(route),
  });
  return {controller, update(next: HistoryOptions) { latest = next; }};
}

export function useHistory(options: HistoryOptions): HistoryController {
  // Initialization has no external side effects, so StrictMode may safely evaluate it twice.
  // Transport is fixed for a mount; callbacks follow the latest committed render.
  const [binding] = useState(() => createBinding(options));
  useLayoutEffect(() => { binding.update(options); });
  const {controller} = binding;
  useEffect(() => { controller.start(); return () => controller.dispose(); }, [controller]);
  useLayoutEffect(() => { options.setTitle(options.readRoute()); });
  return controller;
}
