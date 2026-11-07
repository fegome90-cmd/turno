import {MOTION} from './motion.mjs';

// A small, persistent expanded stack for the standalone demo, not Sonner.
// No domain state, auto-dismiss deadline, network request or animation dependency.
export function createToasts({root, matchMedia, getModality, restoreFocus}) {
  const doc = root.ownerDocument, win = doc.defaultView;
  const list = root.querySelector('.toast-list');
  const region = root.querySelector('.toast-region');
  const live = root.querySelector('#live'), alert = root.querySelector('#live-error');
  const records = new Map();
  const reduced = matchMedia?.('(prefers-reduced-motion: reduce)');
  let serial = 0, frame = null, suspended = false, pendingAnnouncement = null;
  root.style.setProperty('--toast-duration', `${MOTION.toast}ms`);
  root.style.setProperty('--toast-easing', MOTION.easing);
  const canAnimate = () => !suspended && getModality() === 'pointer' && !reduced?.matches && typeof win.requestAnimationFrame === 'function';
  const active = () => [...records.values()].filter(record => !record.closing);
  const refresh = () => {
    region.hidden = !records.size;
    root.querySelector('.toast-count').textContent = String(active().length);
    root.querySelector('[data-toast-clear]').disabled = !active().length;
  };
  function announce(record) {
    if (suspended) { pendingAnnouncement = record; return; }
    const target = record.kind === 'error' ? alert : live;
    const other = record.kind === 'error' ? live : alert;
    other.textContent = '';
    target.textContent = record.message + (record.count > 1 ? ` Repetido ${record.count} veces.` : '');
  }
  function cancelFrame() {
    if (frame !== null) win.cancelAnimationFrame?.(frame);
    frame = null;
  }
  // Capture painted positions (including an interrupted transform) once, then
  // measure the new layout once. No per-frame measuring or height animation.
  function reflow(change, animate = canAnimate()) {
    cancelFrame();
    const before = new Map(animate ? [...records.values()].map(r => [r.item, r.item.getBoundingClientRect().top]) : []);
    for (const record of records.values()) {
      record.item.style.transition = 'none';
      record.item.style.transform = 'none';
    }
    change();
    refresh();
    if (!animate) return;
    const moved = [];
    for (const record of records.values()) {
      if (!before.has(record.item)) continue;
      const delta = before.get(record.item) - record.item.getBoundingClientRect().top;
      if (Math.abs(delta) < .5) continue;
      moved.push({item: record.item, delta});
    }
    if (!moved.length) return;
    for (const {item, delta} of moved) item.style.transform = `translateY(${delta}px)`;
    void list.offsetHeight;
    frame = win.requestAnimationFrame(() => {
      frame = null;
      for (const {item} of moved) {
        item.style.removeProperty('transition');
        item.style.transform = 'none';
      }
    });
  }
  function remove(record) {
    clearTimeout(record.timer);
    records.delete(record.key);
    record.item.remove();
    if (pendingAnnouncement === record) pendingAnnouncement = null;
  }
  function settle() {
    reflow(() => {
      for (const record of [...records.values()]) if (record.closing) remove(record);
    }, false);
  }
  function dismiss(record) {
    if (!record || record.closing) return;
    if (record.item.contains(doc.activeElement)) {
      const remaining = active().filter(r => r !== record);
      const index = active().indexOf(record);
      const next = remaining[Math.min(index, remaining.length - 1)];
      if (next) next.button.focus(); else restoreFocus();
    }
    record.closing = true;
    record.item.setAttribute('inert', '');
    record.item.setAttribute('aria-hidden', 'true');
    record.card.dataset.closing = 'true';
    if (!canAnimate()) reflow(() => remove(record), false);
    else record.timer = setTimeout(() => reflow(() => remove(record)), MOTION.toast);
    const announced = record.message + (record.count > 1 ? ` Repetido ${record.count} veces.` : '');
    for (const target of [live, alert]) if (target.textContent === announced || !active().length) target.textContent = '';
    refresh();
  }
  function notify(message, kind = 'status') {
    message = String(message);
    if (!message.trim()) return;
    kind = kind === 'error' ? 'error' : 'status';
    const key = `${kind}:${message}`;
    let record = records.get(key);
    const keepScroll = list.contains(doc.activeElement) || list.scrollHeight - list.scrollTop - list.clientHeight > 8;
    const scrollTop = list.scrollTop;
    const preserveReadingPosition = () => { list.scrollTop = keepScroll ? scrollTop : list.scrollHeight; };
    if (record) {
      reflow(() => {
        clearTimeout(record.timer);
        record.closing = false;
        record.item.removeAttribute('inert');
        record.item.removeAttribute('aria-hidden');
        delete record.card.dataset.closing;
        record.count++;
        record.repeat.textContent = `Repetido ${record.count} veces`;
        record.repeat.hidden = false;
        preserveReadingPosition();
      });
    } else {
      const item = doc.createElement('li');
      item.className = 'toast-item';
      item.dataset.toastId = String(++serial);
      // Static markup only. Message text is never interpreted as HTML.
      item.innerHTML = '<div class="toast-card"><div class="toast-content"><p class="toast-label"></p><p class="toast-message"></p><p class="toast-repeat" hidden></p></div><button type="button" class="toast-close" aria-label="Cerrar aviso">×</button></div>';
      const card = item.querySelector('.toast-card');
      card.dataset.kind = kind;
      item.querySelector('.toast-label').textContent = kind === 'error' ? 'No se pudo completar' : 'Demostración';
      const text = item.querySelector('.toast-message');
      text.id = `toast-message-${serial}`;
      text.textContent = message;
      const button = item.querySelector('button');
      button.setAttribute('aria-describedby', text.id);
      record = {key, item, card, button, message, kind, count: 1, closing: false, repeat: item.querySelector('.toast-repeat')};
      // Include scrolling in the layout mutation, so FLIP uses the final viewport
      // position rather than snapping after the measurement.
      reflow(() => { records.set(key, record); list.append(item); preserveReadingPosition(); });
    }
    announce(record);
    return record.item.dataset.toastId;
  }
  function clear() {
    const hadFocus = root.contains(doc.activeElement);
    reflow(() => { for (const record of [...records.values()]) remove(record); }, false);
    live.textContent = alert.textContent = '';
    if (hadFocus) restoreFocus();
  }
  function setSuspended(value) {
    suspended = Boolean(value);
    root.toggleAttribute('data-suspended', suspended);
    region.toggleAttribute('inert', suspended);
    if (suspended) region.setAttribute('aria-hidden', 'true'); else region.removeAttribute('aria-hidden');
    if (suspended) settle();
    refresh();
    if (!suspended && pendingAnnouncement) {
      const record = pendingAnnouncement; pendingAnnouncement = null;
      if (records.has(record.key)) announce(record);
    }
  }
  root.addEventListener('click', event => {
    if (event.target.closest('[data-toast-clear]')) { clear(); return; }
    const button = event.target.closest('.toast-close');
    if (button) dismiss([...records.values()].find(r => r.button === button));
  });
  doc.addEventListener('keydown', event => {
    settle();
    if (suspended || event.defaultPrevented || event.isComposing) return;
    if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.key.toLowerCase() === 't' && active().length) {
      event.preventDefault(); active().at(-1).button.focus();
    } else if (event.key === 'Escape' && root.contains(doc.activeElement)) {
      event.preventDefault();
      dismiss(active().find(r => r.item.contains(doc.activeElement)));
    }
  });
  reduced?.addEventListener?.('change', () => { if (reduced.matches) settle(); });
  refresh();
  return {notify, clear, settle, setSuspended};
}
