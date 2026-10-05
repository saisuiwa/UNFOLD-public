import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../../app/method-registry.js';
import { IMPORTED_REASON, PROJECT_METHODS, collectMethods, planImport, projectVersion, registerQuarantined, remapTransitions, usedMethodIds, validateEmbedded } from '../../app/method-project.js';
import { sourceHash } from '../../app/method-library.js';
import { GOOD } from './fixtures/methods.mjs';

const tr = (method, method2 = '') => ({ method, method2, shape: 'sphere', beats: 8 });

test('usedMethodIds: the custom methods the transitions use, once each', () => {
  assert.deepEqual(usedMethodIds([tr('twist'), tr('cm-a', 'cm-b'), tr('cm-a'), tr('crumple', 'cm-c')]), ['cm-a', 'cm-b', 'cm-c']);
  assert.deepEqual(usedMethodIds([tr('twist', 'wave')]), []);
  assert.deepEqual(usedMethodIds(undefined), []);
  assert.deepEqual(usedMethodIds([null, {}, tr(undefined, null)]), []);
});

test('collectMethods: what goes into the file (no status, no hash; look and params stay empty)', () => {
  const local = { 'cm-a': { id: 'cm-a', name: 'A', symbol: 'あ', vertex: GOOD.vortex, status: 'ok', rev: 4, reason: '' }, 'cm-b': { id: 'cm-b', name: 'B', symbol: 'B', vertex: GOOD.wave, status: 'quarantined', rev: 1, reason: 'x' } };
  const methods = collectMethods([tr('cm-a'), tr('crumple', 'cm-b'), tr('cm-gone')], id => local[id]);
  assert.deepEqual(methods, [
    { id: 'cm-a', name: 'A', symbol: 'あ', vertex: GOOD.vortex, look: null, params: [] },
    { id: 'cm-b', name: 'B', symbol: 'B', vertex: GOOD.wave, look: null, params: [] },
  ]);
});

test('projectVersion is 2 only when methods are inside, so files without them stay readable by older pages', () => {
  assert.equal(projectVersion([]), 1);
  assert.equal(projectVersion(undefined), 1);
  assert.equal(projectVersion([{ id: 'cm-a' }]), 2);
});

const entry = (extra = {}) => ({ id: 'cm-x', name: 'X', symbol: 'エ', vertex: GOOD.vortex, ...extra });

test('validateEmbedded: a good list passes (and only the fields we use are kept)', () => {
  const { methods, problems } = validateEmbedded([entry({ hash: 'evil', status: 'ok', look: 'x', params: [1] })]);
  assert.deepEqual(problems, []);
  assert.deepEqual(methods, [{ id: 'cm-x', name: 'X', symbol: 'エ', vertex: GOOD.vortex }]);
});

test('validateEmbedded: nothing is fine; a list that is not a list is not', () => {
  assert.deepEqual(validateEmbedded(undefined), { methods: [], problems: [] });
  assert.deepEqual(validateEmbedded(null), { methods: [], problems: [] });
  assert.equal(validateEmbedded({ not: 'a list' }).methods.length, 0);
  assert.equal(validateEmbedded('oops').problems.length, 1);
});

test('validateEmbedded: bad entries are dropped one by one, with a reason', () => {
  const bad = [null, 5, 'x', entry({ id: 'glb-1' }), entry({ id: 42 }), entry({ id: 'cm-' + 'z'.repeat(100) }), entry({ vertex: '' }), entry({ vertex: 12 }),
    entry({ vertex: 'a'.repeat(PROJECT_METHODS.maxChars + 1) })];
  const { methods, problems } = validateEmbedded([...bad, entry({ id: 'cm-ok' })]);
  assert.deepEqual(methods.map(m => m.id), ['cm-ok']);
  assert.equal(problems.length, bad.length);
});

test('validateEmbedded: the same id twice is one method (the first)', () => {
  const { methods, problems } = validateEmbedded([entry({ vertex: 'first' }), entry({ vertex: 'second' })]);
  assert.deepEqual(methods.map(m => m.vertex), ['first']);
  assert.equal(problems.length, 1);
});

test('validateEmbedded: too many methods are cut off', () => {
  const many = Array.from({ length: PROJECT_METHODS.maxCount + 5 }, (_, i) => entry({ id: `cm-${i}` }));
  const { methods, problems } = validateEmbedded(many);
  assert.equal(methods.length, PROJECT_METHODS.maxCount);
  assert.equal(problems.length, 1);
});

test('validateEmbedded: names and symbols are cleaned up', () => {
  const { methods } = validateEmbedded([entry({ id: 'cm-1', name: '  ' + 'あ'.repeat(40) + '  ', symbol: '渦巻' }), entry({ id: 'cm-2', name: 5, symbol: null }), entry({ id: 'cm-3', name: '<b>x</b>', symbol: '' })]);
  assert.equal([...methods[0].name].length, PROJECT_METHODS.maxName);
  assert.equal(methods[0].symbol, '渦');
  assert.equal(methods[1].name, '取り込んだメソッド');
  assert.equal(methods[1].symbol, '取');
  assert.equal(methods[2].name, '<b>x</b>', 'text is kept as text (the page never puts it in as HTML)');
  assert.equal(methods[2].symbol, '<');
});

