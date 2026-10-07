import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TEXT_MOTIONS, cleanMotion, motionAt } from '../../app/lyric-motion.js';

// motionAt exactly as it was before the table existed (2026-10-04). The five first presets must keep these numbers.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), ease = t => 1 - (1 - t) ** 3;
function legacyMotionAt(e, t, bpm = 120) {
  const m = { speed: clamp(Number(e.motion?.speed) || 1, .5, 2), direction: ['left', 'right', 'up', 'down'].includes(e.motion?.direction) ? e.motion.direction : 'up', preset: e.motion.preset };
  const duration = e.end - e.start, p = clamp((t - e.start) / Math.max(.001, duration), 0, 1), span = Math.min(.65 / m.speed, Math.max(.01, duration * .35)), intro = clamp((t - e.start) / span, 0, 1), out = clamp((e.end - t) / span, 0, 1), q = ease(intro);
  const v = { opacity: t < e.start || t >= e.end ? 0 : Math.min(q, out), x: 0, y: 0, scale: 1, reveal: 1, emphasis: 1 };
  if (m.preset === 'float') v.y = (1 - q) * .55;
  if (m.preset === 'slide') { const sign = ['left', 'up'].includes(m.direction) ? -1 : 1; v[['left', 'right'].includes(m.direction) ? 'x' : 'y'] = sign * (1 - q) * 2.5; }
  if (m.preset === 'reveal') v.reveal = clamp((t - e.start) / Math.min(duration * .7, 1.5 / m.speed), 0, 1);
  if (m.preset === 'pop') v.scale = 1 + (1 - intro) * Math.sin(intro * Math.PI * 2.4) * .32;
  if (m.preset === 'emphasis') v.emphasis = 1 + .13 * Math.sin(clamp((t - e.start) * bpm / 60, 0, 1) * Math.PI) * (1 - p);
  return v;
}

const line = (preset, extra = {}, start = 1, end = 7) => ({ start, end, motion: { preset, ...extra } });
const times = (start, end) => [start - 1, start, start + .01, start + .1, start + .3, start + .65, start + 1.5, (start + end) / 2, end - 1, end - .3, end - .01, end, end + 1];

test('the first five presets give exactly the numbers they gave before the table', () => {
  for (const preset of ['float', 'slide', 'reveal', 'pop', 'emphasis']) {
    for (const direction of ['left', 'right', 'up', 'down']) for (const speed of [.5, 1, 2]) for (const [start, end] of [[1, 7], [0, .3], [2, 2.5], [5, 5]]) for (const bpm of [60, 120, 187]) for (const t of times(start, end)) {
      const e = line(preset, { direction, speed }, start, end), now = motionAt(e, t, bpm), before = legacyMotionAt(e, t, bpm), where = `${preset} ${direction} speed ${speed} [${start},${end}] bpm ${bpm} t ${t}`;
      for (const k of Object.keys(before)) {
        // the one difference: a line of length 0 gave NaN for `reveal` (0 / 0) while nothing is drawn (opacity 0); now NaN is ignored and the frame is at rest
        if (Number.isNaN(before[k])) { assert.equal(before.opacity, 0, `${where}: NaN only while hidden`); assert.equal(now[k], 1, `${where}: ${k} at rest`); }
        else assert.equal(now[k], before[k], `${where}: ${k}`);
      }
    }
  }
});

test('every entry has a name, an explanation and a function; names are unique', () => {
  const keys = Object.keys(TEXT_MOTIONS);
  assert.ok(keys.length >= 5);
  assert.deepEqual(keys.slice(0, 5), ['float', 'slide', 'reveal', 'pop', 'emphasis'], 'the first five keep their place (saved files and the select order)');
  for (const key of keys) {
    const entry = TEXT_MOTIONS[key];
    assert.match(key, /^[a-z][a-zA-Z0-9]*$/, key);
    assert.ok(typeof entry.label === 'string' && entry.label.length >= 2 && entry.label.length <= 12, `${key}: label`);
    assert.ok(typeof entry.desc === 'string' && entry.desc.length >= 10 && entry.desc.length <= 60, `${key}: desc`);
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(entry.added) && new Date(`${entry.added}T00:00:00Z`).toISOString().startsWith(entry.added), `${key}: added is a real day (YYYY-MM-DD)`);
    assert.ok(entry.poster === undefined || (Number.isFinite(entry.poster) && entry.poster >= .05 && entry.poster <= 1.5), `${key}: poster is a time in seconds (0.05 to 1.5) or left out`);
    assert.equal(typeof entry.fn, 'function', key);
  }
  assert.equal(new Set(keys.map(k => TEXT_MOTIONS[k].label)).size, keys.length, 'labels are unique');
  assert.equal(new Set(keys.map(k => TEXT_MOTIONS[k].desc)).size, keys.length, 'explanations are unique');
});

