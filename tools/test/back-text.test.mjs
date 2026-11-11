import test from 'node:test';
import assert from 'node:assert/strict';
import { BACK_DEFAULT, BACK_RANDOM, BACK_TRANS, BACK_MODES, BACK_FILLS, BACK_FONTS, BACK_WHEN, cleanBackText, backWords, backWindow, backSlot, backTransKind, flowShift, backFade, backFontCSS } from '../../app/back-text.js';

const on = patch => cleanBackText({ ...BACK_DEFAULT, enabled: true, ...patch });

test('the settings are cleaned: unknown values fall back, numbers stay in range', () => {
  assert.deepEqual(cleanBackText(), { ...BACK_DEFAULT });
  assert.deepEqual(cleanBackText(null), { ...BACK_DEFAULT });
  const c = cleanBackText({ enabled: 'yes', mode: 'spiral', trans: 'boom', font: 'comic', fill: 'gold', when: 'never', dir: 'up', hold: 99, speed: -3, size: 0, stretch: 7, y: 2, depth: 'x', backAlpha: 5, color: 'red', back: '#12345', accent: '#ABCDEF', text: 12 });
  assert.equal(c.enabled, false, 'only true turns it on'); assert.equal(cleanBackText({ still: 1 }).still, false); assert.equal(cleanBackText({ still: true }).still, true);
  assert.deepEqual([c.mode, c.trans, c.font, c.fill, c.when, c.dir], [BACK_DEFAULT.mode, BACK_DEFAULT.trans, BACK_DEFAULT.font, BACK_DEFAULT.fill, BACK_DEFAULT.when, 'left']);
  assert.deepEqual([c.hold, c.speed, c.size, c.stretch, c.y, c.depth, c.backAlpha], [3, .02, .2, 1, .5, 0, 1]);
  assert.deepEqual([c.color, c.back, c.accent], [BACK_DEFAULT.color, BACK_DEFAULT.back, '#abcdef']);
  assert.equal(c.text, BACK_DEFAULT.text, 'a text that is not a string falls back');
  assert.equal(cleanBackText({ text: 'A\u0000B\tC\nD' }).text, 'ABC\nD', 'control characters go, line breaks stay');
  const again = cleanBackText(c); assert.deepEqual(again, c, 'cleaning twice changes nothing');
  for (const table of [BACK_MODES, BACK_TRANS, BACK_FILLS, BACK_WHEN]) for (const [k, label] of Object.entries(table)) assert.ok(k && typeof label === 'string' && label.length > 0);
  for (const f of Object.values(BACK_FONTS)) assert.ok(f.label && f.family && f.weight);
  assert.match(backFontCSS('impact', 64), /^400 64px "Anton"/); assert.equal(backFontCSS('nope', 10), backFontCSS('impact', 10));
});

test('the words: one per line, empty lines dropped, long ones and too many cut', () => {
  assert.deepEqual(backWords('MOVE\n\n  FAST  \r\nUN/FOLD\n'), ['MOVE', 'FAST', 'UN/FOLD']);
  assert.deepEqual(backWords(''), []); assert.deepEqual(backWords(null), []);
  assert.equal(backWords('あ'.repeat(60))[0].length, 40);
  assert.equal([...backWords('😀'.repeat(60))[0]].length, 40, 'cut by letters, not by halves of one');
  assert.equal(backWords(Array.from({ length: 40 }, (_, i) => 'W' + i).join('\n')).length, 24);
});

