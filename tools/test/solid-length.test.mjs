import test from 'node:test';
import assert from 'node:assert/strict';
import {stretchSolid, unstretchSolid} from '../../app/solid-length.js';
import {sequenceCurves, warpTime as seqWarp, SOLID_PTS} from '../../app/sequence-core.js';
import {motionAt, warpTime, chaosTime, exportRange} from '../../app/motion.js';

const steps = n => Array.from({length: n + 1}, (_, i) => i / n);
const wholeFor = (curve, n = 2000) => steps(n).filter(u => curve(u).form > .99).length / (n + 1);
const formingStart = curve => steps(2000).find(u => curve(u).form > .001);
const goneBy = curve => [...steps(2000)].reverse().find(u => curve(u).form > .001);

test('0 % keeps every curve exactly as before (sequence and single clip, with any ぐちゃぐちゃの長さ)', () => {
  for (const hold of [0, .3, .5, 1]) for (const u of steps(200)) {
    assert.deepEqual(sequenceCurves(u, hold, 0), sequenceCurves(u, hold));
    assert.equal(seqWarp(u, hold, 0), seqWarp(u, hold));
    assert.deepEqual(motionAt(u, hold, 0), motionAt(u, hold));
    assert.equal(chaosTime(u, hold, 0), chaosTime(u, hold));
  }
  assert.deepEqual(exportRange('solid', 0, 10, .5, 0), exportRange('solid', 0, 10, .5));
});

test('the stretch is monotonic, keeps its ends, and unstretch undoes it', () => {
  for (const len of [0, .25, .5, 1]) {
    let last = -1;
    for (const w of steps(400)) {
      const v = stretchSolid(w, len, SOLID_PTS);
      assert.ok(v >= last - 1e-12, `monotonic at ${w}`); last = v;
      assert.ok(Math.abs(unstretchSolid(v, len, SOLID_PTS) - w) < 1e-9, `inverse at ${w}`);
    }
    for (const w of [0, SOLID_PTS[0], SOLID_PTS[3], 1]) assert.equal(stretchSolid(w, len, SOLID_PTS), w);
  }
});

test('more 立体の長さ = the whole solid shows longer, while it starts forming and is gone at the same moments', () => {
  for (const hold of [0, .5, 1]) {
    const seq = len => u => sequenceCurves(u, hold, len), one = len => t => motionAt(t, hold, len);
    for (const make of [seq, one]) {
      const w0 = wholeFor(make(0)), w5 = wholeFor(make(.5)), w1 = wholeFor(make(1));
      assert.ok(w5 > w0 * 1.5 && w1 > w5 * 1.3, `hold ${hold}: whole ${w0} -> ${w5} -> ${w1}`);
      assert.ok(Math.abs(formingStart(make(1)) - formingStart(make(0))) < .01, 'forming starts at the same time');
      assert.ok(Math.abs(goneBy(make(1)) - goneBy(make(0))) < .01, 'the solid is gone at the same time');
    }
  }
});

test('the ends of a change stay the flat picture at any length', () => {
  for (const len of [0, .5, 1]) {
    assert.equal(sequenceCurves(0, .5, len).form, 0); assert.equal(sequenceCurves(1, .5, len).form, 0);
    assert.equal(motionAt(0, .5, len).form, 0); assert.equal(motionAt(1, .5, len).form, 0);
  }
});

test('the single clip still finds the middle of the solid (preview jump / export start) with the length set', () => {
  for (const len of [0, .5, 1]) {
    const t = chaosTime(.56, .5, len);
    assert.ok(Math.abs(warpTime(t, .5, len) - .56) < 1e-9);
    assert.ok(motionAt(t, .5, len).form > .99, `form at the preview point (${len})`);
  }
});

test('the turn keeps its own pace with a long solid (it is not crowded into the solid\'s last moments)', () => {
  for (const hold of [0, .5, 1]) for (const len of [.5, 1]) for (const u of steps(200)) {
    assert.equal(sequenceCurves(u, hold, len).spin, sequenceCurves(u, hold, 0).spin, `sequence spin at ${u}`);
    assert.equal(motionAt(u, hold, len).turn, motionAt(u, hold, 0).turn, `single turn at ${u}`);
  }
});
