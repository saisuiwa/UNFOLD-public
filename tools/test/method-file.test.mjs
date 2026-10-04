import test from 'node:test';
import assert from 'node:assert/strict';
import { METHOD_FILE, buildMethodFile, methodFileName, parseMethodFile } from '../../app/method-file.js';
import { planImport } from '../../app/method-project.js';
import { sourceHash } from '../../app/method-library.js';
import { GOOD } from './fixtures/methods.mjs';

const rec = (extra = {}) => ({ id: 'cm-a', name: '流星群', symbol: '★', vertex: GOOD.vortex, status: 'ok', rev: 3, reason: '', ...extra });

test('build then parse gives the methods back, and nothing but the method itself travels', () => {
  const text = buildMethodFile([rec(), rec({ id: 'cm-b', name: 'B', symbol: 'B', vertex: GOOD.wave, status: 'quarantined', reason: 'secret note' })]);
  const data = JSON.parse(text);
  assert.equal(data.format, 'unfold-method');
  assert.equal(data.version, 1);
  assert.deepEqual(Object.keys(data.methods[0]).sort(), ['id', 'look', 'name', 'params', 'symbol', 'vertex']);
  assert.ok(!text.includes('secret note') && !text.includes('quarantined'), 'status and reason stay at home');
  const { methods, problems } = parseMethodFile(text);
  assert.deepEqual(problems, []);
  assert.deepEqual(methods, [
    { id: 'cm-a', name: '流星群', symbol: '★', vertex: GOOD.vortex },
    { id: 'cm-b', name: 'B', symbol: 'B', vertex: GOOD.wave },
  ]);
});

test('the file is plain readable text: indented, Japanese as it is, ends with a newline', () => {
  const text = buildMethodFile([rec()]);
  assert.ok(text.includes('流星群') && text.includes('\n  ') && text.endsWith('\n'));
});

test('methodFileName: the name of the method plus .unfoldmethod, with nothing a file name cannot hold', () => {
  assert.equal(methodFileName({ name: '流星群' }), '流星群.unfoldmethod');
  assert.equal(methodFileName({ name: 'a/b:c*d?"e<f>g|h\\i' }), 'abcdefghi.unfoldmethod');
  assert.equal(methodFileName({ name: '   ' }), 'method.unfoldmethod');
  assert.equal(methodFileName({ name: '.hidden' }), 'hidden.unfoldmethod');
  assert.equal(methodFileName({}), 'method.unfoldmethod');
  assert.equal([...methodFileName({ name: 'あ'.repeat(50) })].length, 30 + METHOD_FILE.extension.length);
});

test('parse: text that is not a method file is told so, not guessed at', () => {
  const none = text => { const r = parseMethodFile(text); assert.deepEqual(r.methods, []); assert.equal(r.problems.length, 1); return r.problems[0]; };
  assert.match(none('not json at all'), /読めません/);
  assert.match(none('42'), /自作メソッドのファイルではありません/);
  assert.match(none('null'), /自作メソッドのファイルではありません/);
  assert.match(none(JSON.stringify({ format: 'something-else', methods: [] })), /自作メソッドのファイルではありません/);
  assert.match(none(JSON.stringify({ format: 'unfold-method', version: 1 })), /メソッドが入っていません/);
  assert.match(none(JSON.stringify({ format: 'unfold-method', version: 1, methods: [] })), /メソッドが入っていません/);
  assert.match(none(JSON.stringify({ format: 'unfold-method', version: 2, methods: [{ id: 'cm-x', name: 'x', vertex: GOOD.wave }] })), /新しい形式/);
  assert.match(none(undefined), /読めません/);
});

test('parse: a file that is far too big is refused before it is read', () => {
  const { methods, problems } = parseMethodFile('x'.repeat(METHOD_FILE.maxChars + 1));
  assert.deepEqual(methods, []);
  assert.match(problems[0], /大きすぎ/);
});

test('parse: a missing version is read as version 1', () => {
  const { methods } = parseMethodFile(JSON.stringify({ format: 'unfold-method', methods: [{ id: 'cm-x', name: 'x', symbol: 'x', vertex: GOOD.wave }] }));
  assert.equal(methods.length, 1);
});

test('parse: the same checks as for methods inside a project: bad entries dropped with a reason, fields cleaned, text stays text', () => {
  const text = JSON.stringify({ format: 'unfold-method', version: 1, methods: [
    { id: 'glb-1', name: 'wrong id', vertex: GOOD.wave },
    { id: 'cm-big', name: 'big', vertex: 'a'.repeat(9000) },
    { id: 'cm-ok', name: '<img src=x onerror=alert(1)>', symbol: '', vertex: GOOD.wave, hash: 'trust-me', status: 'ok', rev: 99 },
  ] });
  const { methods, problems } = parseMethodFile(text);
  assert.equal(problems.length, 2);
  assert.deepEqual(methods, [{ id: 'cm-ok', name: '<img src=x onerror=a', symbol: '<', vertex: GOOD.wave }]);
});

test('a method that is already here (the same code) is found again, whatever its id in the file', async () => {
  const { methods } = parseMethodFile(buildMethodFile([rec({ id: 'cm-from-another-browser' })]));
  let n = 0;
  const plan = await planImport({ embedded: methods, local: [{ id: 'cm-mine', vertex: GOOD.vortex }], hash: sourceHash, newId: () => `cm-new${++n}` });
  assert.deepEqual(plan.reused, ['cm-mine']);
  assert.deepEqual(plan.created, []);
});