test('超デカ, ずっと: the words go round whole turns, each change starts a slot, and the end joins the start', () => {
  const s = on({ text: 'A\nB\nC', hold: .8 }), D = 10;
  const first = backSlot(s, 0, D);
  assert.equal(first.count % 3, 0, 'a whole number of turns'); assert.equal(first.count, 12);
  assert.ok(Math.abs(first.len * first.count - D) < 1e-9, 'the slots fill the clip exactly');
  assert.deepEqual([first.k, first.i, first.prev, first.p], [0, 0, 2, 0], 'the first word comes in from the last one');
  const end = backSlot(s, D, D); assert.deepEqual([end.i, end.p], [2, 1], 'the clip ends on the last word, settled');
  for (let k = 0; k < first.count; k++) {
    const mid = backSlot(s, (k + .9) * first.len, D);
    assert.deepEqual([mid.k, mid.i, mid.prev, mid.p], [k, k % 3, (k + 2) % 3, 1], `slot ${k} holds word ${k % 3}`);
    const half = backSlot(s, k * first.len + first.T / 2, D); assert.ok(Math.abs(half.p - .5) < 1e-9 && half.i === k % 3, 'half way through the change');
  }
  assert.ok(first.T <= .5 && first.T <= first.len * .45 + 1e-12, 'a change is shorter than half a slot');
  const many = on({ text: Array.from({ length: 20 }, (_, i) => 'W' + i).join('\n'), hold: 2 }); assert.equal(backSlot(many, 0, D).count, 20, 'every word gets its turn even when that makes them shorter than asked');
  assert.equal(backSlot(on({ text: 'ONE', hold: 1 }), 3.2, D).count, 10);
  assert.equal(backSlot(on({ text: '' }), 1, D), null); assert.equal(backSlot(s, -1, D), null); assert.equal(backSlot(s, 11, D), null); assert.equal(backSlot(s, 1, 0), null); assert.equal(backSlot(s, NaN, D), null);
});

test('超デカ, 絵が変わっている間だけ: comes in from nothing, leaves to nothing, and the ends of the clip stay clear', () => {
  const s = on({ text: 'A\nB', hold: 1, when: 'change' }), D = 10, [a, b] = backWindow('change', D);
  assert.deepEqual([a, b], [D * .08, D * .92]); assert.deepEqual(backWindow('always', D), [0, D]);
  assert.equal(backSlot(s, a - .01, D), null); assert.equal(backSlot(s, b + .01, D), null); assert.equal(backSlot(s, 0, D), null);
  const start = backSlot(s, a, D); assert.deepEqual([start.k, start.i, start.prev, start.p], [0, 0, -1, 0], 'the first word comes from nothing');
  const out = backSlot(s, b - start.T / 2, D); assert.deepEqual([out.i, out.k], [-1, start.count]); assert.ok(Math.abs(out.p - .5) < 1e-9 && out.prev === (start.count - 1) % 2, 'the last word leaves to nothing');
  assert.equal(backSlot(s, b, D).p, 1);
  assert.equal(backFade('change', a, D), 0); assert.equal(backFade('change', b, D), 0); assert.equal(backFade('change', D / 2, D), 1); assert.equal(backFade('always', 0, D), 1);
  assert.ok(backFade('change', a + .2, D) > .4 && backFade('change', a + .2, D) < .6);
});

test('おまかせ goes through every kind without repeating one right after itself; a chosen kind stays', () => {
  const s = on({ trans: 'random' }), n = BACK_RANDOM.length, seen = new Set();
  for (const k of BACK_RANDOM) assert.ok(Object.hasOwn(BACK_TRANS, k) && k !== 'random', k);
  for (let k = 0; k < n; k++) { seen.add(backTransKind(s, k)); assert.notEqual(backTransKind(s, k), backTransKind(s, k + 1), `slots ${k} and ${k + 1}`); }
  assert.equal(seen.size, n, 'all of them within one round');
  assert.equal(backTransKind(on({ trans: 'push' }), 7), 'push');
});

test('the flowing letters end the clip exactly where they began', () => {
  const unit = 730, W = 1920, D = 10;
  assert.equal(flowShift(unit, W, .2, 0, D), 0);
  const total = flowShift(unit, W, .2, D, D);
  assert.ok(Math.abs(total / unit - Math.round(total / unit)) < 1e-9, 'a whole number of units');
  assert.equal(Math.round(total / unit), Math.round(.2 * W * D / unit), 'close to the speed asked for');
  assert.ok(Math.abs(flowShift(unit, W, .2, D / 2, D) - total / 2) < 1e-9, 'at a steady pace');
  assert.equal(flowShift(5000, W, .02, D, D), 5000, 'even the slowest goes round once');
  assert.equal(flowShift(0, W, .2, 5, D), 0); assert.equal(flowShift(unit, W, .2, 5, 0), 0);
});
