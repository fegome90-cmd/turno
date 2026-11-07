import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {createMotion, MOTION} from '../src/motion.mjs';
import {localDate, nextCalendarDate, groupAgenda} from '../src/format.mjs';

function disclosureFixture({reduced = false, api = true} = {}) {
  const {document, window} = parseHTML('<details class="property"><summary aria-controls="content"><span class="disclosure-chevron"></span></summary><div class="property-content" id="content"><input></div></details>');
  const details = document.querySelector('details');
  const content = document.querySelector('.property-content');
  const summary = document.querySelector('summary');
  const chevron = document.querySelector('.disclosure-chevron');
  const calls = [], animations = [];
  let onChange, focused = null;
  Object.defineProperty(document, 'activeElement', {get: () => focused});
  summary.focus = () => {focused = summary;};
  const query = {matches: reduced, addEventListener(type, callback) {onChange = callback;}};
  if (api) for (const node of [content, chevron]) node.animate = (frames, options) => {
    const call = {node, frames, options};
    calls.push(call);
    let resolve;
    const animation = {cancelled: false, finished: new Promise(done => {resolve = done;}), cancel() {this.cancelled = true; resolve();}, finish() {resolve();}};
    animations.push(animation);
    return animation;
  };
  const motion = createMotion(() => query);
  return {document, window, details, content, summary, chevron, calls, animations, motion,
    focusInput() {focused = document.querySelector('input');},
    reduce() {query.matches = true; onChange();},
  };
}

test('disclosure opens native state immediately and reveals only its content', () => {
  const f = disclosureFixture();
  f.motion.disclosure(f.details, true, 'pointer');
  assert.ok(f.details.hasAttribute('open'));
  assert.equal(f.summary.getAttribute('aria-expanded'), 'true');
  assert.equal(f.content.hasAttribute('inert'), false);
  assert.equal(f.content.getAttribute('aria-hidden'), 'false');
  assert.equal(f.calls.length, 2);
  assert.ok(f.calls.every(call => call.options.duration === 220));
  assert.ok(f.calls.every(call => call.options.fill === 'none'));
  assert.ok(f.calls.every(call => call.frames.every(frame => !('height' in frame))));
});

test('disclosure close is instant, inert and restores focus outside hidden controls', () => {
  const f = disclosureFixture();
  f.motion.disclosure(f.details, true, 'pointer');
  f.focusInput();
  f.motion.disclosure(f.details, false, 'pointer');
  assert.equal(f.details.hasAttribute('open'), false);
  assert.equal(f.summary.getAttribute('aria-expanded'), 'false');
  assert.equal(f.content.hasAttribute('inert'), true);
  assert.equal(f.document.activeElement, f.summary);
  assert.ok(f.animations[0].cancelled);
  assert.ok(f.animations[1].cancelled);
  assert.equal(f.calls.length, 3, 'closing animates the chevron only');
});

test('repeated disclosure reversals and cancellation never write visibility or inline styles', () => {
  const f = disclosureFixture();
  for (const open of [true, false, true, false, true]) f.motion.disclosure(f.details, open, 'pointer');
  f.motion.cancelAll();
  assert.ok(f.details.hasAttribute('open'));
  assert.equal(f.content.hasAttribute('inert'), false);
  assert.ok(f.animations.every(animation => animation.cancelled));
  for (const node of [f.details, f.content, f.chevron]) {
    assert.equal(node.hasAttribute('hidden'), false);
    assert.equal(node.getAttribute('style'), null);
  }
});

test('disclosure keyboard, reduced preference and missing WAAPI keep native controls usable', () => {
  for (const options of [{}, {reduced: true}, {api: false}]) {
    const f = disclosureFixture(options);
    f.motion.disclosure(f.details, true, options.reduced || options.api === false ? 'pointer' : 'keyboard');
    assert.equal(f.calls.length, 0);
    assert.ok(f.details.hasAttribute('open'));
    assert.equal(f.content.hasAttribute('inert'), false);
    f.motion.disclosure(f.details, false, 'keyboard');
    assert.ok(f.content.hasAttribute('inert'));
  }
});

test('changing reduced preference cancels disclosure without rolling back intent', () => {
  const f = disclosureFixture();
  f.motion.disclosure(f.details, true, 'pointer');
  f.reduce();
  assert.ok(f.animations.every(animation => animation.cancelled));
  assert.ok(f.details.hasAttribute('open'));
  assert.equal(f.content.hasAttribute('inert'), false);
});

