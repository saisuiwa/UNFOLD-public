import test from 'node:test';
import assert from 'node:assert/strict';
import { DAILY_IMAGE_METHODS } from '../../app/image-method-daily.js';
import { DAILY_CODE_MOTIONS } from '../../app/code-motion-daily.js';
import { IMAGE_METHOD_PRESETS } from '../../app/image-method-presets.js';
import { CODE_MOTION_PRESETS } from '../../app/code-motion-presets.js';
import { cleanImageCode } from '../../app/image-method-format.js';
import { cleanCodeMotion } from '../../app/code-motion-format.js';
import { catalog, DAILY_GROUPS } from '../lib/samples-catalog.mjs';

const isDay = d => /^\d{4}-\d{2}-\d{2}$/.test(d) && new Date(`${d}T00:00:00Z`).toISOString().startsWith(d);
const noComments = source => source.split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');
// what breaks "the same time gives the same picture" (replay, rewind, video export), as written in docs/image-code-methods.md and app/guide/code-motions.html
const FORBIDDEN = [/Date\.now/, /Math\.random/, /setInterval/, /setTimeout/, /requestAnimationFrame/, /performance\.now/, /\bfetch\s*\(/, /\bimport\s*\(/, /XMLHttpRequest/, /\bwhile\s*\(\s*(true|1)\s*\)/];

function common(list, label) {
  assert.equal(new Set(list.map(m => m.key)).size, list.length, `${label}: keys are unique`);
  for (const m of list) {
    assert.match(m.key, /^[a-z][a-z0-9-]*$/, `${label} ${m.key}: key`);
    assert.ok(m.name.length >= 2 && m.name.length <= 20, `${label} ${m.key}: name is 2 to 20 characters`);
    assert.ok(m.desc.length >= 10 && m.desc.length <= 60 && m.desc.endsWith('。'), `${label} ${m.key}: desc is one line of 10 to 60 characters ending with 。`);
    assert.ok(isDay(m.added), `${label} ${m.key}: added is a real day (YYYY-MM-DD)`);
  }
}

test('daily JavaScript image methods: fields, format, and nothing that breaks replay', () => {
  common(DAILY_IMAGE_METHODS, 'image');
  const names = IMAGE_METHOD_PRESETS.map(p => p.name);
  assert.equal(new Set(names).size, names.length, 'every image sample has its own name (the workshop shows them side by side)');
  for (const m of DAILY_IMAGE_METHODS) {
    assert.equal([...m.symbol].length, 1, `${m.key}: symbol is one character`);
    assert.ok(m.poster === undefined || (Number.isFinite(m.poster) && m.poster >= 0 && m.poster <= 5.9), `${m.key}: poster is a second of the clip (0 to 5.9) or left out`);
    assert.equal(m.previewShape, undefined, `${m.key}: previewShape stays unset ('none' is counted by the eight surface effects' tests)`);
    assert.doesNotThrow(() => cleanImageCode(m.code), `${m.key}: the code passes the app's own check`);
    assert.ok(m.code.source.startsWith('//'), `${m.key}: the first line of the code is a comment`);
    assert.ok(/\breturn\s*\{/.test(m.code.source), `${m.key}: the code returns { update / timeline / ... }`);
    for (const pattern of FORBIDDEN) assert.ok(!pattern.test(noComments(m.code.source)), `${m.key}: ${pattern}`);
  }
});

test('daily text code motions: fields, format, and nothing that breaks replay', () => {
  common(DAILY_CODE_MOTIONS, 'codetext');
  const names = CODE_MOTION_PRESETS.map(p => p.name);
  assert.equal(new Set(names).size, names.length, 'every code motion has its own name');
  for (const m of DAILY_CODE_MOTIONS) {
    assert.ok(m.poster === undefined || (Number.isFinite(m.poster) && m.poster >= .05 && m.poster <= 1.5), `${m.key}: poster is 0.05 to 1.5 seconds or left out`);
    assert.doesNotThrow(() => cleanCodeMotion({ version: 1, source: m.source }), `${m.key}: the code passes the app's own check`);
    assert.ok(m.source.startsWith('//'), `${m.key}: the first line of the code is a comment`);
    assert.ok(/\breturn\s*\{[^}]*\b(update|timeline)\b/.test(m.source), `${m.key}: the code returns { update } or { timeline }`);
    for (const pattern of FORBIDDEN) assert.ok(!pattern.test(noComments(m.source)), `${m.key}: ${pattern}`);
  }
});

test('the daily groups are the three the routine adds one each of; ids are unique across the catalog', () => {
  assert.deepEqual(DAILY_GROUPS, ['method', 'image', 'codetext']);
  const ids = catalog().map(i => i.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const item of catalog()) assert.ok(item.name && item.desc && isDay(item.added), item.id);
});

test('the workshop lists the daily entries after the Mac-made ones (the workshop numbers its samples by position, so appending keeps old numbers)', () => {
  const builtin = IMAGE_METHOD_PRESETS.length - DAILY_IMAGE_METHODS.length;
  assert.equal(IMAGE_METHOD_PRESETS.slice(builtin).map(p => p.name).join('|'), DAILY_IMAGE_METHODS.map(p => p.name).join('|'));
  assert.equal(builtin, 11, 'the 3 physics samples and the 8 surface effects come first');
  assert.deepEqual(CODE_MOTION_PRESETS.slice(CODE_MOTION_PRESETS.length - DAILY_CODE_MOTIONS.length).map(p => p.name), DAILY_CODE_MOTIONS.map(p => p.name));
  assert.equal(CODE_MOTION_PRESETS.length - DAILY_CODE_MOTIONS.length, 3, 'the 3 Mac-made code motions come first');
});
