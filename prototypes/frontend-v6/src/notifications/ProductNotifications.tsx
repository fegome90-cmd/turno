import {useLayoutEffect} from 'react';
import {useStore} from 'zustand';
import type {AppSession} from '../app/create-session';
import {NotificationStack} from './NotificationStack';

// Reuse the session's single notice owner. More options is nonmodal; all other
// transient product layers temporarily own interaction and announcements.
export function ProductNotifications({session}: {session: AppSession}) {
  const layers = useStore(session.store, (state) => state.overlays.layers);
  const suspended = layers.some((layer) => layer.kind !== 'more');
  useLayoutEffect(() => {session.notifications.setSuspended(suspended);}, [session.notifications, suspended]);
  useLayoutEffect(() => () => {session.notifications.setSuspended(false);}, [session.notifications]);
  return <NotificationStack store={session.notifications} onFallbackFocus={() => document.getElementById('main')?.focus()}/>;
}
