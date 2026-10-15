import test from 'node:test';
import assert from 'node:assert/strict';
import {bandEnergyDb, snapRows, rowsFromTimings, toMono, HOP} from '../../app/lyric-sync/snap.js';
import {parseTimings} from '../../app/lyric-timings.js';

const SR = 16000;
// A made-up song: a steady two-note pad (the "music") and voice-like bursts (four partials with a soft attack and release) at known times.
function song(seconds, bursts, {pad = 0.02, voice = 0.03, silentUntil = 0} = {}) {
  const x = new Float32Array(Math.round(seconds * SR));
  for (let i = Math.round(silentUntil * SR); i < x.length; i++) {
    const t = i / SR;
    let v = pad * (Math.sin(2 * Math.PI * 110 * t) + Math.sin(2 * Math.PI * 165 * t));
    for (const [a, b] of bursts) {
      if (t < a - 0.05 || t > b + 0.15) continue;
      const env = Math.min(1, Math.max(0, (t - a) / 0.04 + 0.5)) * Math.min(1, Math.max(0, (b - t) / 0.12 + 0.5));
      for (const f of [330, 660, 1320, 2200]) v += voice * env * Math.sin(2 * Math.PI * f * t);
    }
    x[i] = v;
  }
  return x;
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} is not within ${tol} of ${b}`);

test('the voice band is measured: a 1 kHz tone is far louder than a 50 Hz one of the same size', () => {
  const tone = f => Float32Array.from({length: SR * 2}, (_, i) => 0.1 * Math.sin(2 * Math.PI * f * i / SR));
  const hi = bandEnergyDb(tone(1000), SR), lo = bandEnergyDb(tone(50), SR);
  assert.equal(hi.length, Math.floor(SR * 2 / (SR * HOP)) - 1);
  assert.ok(hi[10] - lo[10] > 20, `${hi[10]} vs ${lo[10]}`);
  assert.equal(bandEnergyDb(new Float32Array(SR), SR)[3] < -100, true, 'digital silence is far below anything audible');
});

test('toMono averages the channels', () => {
  const m = toMono([Float32Array.of(1, 0), Float32Array.of(0, 1)]);
  assert.deepEqual([...m], [0.5, 0.5]);
  const one = Float32Array.of(3);
  assert.equal(toMono([one]), one);
});

test('rough times that run 0.8 s early are moved to where the voice comes in, and the ends follow', () => {
  const truth = [[2, 4.5], [7, 9.5], [12, 15], [20, 23]];
  const db = bandEnergyDb(song(30, truth), SR);
  const rough = truth.map(([s, e], i) => ({t: 'line' + i, s: s - 0.8, e: e - 0.8, exact: false}));
  const r = snapRows(rough, db, {lead: 0.5});
  assert.equal(r.clear, 4);
  assert.equal(r.weak, 0);
  r.rows.forEach((row, i) => {
    near(row.s, truth[i][0], 0.15, 'start ' + i);
    near(row.e, truth[i][1], 0.3, 'end ' + i);
    assert.equal(row.exact, true);
    assert.equal(row.t, 'line' + i, 'the text is untouched');
  });
});

test('times that are already about right stay about right with lead 0', () => {
  const truth = [[2, 4.5], [7, 9.5], [12, 15]];
  const db = bandEnergyDb(song(20, truth), SR);
  const r = snapRows(truth.map(([s, e], i) => ({t: 'l' + i, s: s + 0.15, e})), db, {lead: 0});
  r.rows.forEach((row, i) => near(row.s, truth[i][0], 0.15, 'start ' + i));
});

test('a line with no rise near its time keeps the rough time plus the typical move, and is marked as a guess', () => {
  const truth = [[2, 4.5], [7, 9.5], [12, 15]];
  const db = bandEnergyDb(song(30, truth), SR);
  const rough = [...truth.map(([s, e], i) => ({t: 'l' + i, s: s - 0.8, e: e - 0.8})), {t: 'quiet', s: 26, e: 28}];
  const r = snapRows(rough, db, {lead: 0.5});
  assert.deepEqual(r.rows.map(x => x.exact), [true, true, true, false]);
  assert.equal(r.weak, 1);
  near(r.rows[3].s, 26.8, 0.3, 'moved like the others');
});

test('a rise out of digital silence is the recording starting, not a voice', () => {
  const db = bandEnergyDb(song(12, [[6, 8]], {silentUntil: 1}), SR);
  const r = snapRows([{t: 'a', s: 0.5, e: 3}, {t: 'b', s: 5.2, e: 7}], db, {lead: 0.5});
  assert.equal(r.rows[0].exact, false);
  assert.equal(r.rows[1].exact, true);
  near(r.rows[1].s, 6, 0.15, 'the second line');
});

test('rows stay in order, never overlap, and a too-short audio changes nothing but the flag', () => {
  const db = bandEnergyDb(song(20, [[2, 4], [4.4, 6], [8, 10]]), SR);
  const r = snapRows([{t: 'a', s: 1.9, e: 3.9}, {t: 'b', s: 4.3, e: 5.9}, {t: 'c', s: 7.9, e: 9.9}], db, {lead: 0});
  for (let i = 0; i < r.rows.length; i++) {
    assert.ok(r.rows[i].e >= r.rows[i].s + 0.3 - 1e-9);
    if (i) { assert.ok(r.rows[i].s >= r.rows[i - 1].s + 0.3 - 1e-9); assert.ok(r.rows[i - 1].e <= r.rows[i].s + 1e-9); }
  }
  const tiny = snapRows([{t: 'a', s: 1, e: 2}], new Float32Array(5));
  assert.deepEqual([tiny.rows[0].s, tiny.rows[0].exact, tiny.weak], [1, false, 1]);
});

test('an SRT becomes rows with ends, and an LRC gets the next start as the end', () => {
  const srt = rowsFromTimings(parseTimings('1\n00:00:01,500 --> 00:00:04,200\nあ\n\n2\n00:00:05,000 --> 00:00:08,250\nい/う\n', 'a.srt'));
  assert.deepEqual(srt.map(r => [r.s, r.e, r.t, r.exact]), [[1.5, 4.2, 'あ', false], [5, 8.25, 'い/う', false]]);
  const lrc = rowsFromTimings(parseTimings('[00:02.00]あ\n[00:05.50]い\n', 'a.lrc'));
  assert.deepEqual(lrc.map(r => [r.s, r.e]), [[2, 5.5], [5.5, 9.5]]);
});