test('retiring a DOM subtree cancels its animations and finished effects leave no styles', async () => {
  const f = disclosureFixture();
  f.motion.disclosure(f.details, true, 'pointer');
  f.motion.cancelWithin(f.details);
  assert.ok(f.animations.every(animation => animation.cancelled));
  f.motion.disclosure(f.details, false, 'keyboard');
  f.motion.disclosure(f.details, true, 'pointer');
  f.animations.at(-1).finish();f.animations.at(-2).finish();
  await Promise.resolve();await Promise.resolve();
  assert.equal(f.content.getAttribute('style'), null);
  assert.ok(f.details.hasAttribute('open'));
});

test('tab marker uses only transform for 180 ms and skips keyboard or unchanged position', () => {
  const calls = [];
  const marker = {getBoundingClientRect: () => ({left: 120, width: 120}), animate(frames, options) {calls.push({frames, options}); return {cancel() {}};}};
  const motion = createMotion();
  motion.tabIndicator(marker, {left: 0, width: 100}, 'pointer');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.duration, MOTION.tabs);
  assert.equal(calls[0].options.easing, MOTION.indicatorEasing);
  assert.deepEqual(Object.keys(calls[0].frames[0]), ['transform']);
  motion.tabIndicator(marker, {left: 0, width: 100}, 'keyboard');
  motion.tabIndicator(marker, {left: 120, width: 120}, 'pointer');
  assert.equal(calls.length, 1);
});

test('civil date is evaluated in Santiago rather than UTC at midnight boundaries', () => {
  assert.equal(localDate(new Date('2026-11-08T01:30:00Z')), '2026-11-07');
  assert.equal(localDate(new Date('2026-11-08T03:30:00Z')), '2026-11-08');
  assert.equal(localDate(new Date('2026-06-08T03:30:00Z')), '2026-06-07');
  assert.equal(localDate(new Date('2026-06-08T04:30:00Z')), '2026-06-08');
});

test('tomorrow calendar arithmetic handles month/year/leap boundaries without 24-hour assumptions', () => {
  assert.equal(nextCalendarDate('2026-12-31'), '2027-01-01');
  assert.equal(nextCalendarDate('2024-02-28'), '2024-02-29');
  assert.equal(nextCalendarDate('2024-02-29'), '2024-03-01');
  assert.equal(nextCalendarDate('2026-09-05'), '2026-09-06');
});

test('agenda groups Hoy, Mañana, later dates and undated tasks without mutating data', () => {
  const tasks = [
    {id: 'undated', date: null, time: '', completed: false},
    {id: 'later', date: '2026-11-10', time: ''},
    {id: 'tomorrow', date: '2026-11-08', time: '10:30'},
    {id: 'today-late', date: '2026-11-07', time: '', completed: true},
    {id: 'today', date: '2026-11-07', time: '09:00'},
  ];
  const snapshot = structuredClone(tasks);
  const groups = groupAgenda(tasks, new Date('2026-11-08T01:30:00Z'));
  assert.deepEqual(groups.map(group => group.label), ['Hoy', 'Mañana', '10/11/2026', 'Sin fecha']);
  assert.deepEqual(groups[0].tasks.map(task => task.id), ['today', 'today-late']);
  assert.equal(groups[0].tasks[1].completed, true);
  assert.deepEqual(tasks, snapshot);
});

test('agenda handles empty and only-undated lists, including empty date strings', () => {
  assert.deepEqual(groupAgenda([]), []);
  const groups = groupAgenda([{date: null}, {date: ''}]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].label, 'Sin fecha');
  assert.equal(groups[0].tasks.length, 2);
});

test('external native close cancels outstanding reveal and returns focus without delaying state', () => {
  const f = disclosureFixture();
  f.motion.disclosure(f.details, true, 'pointer');
  f.focusInput();
  f.details.removeAttribute('open');
  f.motion.syncDisclosure(f.details);
  assert.ok(f.animations.every(animation => animation.cancelled));
  assert.equal(f.document.activeElement, f.summary);
  assert.equal(f.content.hasAttribute('inert'), true);
  assert.equal(f.summary.getAttribute('aria-expanded'), 'false');
});

test('synchronizing own toggle does not cancel its chevron animation', () => {
  const f = disclosureFixture();
  f.motion.disclosure(f.details, true, 'pointer');
  f.motion.syncDisclosure(f.details);
  assert.equal(f.animations.at(-1).cancelled, false);
  f.motion.disclosure(f.details, false, 'pointer');
  f.motion.syncDisclosure(f.details);
  assert.equal(f.animations.at(-1).cancelled, false);
});
