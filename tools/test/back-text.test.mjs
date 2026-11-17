import test from 'node:test';
import assert from 'node:assert/strict';
import { BACK_DEFAULT, BACK_RANDOM, BACK_TRANS, BACK_MODES, BACK_FILLS, BACK_FONTS, BACK_WHEN, cleanBackText, backWords, backWindow, backSlot, backTransKind, flowShift, backFade, backFontCSS, backDepthAt, backBump, BACK_DEPTH } from '../../app/back-text.js';

const on = patch => cleanBackText({ ...BACK_DEFAULT, enabled: true, ...patch });

test('the settings are cleaned: unknown values fall back, numbers stay in range', () => {
  assert.deepEqual(cleanBackText(), { ...BACK_DEFAULT });
  assert.deepEqual(cleanBackText(null), { ...BACK_DEFAULT });
  const c = cleanBackText({ enabled: 'yes', mode: 'spiral', trans: 'boom', font: 'comic', fill: 'plaid', when: 'never', dir: 'up', hold: 99, speed: -3, size: 0, stretch: 7, y: 2, depth: 'x', backAlpha: 5, color: 'red', back: '#12345', accent: '#ABCDEF', text: 12 });
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

test('ぐるっと囲む: both sides of a ring read left to right, the far side sits behind and smaller, and a turn ends where it began', async () => {
  const { RING_SETS, RING_VIEW, ringPlace, ringTurn } = await import('../../app/back-text.js');
  assert.deepEqual(Object.keys(RING_SETS), ['1', '2', '3']); for (const [n, set] of Object.entries(RING_SETS)) assert.equal(set.length, Number(n));
  const c = cleanBackText({ mode: 'ring', rings: 2.6, ringSize: 9, ringTilt: -1, ringFront: 1, fill: 'dry' });
  assert.deepEqual([c.mode, c.rings, c.ringSize, c.ringTilt, c.ringFront, c.fill], ['ring', 3, 1.3, 0, false, 'dry'], 'the ring settings are cleaned (only true turns the near side on)');
  assert.equal(cleanBackText({ ringFront: true }).ringFront, true);
  const edge = { far: Math.acos(-1 / RING_VIEW), near: Math.acos(1 / RING_VIEW) };   // where a side turns edge on (the outline of the ring as the eye sees it)
  for (const set of Object.values(RING_SETS)) for (const ring of set) {
    for (const near of [false, true]) {
      const mid = ringPlace(0, near, ring, 1), limit = near ? edge.near : edge.far;
      assert.ok(mid.facing > .8 && mid.tx > 0 && mid.uy > 0, `the middle of the ${near ? 'near' : 'far'} side faces the eye, its letters upright and not mirrored`);
      assert.ok(near ? mid.z > 0 && mid.sc > 1 : mid.z < 0 && mid.sc < 1, 'the near side is in front and larger, the far side behind and smaller');
      for (const sign of [-1, 1]) {
        assert.ok(ringPlace(sign * (limit - .25), near, ring, 1).facing > 0, 'still facing the eye a little before the edge');
        assert.ok(ringPlace(sign * (limit + .25), near, ring, 1).facing < 0, 'turned away (mirrored: not drawn) a little past the edge');
      }
      let before = -Infinity;   // a level ring: along the part that faces the eye, the letters go from left to right
      for (let a = -limit + .05; a < limit; a += .1) { const p = ringPlace(a, near, ring, 0); assert.ok(p.x > before && p.facing > 0 && p.tx > 0, `left to right at ${a.toFixed(2)}`); before = p.x; }
    }
    assert.ok(ringPlace(0, false, ring, 1).y > ringPlace(0, true, ring, 1).y, 'leaning towards the eye: the far side is higher than the near side');
    const flat = ringPlace(.6, false, ring, 0); assert.ok(Math.abs(flat.y) < 1e-9 && Math.abs(flat.ty) < 1e-9, 'no tilt = a level ring seen edge on');
  }
  assert.ok(RING_VIEW > 1.5, 'the eye is outside the ring');
  for (const units of [1, 3, 7]) { const total = ringTurn(.2, units, 10, 10), step = 2 * Math.PI / units; assert.ok(Math.abs(total / step - Math.round(total / step)) < 1e-9 && total >= step - 1e-9, `${units} units: a whole number of units`); assert.ok(Math.abs(ringTurn(.2, units, 5, 10) - total / 2) < 1e-9); }
  assert.equal(ringTurn(.2, 0, 5, 10), 0); assert.equal(ringTurn(.2, 3, 5, 0), 0);
});

test('奥行きの動き: the letters go from the far side to the front and back again, or pass in front only in the middle', () => {
  assert.equal(cleanBackText({}).depthMove, 'none'); assert.equal(cleanBackText({ depthMove: 'sideways', depthTrips: 99 }).depthMove, 'none'); assert.equal(cleanBackText({ depthTrips: 99 }).depthTrips, 6);
  assert.equal(backDepthAt(cleanBackText({ mode: 'flow' }), 3, 10), null, 'off: they simply stay behind the person');
  const time = cleanBackText({ mode: 'flow', depthMove: 'time', depthTrips: 2 }), at = u => backDepthAt(time, u * 10, 10);
  assert.ok(Math.abs(at(0).base - BACK_DEPTH.lo) < 1e-9 && Math.abs(at(1).base - BACK_DEPTH.lo) < 1e-9, 'far at the start and at the end (the loop joins)');
  assert.ok(Math.abs(at(.25).base - BACK_DEPTH.hi) < 1e-9 && Math.abs(at(.75).base - BACK_DEPTH.hi) < 1e-9 && Math.abs(at(.5).base - BACK_DEPTH.lo) < 1e-9, 'two trips: in front at 1/4 and 3/4, far again in the middle');
  assert.ok(at(.1).base > at(.05).base && at(.4).base < at(.3).base && at(.3).arch === 0, 'rising, then falling; the same across the picture');
  assert.ok(BACK_DEPTH.lo > 0 && BACK_DEPTH.hi > 1, 'never behind the farthest thing, and all the way in front of the nearest');
  const place = backDepthAt(cleanBackText({ mode: 'wall', depthMove: 'place' }), 7, 10), depthAt = x => place.base + place.arch * backBump(x - place.centre);
  assert.ok(Math.abs(depthAt(0) - BACK_DEPTH.lo) < 1e-9 && Math.abs(depthAt(1) - BACK_DEPTH.lo) < 1e-9 && Math.abs(depthAt(.5) - BACK_DEPTH.hi) < 1e-9, 'by place: far at both ends, in front in the middle');
  assert.deepEqual(place, backDepthAt(cleanBackText({ mode: 'wall', depthMove: 'place' }), 2, 10), 'by place: the same at every moment');
  const left = backDepthAt(cleanBackText({ mode: 'flow', depthMove: 'place', depthPlace: .2 }), 0, 10), leftAt = x => left.base + left.arch * backBump(x - left.centre);
  assert.ok(Math.abs(leftAt(.2) - BACK_DEPTH.hi) < 1e-9 && Math.abs(leftAt(.7) - BACK_DEPTH.lo) < 1e-9 && leftAt(.9) === leftAt(.7) && leftAt(0) > leftAt(.6), 'the place can be moved: in front there, far half a picture away and beyond');
  assert.equal(backDepthAt(cleanBackText({ mode: 'ring', depthMove: 'time' }), 3, 10), null, 'a ring has its own far and near side');
});

test('2026-11-17: the six new motions, the new surfaces and the colour sets are known and kept', async () => {
  const m = await import('../../app/back-text.js');
  for (const mode of ['vflow', 'tape', 'fly', 'wave', 'drop', 'gather']) { assert.ok(m.BACK_MODES[mode], mode); assert.equal(cleanBackText({ mode }).mode, mode); }
  for (const mode of Object.keys(m.BACK_MODES)) assert.ok(m.BACK_WORD_MODES.includes(mode) !== m.BACK_FLOW_MODES.includes(mode), `${mode} is either one word at a time or flowing`);
  for (const fill of ['gradient', 'neon', 'rainbow', 'gold', 'colorful']) { assert.ok(m.BACK_FILLS[fill], fill); assert.equal(cleanBackText({ fill }).fill, fill); }
  assert.equal(cleanBackText().fill, 'solid');
  for (const [id, p] of Object.entries(m.BACK_PALETTES)) {
    for (const k of ['color', 'back', 'accent']) assert.match(p[k], /^#[0-9a-f]{6}$/, `${id}.${k}`);
    assert.equal(m.backPaletteOf(cleanBackText({ color: p.color, back: p.back, accent: p.accent })), id);
  }
  assert.equal(m.backPaletteOf(cleanBackText()), 'cream', 'the first colours are a colour set');
  assert.equal(m.backPaletteOf(cleanBackText({ color: '#123456' })), '', 'colours of your own are not a set');
});

test('the colour helpers: hue turns, brightness, the readable ink, a colour per word', async () => {
  const m = await import('../../app/back-text.js');
  assert.equal(m.hueTurn('#ff0000', 120), '#00ff00'); assert.equal(m.hueTurn('#ff0000', 240), '#0000ff'); assert.equal(m.hueTurn('#ff0000', 360), '#ff0000');
  assert.equal(m.hueTurn('#808080', 90), '#808080', 'a grey has no hue to turn');
  assert.ok(Math.abs(m.luminance('#ffffff') - 1) < 1e-9 && m.luminance('#000000') === 0);
  assert.equal(m.inkOn('#ffd400', '#ffd400', '#111111'), '#111111', 'yellow tape: black letters');
  assert.equal(m.inkOn('#111111', '#ffd400', '#000000'), '#ffd400');
  const s = cleanBackText({ color: '#ffffff', accent: '#ff0000' });
  assert.deepEqual([0, 1, 2, 3, 4, -1].map(i => m.wordColour(s, i)), ['#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffffff', '#0000ff']);
});

test('奥から迫ってくる: words leave one after another, 2–3 in the air, and the clip ends where it began', async () => {
  const m = await import('../../app/back-text.js');
  const s = cleanBackText({ mode: 'fly', text: 'A\nB\nC', hold: .6 }), D = 10;
  const a = m.flyFlights(s, 0, D), b = m.flyFlights(s, D, D);
  assert.deepEqual(a.map(f => [f.k, f.i, +f.u.toFixed(9)]), b.map(f => [f.k, f.i, +f.u.toFixed(9)]), 'the last frame is the first frame (the same words, flying the same way)');
  for (let t = 0; t <= D; t += .37) {
    const fl = m.flyFlights(s, t, D);
    assert.ok(fl.length >= 2 && fl.length <= 3, `${fl.length} words in the air at ${t}`);
    for (let i = 1; i < fl.length; i++) assert.ok(fl[i].u >= fl[i - 1].u, 'far words first');
    for (const f of fl) assert.ok(f.u >= 0 && f.u < 1 && f.i >= 0 && f.i < 3);
  }
  const earlier = m.flyFlights(s, 2, D), later = m.flyFlights(s, 2.03, D); for (const f of earlier) { const g = later.find(x => x.k === f.k); if (g) assert.ok(g.u > f.u, 'each word comes closer'); }
  assert.ok(m.flyLook(0).scale < .2 && m.flyLook(1).scale > 3 && m.flyLook(.5).scale > .6, 'small far away, large close by, already large half way');
  assert.equal(m.flyLook(0).alpha, 0); assert.equal(m.flyLook(1).alpha, 0); assert.equal(m.flyLook(.5).alpha, 1);
  assert.deepEqual(m.flyFlights(cleanBackText({ mode: 'fly', text: '' }), 1, D), []);
  assert.deepEqual(m.flyFlights(s, 1, 0), []);
  const change = cleanBackText({ mode: 'fly', text: 'A', when: 'change' });
  assert.deepEqual(m.flyFlights(change, .1, D), [], 'before the change begins, nothing');
});

test('落ちて積もる・散らばって集まる: each word starts and ends empty, and is whole in the middle', async () => {
  const m = await import('../../app/back-text.js');
  for (const mlen of [1, 4, 9]) for (let j = 0; j < mlen; j++) {
    assert.equal(m.dropPose(j, mlen, 0, 3), null, 'nothing has fallen yet');
    const mid = m.dropPose(j, mlen, .65, 3); assert.ok(mid && Math.abs(mid.dy) < 1e-9 && Math.abs(mid.rot) < 1e-9, `letter ${j} of ${mlen} has landed`);
    const end = m.dropPose(j, mlen, 1, 3); assert.ok(end.dy > 1.2, 'and fallen out at the end');
    const g0 = m.gatherPose(j, mlen, 0, 3); assert.ok(g0 === null || g0.alpha === 0);
    const gm = m.gatherPose(j, mlen, .65, 3); assert.ok(Math.abs(gm.dx) < 1e-9 && Math.abs(gm.dy) < 1e-9 && Math.abs(gm.rot) < 1e-9 && Math.abs(gm.scale - 1) < 1e-9 && gm.alpha === 1, `letter ${j} of ${mlen} is in place`);
    assert.equal(m.gatherPose(j, mlen, 1, 3).alpha, 0, 'and gone at the end');
  }
  const first = m.dropPose(0, 5, .2, 0), last = m.dropPose(4, 5, .2, 0); assert.ok(first && last === null, 'the left letter falls first');
  assert.ok(m.dropPose(2, 5, .3, 0).dy < 0, 'falling from above');
  assert.ok(m.bounceOut(0) === 0 && Math.abs(m.bounceOut(1) - 1) < 1e-9 && m.bounceOut(.8) > .9);
  const slot = m.backSlot(cleanBackText({ text: 'A\nB', hold: 1 }), 2.5, 10); assert.ok(Math.abs(slot.u - .5) < 1e-9, 'the slot says how far into the word it is');
});

test('波打つ: the wave goes round a whole number of times', async () => {
  const m = await import('../../app/back-text.js');
  for (const D of [4, 10, 12.5]) { const p = m.wavePhase(D, D) / (2 * Math.PI); assert.ok(Math.abs(p - Math.round(p)) < 1e-9 && p >= 1, `${D} s`); }
  assert.equal(m.wavePhase(0, 10), 0); assert.equal(m.wavePhase(5, 0), 0);
  assert.equal(m.TAPES.length, 2);
});
