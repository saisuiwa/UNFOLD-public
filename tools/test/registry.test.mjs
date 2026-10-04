import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import * as R from '../../app/method-registry.js';

const OLD = new URL('../../archive/app-before-custom-engine-2026-10-02/', import.meta.url);

test('there are 29 built-in methods and the order is the shader id', () => {
  assert.equal(R.BUILTIN_KEYS.length, 29);
  assert.equal(R.BUILTIN_IDS.crumple, 0);
  assert.equal(R.BUILTIN_IDS.vortex, 10);
  assert.equal(R.BUILTIN_IDS.line, 28);
});

test('keys, labels, symbols and ids match the page before this change', { skip: !existsSync(new URL('index.html', OLD)) }, () => {
  const html = readFileSync(new URL('index.html', OLD), 'utf8');
  const buttons = [...html.matchAll(/<button data-method="([a-z]+)" aria-pressed="(?:true|false)"><span class="symbol">([^<]*)<\/span>([^<]*)<small>([^<]*)<\/small><\/button>/g)];
  assert.equal(buttons.length, 29);
  buttons.forEach(([, key, symbol, label, en], i) => assert.deepEqual([key, label, symbol, en], R.BUILTIN_METHODS[i], `method #${i}`));
  const appJs = readFileSync(new URL('app.js', OLD), 'utf8');
  const ids = JSON.parse(/const methodIds=(\{[^}]*\})/.exec(appJs)[1].replace(/([a-z]+):/g, '"$1":'));
  assert.deepEqual(R.BUILTIN_IDS, ids);
});

test('icons: built-in ones carry their English name, custom ones say CUSTOM', () => {
  assert.deepEqual(R.methodIcon('scatter'), ['⠿', 'SCATTER']);
  R.registerCustom({ id: 'cm-icon', name: 'x', symbol: '渦', vertex: 'v' });
  assert.deepEqual(R.methodIcon('cm-icon'), ['渦', 'CUSTOM']);
  R.unregisterCustom('cm-icon');
});

test('custom methods: register, status, resolve, labels and change events', () => {
  let changes = 0;
  const off = R.onRegistryChange(() => { changes++; });
  R.registerCustom({ id: 'cm-a', name: 'ためし', symbol: '渦巻', vertex: 'vec3 userMethod(vec2 p, float a) { return vec3(p, 0.); }' });
  assert.equal(R.getCustom('cm-a').symbol, '渦');           // one character only
  assert.equal(R.getCustom('cm-a').rev, 1);
  assert.equal(R.resolveKey('cm-a'), 'cm-a');
  assert.equal(R.methodLabel('cm-a'), 'ためし');
  R.registerCustom({ id: 'cm-a', name: 'ためし2', vertex: 'x' });
  assert.equal(R.getCustom('cm-a').rev, 2);                 // new code = new revision
  R.setCustomStatus('cm-a', 'quarantined', '未確認');
  assert.equal(R.getCustom('cm-a').rev, 2);                 // a status change is not a new revision
  assert.equal(R.resolveKey('cm-a'), 'crumple');
  assert.equal(R.isUsable('cm-a'), false);
  assert.deepEqual(R.methodEntries('cm-a').at(-1), ['cm-a', 'ためし2（使えません）']);
  assert.equal(R.methodEntries().some(([k]) => k === 'cm-a'), false);
  R.unregisterCustom('cm-a');
  assert.equal(R.getCustom('cm-a'), undefined);
  assert.equal(changes, 4);                                  // register, register, status, unregister
  off();
});

test('unknown or odd keys fall back to the default method', () => {
  for (const key of ['', undefined, null, 'nope', 'constructor', '__proto__', 'cm-missing']) assert.equal(R.resolveKey(key), 'crumple');
  assert.equal(R.resolveKey('twist'), 'twist');
});

test('custom ids must start with cm-', () => {
  assert.throws(() => R.registerCustom({ id: 'glb-1', name: 'x', vertex: '' }), /cm-/);
});

test('newCustomId makes ids that start with cm- and do not repeat', () => {
  const ids = new Set(Array.from({ length: 50 }, () => R.newCustomId()));
  assert.equal(ids.size, 50);
  for (const id of ids) assert.ok(R.isCustomKey(id) && id.length > R.CUSTOM_PREFIX.length + 8, id);
});