test('a saved preset is kept only if it is in the table (no inherited names)', () => {
  for (const key of Object.keys(TEXT_MOTIONS)) assert.equal(cleanMotion({ preset: key }).preset, key);
  for (const bad of ['constructor', '__proto__', 'toString', 'hasOwnProperty', '', null, 7, {}, [], 'nope']) assert.equal(cleanMotion({ preset: bad }).preset, 'float', String(bad));
});

test('every preset: finite numbers in range, deterministic, hidden outside its time, readable in the middle', () => {
  for (const preset of Object.keys(TEXT_MOTIONS)) {
    for (const direction of ['left', 'right', 'up', 'down']) for (const speed of [.5, 1, 2]) for (const [start, end] of [[1, 7], [0, .3], [2, 2.5], [5, 5], [0, 90]]) for (const bpm of [30, 120, 300]) for (const t of times(start, end)) {
      const e = line(preset, { direction, speed }, start, end), v = motionAt(e, t, bpm);
      const where = `${preset} ${direction} speed ${speed} [${start},${end}] bpm ${bpm} t ${t}`;
      for (const k of ['opacity', 'x', 'y', 'scale', 'reveal', 'emphasis']) assert.ok(Number.isFinite(v[k]), `${where}: ${k}`);
      assert.ok(v.opacity >= 0 && v.opacity <= 1, `${where}: opacity`);
      assert.ok(Math.abs(v.x) <= 10 && Math.abs(v.y) <= 10 && v.scale >= .05 && v.scale <= 4 && v.reveal >= 0 && v.reveal <= 1 && v.emphasis >= .05 && v.emphasis <= 4, `${where}: range`);
      assert.deepEqual(v, motionAt(e, t, bpm), `${where}: deterministic`);
      if (t < start || t >= end) assert.equal(v.opacity, 0, `${where}: hidden outside`);
    }
    // a normal 6 second line at normal speed: halfway through, the text sits still, fully written and fully visible
    const v = motionAt(line(preset, { speed: 1 }, 1, 7), 4, 120);
    assert.equal(v.opacity, 1, `${preset}: visible in the middle`);
    assert.ok(Math.abs(v.x) <= .5 && Math.abs(v.y) <= .5, `${preset}: in place in the middle`);
    assert.ok(v.scale >= .8 && v.scale <= 1.3 && v.emphasis >= .8 && v.emphasis <= 1.3, `${preset}: normal size in the middle`);
    assert.equal(v.reveal, 1, `${preset}: fully written in the middle`);
  }
});

test('a broken entry cannot break the frame (NaN is ignored, big numbers are held in range)', () => {
  TEXT_MOTIONS.__broken = { label: 'こわれ', desc: 'テスト用のこわれた動き（ここだけ）', fn: () => ({ x: NaN, y: 1e9, scale: -5, reveal: 7, emphasis: Infinity, opacity: 5 }) };
  try {
    const v = motionAt(line('__broken'), 4, 120);
    assert.deepEqual(v, { opacity: 1, x: 0, y: 10, scale: .05, reveal: 1, emphasis: 1 });
  } finally { delete TEXT_MOTIONS.__broken; }
});

test('the select in the lyric panel is built from the table, so a new entry shows up there', () => {
  const controls = readFileSync(new URL('../../app/lyric-controls.js', import.meta.url), 'utf8');
  assert.ok(controls.includes('Object.entries(TEXT_MOTIONS)'));
  for (const key of ['ふわっと', '流れ込む', '一文字ずつ', '弾む']) assert.ok(!controls.includes(`'${key}'`), `${key} is no longer written into the panel`);
});
