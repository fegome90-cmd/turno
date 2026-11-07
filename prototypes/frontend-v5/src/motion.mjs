// Motion is optional: domain state, focus and native visibility never wait for it.
export const MOTION = Object.freeze({
  screen: 300,
  dialog: 300,
  drawer: 340,
  disclosure: 220,
  tabs: 180,
  feedback: 180,
  easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
  indicatorEasing: 'cubic-bezier(0.77, 0, 0.175, 1)',
});

export function createMotion(matchMedia) {
  const reduced = matchMedia?.('(prefers-reduced-motion: reduce)');
  const running = new Map();
  const cancel = element => {
    const animation = running.get(element);
    running.delete(element);
    animation?.cancel();
  };
  const cancelAll = () => {
    for (const element of [...running.keys()]) cancel(element);
  };
  const cancelWithin = root => {
    for (const element of [...running.keys()]) {
      if (element === root || root?.contains(element)) cancel(element);
    }
  };
  reduced?.addEventListener?.('change', () => {
    if (reduced.matches) cancelAll();
  });

  function animate(element, frames, duration, modality, easing = MOTION.easing) {
    if (!element) return;
    // A repeated notification retargets from its painted state, not its entrance origin.
    // This is a one-time style read at interruption, never a per-frame layout loop.
    const current = running.has(element)
      ? element.ownerDocument?.defaultView?.getComputedStyle?.(element)
      : null;
    if (current) frames = [Object.fromEntries(Object.entries(frames[0]).map(([key, value]) =>
      [key, current[key] || value]
    )), ...frames.slice(1)];
    cancel(element);
    if (modality !== 'pointer' || reduced?.matches || typeof element.animate !== 'function') return;
    const animation = element.animate(frames, {duration, easing, fill: 'none'});
    running.set(element, animation);
    animation.finished?.catch(() => {}).finally(() => {
      if (running.get(element) === animation) running.delete(element);
    });
  }

  function enter(element, kind = 'screen', modality = 'keyboard') {
    const drawer = kind === 'drawer', dialog = kind === 'dialog';
    const start = drawer
      ? {opacity: .82, transform: element?.classList?.contains('navigation-drawer') ? 'translateX(-12px)' : 'translateX(12px)'}
      : {opacity: dialog ? .88 : .76, transform: dialog ? 'translateY(8px) scale(.985)' : 'translateY(5px)'};
    animate(element, [start, {opacity: 1, transform: 'none'}], MOTION[kind] || MOTION.screen, modality);
  }

  function syncDisclosure(details) {
    const open = details.hasAttribute('open');
    const summary = details.querySelector('summary');
    const content = details.querySelector('.property-content');
    if (summary?.getAttribute('aria-expanded') !== String(open)) cancelWithin(details);
    if (!open && content?.contains(details.ownerDocument.activeElement)) summary?.focus();
    summary?.setAttribute('aria-expanded', String(open));
    if (content) {
      content.toggleAttribute('inert', !open);
      content.setAttribute('aria-hidden', String(!open));
    }
  }

  function disclosure(details, open, modality = 'keyboard') {
    if (!details) return;
    const content = details.querySelector('.property-content');
    const summary = details.querySelector('summary');
    const chevron = summary?.querySelector('.disclosure-chevron');
    const wasOpen = details.hasAttribute('open');
    // Read the current painted rotation before cancelling an interrupted transition.
    const transform = chevron?.ownerDocument?.defaultView?.getComputedStyle?.(chevron)?.transform;
    if (!open && content?.contains(details.ownerDocument.activeElement)) summary?.focus();
    cancelWithin(details);
    details.toggleAttribute('open', open);
    syncDisclosure(details);
    if (wasOpen === open) return;
    // Deliberate fallback: native layout changes immediately. Only opening content
    // reveals; closing never leaves invisible interactive controls or fake height.
    if (open) animate(content, [{opacity: .7, transform: 'translateY(-3px)'}, {opacity: 1, transform: 'none'}], MOTION.disclosure, modality);
    animate(chevron, [
      {transform: transform && transform !== 'none' ? transform : `rotate(${wasOpen ? 180 : 0}deg)`},
      {transform: `rotate(${open ? 180 : 0}deg)`},
    ], MOTION.disclosure, modality);
  }

  function tabIndicator(element, previousRect, modality = 'keyboard') {
    if (!element || !previousRect) return;
    const next = element.getBoundingClientRect?.();
    if (!next || !next.width || !previousRect.width) return;
    const delta = previousRect.left - next.left;
    if (Math.abs(delta) < .5 && Math.abs(previousRect.width - next.width) < .5) return;
    animate(element, [
      {transform: `translateX(${delta}px) scaleX(${previousRect.width / next.width})`},
      {transform: 'none'},
    ], MOTION.tabs, modality, MOTION.indicatorEasing);
  }

  return {enter, disclosure, syncDisclosure, tabIndicator, cancelAll, cancelWithin};
}
