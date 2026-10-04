import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanFx, concealAmount, mixFx, pictureWeight, swapCurve } from '../../app/fx-mix.js';

const KEYS = ['blur', 'bloom', 'neon', 'glass', 'chroma', 'glitch', 'scan', 'grain', 'vignette', 'bokeh'];
const global = { blur: 0, bloom: .3, neon: .1, glass: 0, chroma: 0, glitch: .5, scan: 0, grain: .2, vignette: 0, bokeh: 0 };
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-12, `${a} vs ${b}`);

test('without any override of a picture the result is exactly what it was before pictures could have their own look', () => {
  for (const env of [0, .17, .5, 1]) for (const u of [0, .3, .5, .9, 1]) for (const trFx of [null, undefined, { neon: .9 }, { glitch: 0, bloom: 1 }]) {
    const got = mixFx(KEYS, { global, from: null, to: u ? {} : null, trFx, u, env });
    for (const k of KEYS) assert.equal(got[k], global[k] + ((trFx?.[k] ?? global[k]) - global[k]) * env, `${k} env=${env} u=${u}`);
  }
});

test('a picture that is only shown (no change running) has its own look, and the global one for what it does not set', () => {
  const got = mixFx(KEYS, { global, from: { neon: .8, glitch: 0 } });
  assert.equal(got.neon, .8);
  assert.equal(got.glitch, 0);
  assert.equal(got.bloom, global.bloom);
  assert.equal(got.grain, global.grain);
});

test('across a ◆ the look goes from the first picture to the next one', () => {
  const from = { neon: .8 }, to = { neon: .2 };
  const at = u => mixFx(KEYS, { global, from, to, u, env: 0 }).neon;
  assert.equal(at(0), .8);
  assert.equal(at(1), .2);
  close(at(.5), .5);
  assert.ok(at(.4) > at(.5) && at(.5) > at(.6), 'steadily from one to the other');
  assert.equal(at(.1), .8, 'nothing changes while the first picture is still there');
  assert.equal(at(.9), .2);
});

test('one picture with its own look next to one without: the other side is the global look', () => {
  const got = mixFx(KEYS, { global, from: { neon: 1 }, to: {}, u: 1, env: 0 });
  assert.equal(got.neon, global.neon);
});

test("the ◆'s own settings take over while it breaks up or is solid, whatever the pictures say", () => {
  const got = mixFx(KEYS, { global, from: { neon: .8 }, to: { neon: .2 }, trFx: { neon: .55 }, u: .5, env: 1 });
  assert.equal(got.neon, .55);
  close(mixFx(KEYS, { global, from: { neon: .8 }, to: { neon: .2 }, trFx: { neon: .55 }, u: .5, env: .5 }).neon, .5 * .5 + .5 * .55);
});

test("what the ◆ does not set stays what the pictures say", () => {
  const got = mixFx(KEYS, { global, from: { glitch: .9 }, to: { glitch: .9 }, trFx: { neon: 1 }, u: .5, env: 1 });
  assert.equal(got.glitch, .9);
  assert.equal(got.neon, 1);
});

test('pictureWeight goes from 0 to 1 smoothly around the middle', () => {
  assert.equal(pictureWeight(0), 0);
  assert.equal(pictureWeight(.35), 0);
  assert.equal(pictureWeight(1), 1);
  assert.equal(pictureWeight(.65), 1);
  close(pictureWeight(.5), .5);
});

test('cleanFx keeps only known settings with real numbers between 0 and 1', () => {
  assert.deepEqual(cleanFx({ neon: .5, bloom: 2, glitch: -1, scan: '0.5', grain: NaN, vignette: Infinity, bokeh: null, nope: 1, __proto__: { evil: 1 } }, KEYS), { neon: .5, bloom: 1, glitch: 0 });
  assert.equal(cleanFx({}, KEYS), undefined);
  assert.equal(cleanFx({ nope: 1 }, KEYS), undefined);
  for (const odd of [undefined, null, 5, 'x', true, [], [1, 2], () => 1]) assert.equal(cleanFx(odd, KEYS), undefined);
});

test('cleanFx gives a fresh object (the file is not kept)', () => {
  const raw = { neon: .5 };
  const out = cleanFx(raw, KEYS);
  assert.notEqual(out, raw);
  raw.neon = .9;
  assert.equal(out.neon, .5);
});

test('concealAmount: the picture is mixed up while it breaks, unless this ◆ says not to (and only a real false says so)', () => {
  assert.equal(concealAmount(null, .7), .7);
  assert.equal(concealAmount(undefined, .7), .7);
  assert.equal(concealAmount({}, .7), .7);
  assert.equal(concealAmount({ mixTiles: true }, .7), .7);
  assert.equal(concealAmount({ mixTiles: false }, .7), 0);
  for (const odd of ['false', 0, null, 'no', []]) assert.equal(concealAmount({ mixTiles: odd }, .7), .7, String(odd));
  assert.equal(concealAmount({ mixTiles: false }, 0), 0);
});

test('swapCurve: the next picture arrives in the middle of the solid, unless this ◆ says it should wait until the solid has come apart', () => {
  const normal = u => Math.min(1, Math.max(0, (u - .46) / .08));          // stands in for the usual curve (any value is passed through)
  for (const tr of [null, undefined, {}, { lateSwap: false }, { lateSwap: 'true' }, { lateSwap: 1 }]) assert.equal(swapCurve(tr, .5, .37), .37, JSON.stringify(tr));
  const late = u => swapCurve({ lateSwap: true }, u, normal(u));
  assert.equal(late(0), 0);
  assert.equal(late(.5), 0, 'still the first picture while the solid is there');
  assert.equal(late(.6), 0);
  assert.equal(late(.72), 0);
  assert.equal(late(.8), 1);
  assert.equal(late(1), 1);
  assert.ok(late(.76) > 0 && late(.76) < 1);
  let last = 0;
  for (let u = 0; u <= 1.0001; u += .02) { const v = late(u); assert.ok(v >= last - 1e-12, `not going back at ${u}`); last = v; }
});

test('mixFx follows the picture swap: when the ◆ keeps the solid the first picture (late), the look moves to the next picture only after the solid has come apart', () => {
  const from = { bloom: .6 }, to = {};
  const at = (u, late) => mixFx(KEYS, { global, from, to, u, env: 0, late }).bloom;
  assert.ok(at(.5, false) < .6 && at(.5, false) > global.bloom, 'usual: halfway through the ◆ the look is in between');
  assert.equal(at(.5, true), .6, 'still the first picture\'s look while the solid is there');
  assert.equal(at(.7, true), .6);
  assert.equal(at(.8, true), global.bloom, 'the next picture\'s look once it has taken over');
  assert.equal(at(1, true), global.bloom);
  assert.ok(at(.76, true) < .6 && at(.76, true) > global.bloom);
  // without `late` nothing changed
  for (const u of [0, .2, .5, .9, 1]) assert.equal(at(u, undefined), at(u, false));
});