test('validateEmbedded: a file from a newer version is not guessed at', () => {
  const { methods, problems } = validateEmbedded([entry()], 5);
  assert.deepEqual(methods, []);
  assert.equal(problems.length, 1);
  assert.equal(validateEmbedded([entry()], 2).methods.length, 1);
  assert.equal(validateEmbedded([entry()], 1).methods.length, 1, 'the version is not trusted either way');
});

const idMaker = () => { let n = 0; return () => `cm-new${++n}`; };

test('planImport: code that is already here is reused (found by the code, not by the id)', async () => {
  const plan = await planImport({
    embedded: [{ id: 'cm-file-id', name: 'V', symbol: 'V', vertex: GOOD.vortex }],
    local: [{ id: 'cm-local-id', vertex: GOOD.vortex }, { id: 'cm-other', vertex: GOOD.wave }],
    hash: sourceHash, newId: idMaker(),
  });
  assert.deepEqual([...plan.map], [['cm-file-id', 'cm-local-id']]);
  assert.deepEqual(plan.reused, ['cm-local-id']);
  assert.deepEqual(plan.created, []);
});

test('planImport: code that is new gets a new id of its own', async () => {
  const plan = await planImport({ embedded: [{ id: 'cm-file-id', name: 'W', symbol: 'W', vertex: GOOD.wave }], local: [{ id: 'cm-local', vertex: GOOD.vortex }], hash: sourceHash, newId: idMaker() });
  assert.deepEqual([...plan.map], [['cm-file-id', 'cm-new1']]);
  assert.deepEqual(plan.created, [{ id: 'cm-new1', name: 'W', symbol: 'W', vertex: GOOD.wave }]);
  assert.deepEqual(plan.reused, []);
});

test('planImport: a file that says "cm-local" but brings other code does not touch the local method', async () => {
  const plan = await planImport({ embedded: [{ id: 'cm-local', name: 'Evil', symbol: 'E', vertex: GOOD.wave }], local: [{ id: 'cm-local', vertex: GOOD.vortex }], hash: sourceHash, newId: idMaker() });
  assert.equal(plan.map.get('cm-local'), 'cm-new1');
  assert.equal(plan.created.length, 1);
  assert.deepEqual(plan.reused, []);
});

test('planImport: the same code twice in a file is one method', async () => {
  const plan = await planImport({
    embedded: [{ id: 'cm-1', name: 'A', symbol: 'A', vertex: GOOD.wave }, { id: 'cm-2', name: 'B', symbol: 'B', vertex: GOOD.wave }],
    local: [], hash: sourceHash, newId: idMaker(),
  });
  assert.equal(plan.created.length, 1);
  assert.equal(plan.map.get('cm-1'), plan.map.get('cm-2'));
  assert.deepEqual(plan.reused, []);
});

test('remapTransitions: ids are replaced, everything else about a transition stays', () => {
  const map = new Map([['cm-file', 'cm-local']]);
  const out = remapTransitions([{ ...tr('cm-file', 'cm-file'), text: 'x', viewX: 3 }, tr('twist', 'wave')], map);
  assert.deepEqual(out[0], { method: 'cm-local', method2: 'cm-local', shape: 'sphere', beats: 8, text: 'x', viewX: 3 });
  assert.deepEqual(out[1], tr('twist', 'wave'));
});

test('remapTransitions: a custom id that the file did not bring becomes the default method (never a local method that happens to share the id)', () => {
  const out = remapTransitions([tr('cm-not-in-file', 'cm-not-in-file')], new Map());
  assert.equal(out[0].method, 'crumple');
  assert.equal(out[0].method2, '');
});

test('remapTransitions: odd input does not throw', () => {
  assert.deepEqual(remapTransitions(undefined, new Map()), []);
  assert.deepEqual(remapTransitions([null, 7], new Map()), [null, 7]);
});

test('registerQuarantined puts new methods in as unchecked ones with the reason', () => {
  for (const c of R.listCustom()) R.unregisterCustom(c.id);
  registerQuarantined([{ id: 'cm-q1', name: 'Q', symbol: 'Q', vertex: GOOD.wave }, { id: 'cm-q2', name: 'R', symbol: 'R', vertex: GOOD.vortex }]);
  for (const id of ['cm-q1', 'cm-q2']) {
    assert.equal(R.getCustom(id).status, 'quarantined');
    assert.equal(R.getCustom(id).reason, IMPORTED_REASON);
    assert.equal(R.isUsable(id), false);
  }
  registerQuarantined([]);
  for (const c of R.listCustom()) R.unregisterCustom(c.id);
});
