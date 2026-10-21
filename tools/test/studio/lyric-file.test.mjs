// STUDIO の「歌詞ファイルを入れる」と新しいMVの素材の窓: LRC / SRT / JSON / TXT を、シーケンスと同じ読み方で歌詞の文書にする
import test from 'node:test';
import assert from 'node:assert/strict';
import {readLyricFile} from '../../../app/studio/lyric-file.js';
const lines=d=>d.events.filter(e=>e.kind==='line').map(e=>[e.text,e.s,e.e??null,e.timingSource]);

test('LRC: times and text, the header tags are not lyrics', () => {
  assert.deepEqual(lines(readLyricFile('[ti:うた]\n[ar:作者]\n[00:01.00]一行目\n[00:04.50]二行目\n', 'a.lrc')), [['一行目', 1, null, 'file'], ['二行目', 4.5, null, 'file']]);
});

test('SRT: start and end, a two-line cue keeps its break', () => {
  const d = readLyricFile('﻿1\r\n00:00:02,000 --> 00:00:05,000\nそらへ\nとどけ\n\n2\n00:00:06,500 --> 00:00:09,000\nまた\n', 'b.srt');
  assert.deepEqual(lines(d), [['そらへ\nとどけ', 2, 5, 'file'], ['また', 6.5, 9, 'file']]);
});

test('TXT: plain lyrics have no times yet (STUDIO spreads them over the song); headings are sections, unknown ones are left for later', () => {
  const d = readLyricFile('朝の光\n[Chorus]\n新しい空\n[Hook]\nもう一度\n', 'c.txt');
  assert.deepEqual(lines(d), [['朝の光', null, null, 'none'], ['新しい空', null, null, 'none'], ['もう一度', null, null, 'none']]);
  assert.deepEqual(d.events.filter(e => e.decision === 'pending').map(e => e.raw), ['[Hook]']);
});

test('TXT holding an LRC or an SRT is read with its times', () => {
  assert.deepEqual(lines(readLyricFile('[ti:x]\n[00:03.00]あ\n', 'd.txt')), [['あ', 3, null, 'file']]);
  assert.deepEqual(lines(readLyricFile('1\n00:00:01,500 --> 00:00:04,200\nい\n', 'e.txt')), [['い', 1.5, 4.2, 'file']]);
});

test('JSON: lines with s / e / t (array or {lines}), as the sequence writes them', () => {
  assert.deepEqual(lines(readLyricFile('[{"s":1,"e":2,"t":"う"},{"s":3,"t":"え"}]', 'f.json')), [['う', 1, 2, 'file'], ['え', 3, null, 'file']]);
  assert.deepEqual(lines(readLyricFile('{"lines":[{"s":0.5,"t":"お"}]}', 'g.json')), [['お', 0.5, null, 'file']]);
});

test('JSON from the sequence (lyricDocument): read back as it was; a code motion becomes a plain one (STUDIO would need it approved)', () => {
  const doc = {version: 1, events: [{id: 'L1', kind: 'line', raw: 'か', s: 1, e: 2, timingSource: 'tap', motion: {preset: 'pop', color: '#ff0000'}}, {id: 'L2', kind: 'line', raw: 'き', s: 3, timingSource: 'manual', motion: {preset: 'float', code: {source: 'evil()'}}}]};
  const d = readLyricFile(JSON.stringify({version: 1, lyricDocument: doc}), 'h.json');
  assert.deepEqual(lines(d), [['か', 1, 2, 'tap'], ['き', 3, null, 'manual']]);
  assert.equal(d.events[0].motion.preset, 'pop');
  assert.equal(d.events[1].motion.code, undefined);
  assert.equal(d.events[1].motion.preset, 'reveal');
});

test('every line gets the plain motion the sequence gives (一文字ずつ, bigger in the chorus)', () => {
  const d = readLyricFile('[Verse]\nふつう\n[Chorus]\nサビ\n', 'i.txt');
  assert.deepEqual(d.events.filter(e => e.kind === 'line').map(e => [e.motion.preset, e.motion.size]), [['reveal', 64], ['reveal', 86]]);
});

test('a broken file says which file and why', () => {
  assert.throws(() => readLyricFile('{oops', 'j.json'), /歌詞ファイル「j\.json」を読めませんでした/);
  assert.throws(() => readLyricFile('時刻のない文', 'k.srt'), /歌詞ファイル「k\.srt」を読めませんでした/);
});
