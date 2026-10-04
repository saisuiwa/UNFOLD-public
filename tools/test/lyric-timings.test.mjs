import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTimings } from '../../app/lyric-mv.js';

test('JSON with a lines array', () => {
  const r = parseTimings('{"lines":[{"s":2,"t":"b"},{"s":1,"t":"a","k":"chorus"}]}', 'x.json');
  assert.deepEqual(r.map(l => l.t), ['a', 'b']);
  assert.equal(r[0].k, 'chorus');
});

test('JSON that is a bare array still works', () => {
  const r = parseTimings('[{"s":1,"t":"a"}]', 'x.json');
  assert.equal(r.length, 1);
  assert.equal(parseTimings('[{"s":1,"t":"a"}]').length, 1);   // no file name
});

test('LRC that starts with a timestamp is not mistaken for JSON', () => {
  const r = parseTimings('[00:01.90]いち\n[01:02.50]に\n', 'song.lrc');
  assert.deepEqual(r.map(l => [l.s, l.t]), [[1.9, 'いち'], [62.5, 'に']]);
  assert.equal(parseTimings('[00:01.90]いち').length, 1);   // even without a file name
});

test('LRC with header tags and several timestamps on one line', () => {
  const r = parseTimings('[ti:アンフォールド]\n[ar:x]\n[00:05.00][00:30.00]さび\n', 'a.LRC');
  assert.deepEqual(r.map(l => [l.s, l.t]), [[5, 'さび'], [30, 'さび']]);
});

test('unreadable text still gives the friendly error', () => {
  assert.throws(() => parseTimings('こんにちは', 'a.txt'), /タイミングを読み取れませんでした/);
});
test('LRC preserves SUNO section headings and bracketed lyric text',()=>{assert.deepEqual(parseTimings('[00:02.00][Chorus]\n[00:02.00]君の[声]','a.lrc').map(x=>x.t),['[Chorus]','君の[声]']);});
