import test from 'node:test';
import assert from 'node:assert/strict';
import { TRIAL, median, judgeTrial, judgeFrames, describeTrialPass } from '../../app/method-trial.js';

test('the limits are the ones in the design', () => {
  assert.equal(TRIAL.factor, 4);
  assert.deepEqual(TRIAL.progresses, [0, .25, .5, .75, 1]);
  assert.equal(TRIAL.runs, 3);
});

test('median', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([7]), 7);
});

test('too heavy means more than 4x the baseline AND above the floor', () => {
  assert.deepEqual(judgeTrial({ customMs: 5, baselineMs: 1, floorMs: 1 }), { ratio: 5, heavy: true });
  assert.equal(judgeTrial({ customMs: 4, baselineMs: 1, floorMs: 1 }).heavy, false, 'exactly 4x is allowed');
  assert.equal(judgeTrial({ customMs: .8, baselineMs: .1, floorMs: 1 }).heavy, false, 'tiny numbers are noise: under the floor');
  assert.equal(judgeTrial({ customMs: 9, baselineMs: 1, floorMs: 1, factor: 10 }).heavy, false, 'the factor can be changed');
});

test('a baseline too small to measure still gives an answer', () => {
  const r = judgeTrial({ customMs: 3, baselineMs: 0, floorMs: 1 });
  assert.equal(r.heavy, true);
  assert.equal(r.ratio, null);
  assert.equal(judgeTrial({ customMs: .5, baselineMs: 0, floorMs: 1 }).heavy, false);
});

const frame = (fill, size = 12) => Uint8Array.from({ length: size * 4 }, (_, i) => (i % 4 === 3 ? 255 : fill));
const picture = seed => Uint8Array.from({ length: 48 }, (_, i) => (i % 4 === 3 ? 255 : (i * seed) % 200 + 20));

// restMiddle / restEnd: the same frames drawn by a method that does nothing (so the shading is the same): "unchanged" means looking like those
test('blank: the picture is gone halfway through', () => {
  const rest = frame(10), nothing = frame(10);
  assert.deepEqual(judgeFrames({ start: rest, middle: nothing, end: nothing, restMiddle: picture(7), restEnd: picture(7) }), { blank: true, unchanged: false });
});

test('unchanged: it looks just like doing nothing', () => {
  const a = picture(7);
  assert.deepEqual(judgeFrames({ start: a, middle: a, end: a, restMiddle: a, restEnd: a }), { blank: false, unchanged: true });
});

test('shading that changes while it breaks is not a change of the picture', () => {
  const start = picture(7), dimmed = picture(7).map((v, i) => (i % 4 === 3 ? v : Math.round(v * .94)));
  assert.equal(judgeFrames({ start, middle: dimmed, end: dimmed, restMiddle: dimmed, restEnd: dimmed }).unchanged, true);
});

test('a method that moves things is neither blank nor unchanged', () => {
  assert.deepEqual(judgeFrames({ start: picture(7), middle: picture(11), end: picture(13), restMiddle: picture(7), restEnd: picture(7) }), { blank: false, unchanged: false });
});

test('changing only at the end still counts as changing', () => {
  const a = picture(7);
  assert.equal(judgeFrames({ start: a, middle: a, end: picture(11), restMiddle: a, restEnd: a }).unchanged, false);
});

test('a pass says how heavy it is, and why it passes even when that is more than 4x', () => {
  assert.equal(describeTrialPass({ ratio: 1.2, customMs: .3 }), '標準の重いメソッドの約1.2倍');
  assert.equal(describeTrialPass({ ratio: 4, customMs: .3 }), '標準の重いメソッドの約4.0倍');
  assert.equal(describeTrialPass({ ratio: 11.3, customMs: .4 }), '標準の重いメソッドの約11.3倍。ただ、1回の描画が約0.4ミリ秒と軽いので問題なし');
  assert.match(describeTrialPass({ ratio: 20, customMs: .03 }), /0\.1ミリ秒未満/);
  assert.equal(describeTrialPass({ ratio: null, customMs: .2 }), 'ごく軽い');
});
