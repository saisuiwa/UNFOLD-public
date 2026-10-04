import test from 'node:test';
import assert from 'node:assert/strict';
import { WATCHDOG, createWatchdog } from '../../app/method-watchdog.js';

const feed = (dog, ms, count, custom) => { let verdict = null; for (let i = 0; i < count; i++) verdict = dog.frame(ms, custom) ?? verdict; return verdict; };

test('the limits are the ones in the design', () => {
  assert.equal(WATCHDOG.window, 30);
  assert.equal(WATCHDOG.factor, 4);
  assert.equal(WATCHDOG.floorMs, 50);
});

test('smooth frames with a custom method are fine', () => {
  const dog = createWatchdog();
  assert.equal(feed(dog, 17, 100, true), null);
});

test('30 slow frames with a custom method are a verdict (at the 30th, not before)', () => {
  const dog = createWatchdog();
  assert.equal(feed(dog, 120, 29, true), null);
  const verdict = dog.frame(120, true);
  assert.equal(verdict.median, 120);
  assert.ok(verdict.limit < 120);
});

test('slow but under the floor (50 ms) is fine', () => {
  const dog = createWatchdog();
  assert.equal(feed(dog, 45, 60, true), null);
});

test('the baseline comes from frames without custom methods: a slow screen is allowed to be slow', () => {
  const dog = createWatchdog();
  feed(dog, 40, 12, false);                       // a 25 fps screen: 4 x 40 = 160 ms is the limit
  assert.equal(feed(dog, 120, 40, true), null);
  assert.ok(feed(dog, 200, 30, true));
});

test('the median is used, so a few spikes do not count', () => {
  const dog = createWatchdog();
  for (let i = 0; i < 29; i++) assert.equal(dog.frame(i % 6 === 0 ? 300 : 20, true), null);
  assert.equal(dog.frame(20, true), null);
});

test('a hidden tab (a huge gap) or a nonsense value is ignored', () => {
  const dog = createWatchdog();
  assert.equal(feed(dog, 5000, 100, true), null);
  assert.equal(feed(dog, 0, 100, true), null);
  assert.equal(feed(dog, -3, 100, true), null);
  assert.equal(feed(dog, NaN, 100, true), null);
});

test('after a verdict it starts over (it does not repeat at the next frame)', () => {
  const dog = createWatchdog();
  assert.ok(feed(dog, 150, 30, true));
  assert.equal(dog.frame(150, true), null);
});

test('reset forgets everything', () => {
  const dog = createWatchdog();
  feed(dog, 150, 29, true);
  dog.reset();
  assert.equal(dog.frame(150, true), null);
});
