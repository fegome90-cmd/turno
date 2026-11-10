import {test} from 'node:test';
import assert from 'node:assert/strict';
import {HOME_SUBTITLES, chooseHomeSubtitle} from '../src/home-subtitle.mjs';

test('home subtitle catalogue has four independent short messages without name interpolation', () => {
  assert.deepEqual(HOME_SUBTITLES, [
    '¿Qué haremos hoy?', '¿Por dónde empezamos?', '¿Qué tienes en mente?', '¿En qué te ayudo hoy?',
  ]);
  assert.ok(Object.isFrozen(HOME_SUBTITLES));
  assert.ok(HOME_SUBTITLES.every(text => !text.includes('Demo') && !text.includes('<')));
});
test('injected random deterministically reaches each subtitle and is sampled only once', () => {
  for (let index = 0; index < HOME_SUBTITLES.length; index++) {
    let calls = 0;
    const result = chooseHomeSubtitle(() => {calls++; return (index + .5) / HOME_SUBTITLES.length;});
    assert.equal(result, HOME_SUBTITLES[index]);assert.equal(calls, 1);
  }
});
test('out-of-range or invalid random samples cannot produce an undefined subtitle', () => {
  assert.equal(chooseHomeSubtitle(() => -1), HOME_SUBTITLES[0]);
  assert.equal(chooseHomeSubtitle(() => 1), HOME_SUBTITLES.at(-1));
  assert.equal(chooseHomeSubtitle(() => Number.NaN), HOME_SUBTITLES[0]);
});
