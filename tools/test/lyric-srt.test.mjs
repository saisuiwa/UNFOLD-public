import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTimings } from '../../app/lyric-mv.js';
import { importTimedLyrics } from '../../app/lyric-document.js';

// what an outside "MP3 -> SRT" site (a browser Whisper tool etc.) hands back
const JA = `1
00:00:01,500 --> 00:00:04,200
いちまいの えを ここにおいて

2
00:00:05,000 --> 00:00:08,250
ぐしゃっと くずれて
ほどけだす

3
00:01:02,040 --> 00:01:05,000
こなごなの いろが ふりそそぐ
`;

test('SRT: Japanese cues give start and end in seconds', () => {
  const r = parseTimings(JA, 'song.srt');
  assert.deepEqual(r, [
    { s: 1.5, e: 4.2, t: 'いちまいの えを ここにおいて' },
    { s: 5, e: 8.25, t: 'ぐしゃっと くずれて/ほどけだす' },
    { s: 62.04, e: 65, t: 'こなごなの いろが ふりそそぐ' },
  ]);
});

test('SRT: a multi-line cue is joined with the in-phrase "/" break', () => {
  const r = parseTimings('1\n00:00:00,000 --> 00:00:02,000\n一行目\n二行目\n三行目\n', 'a.srt');
  assert.equal(r.length, 1);
  assert.equal(r[0].t, '一行目/二行目/三行目');
});

test('SRT: CRLF line ends and a BOM', () => {
  const crlf = '﻿' + JA.replace(/\n/g, '\r\n');
  assert.deepEqual(parseTimings(crlf, 'song.srt'), parseTimings(JA, 'song.srt'));
  assert.deepEqual(parseTimings(crlf).map(c => c.s), [1.5, 5, 62.04], 'also found without a file name');
  assert.equal(parseTimings('﻿1\r\n00:00:01,000 --> 00:00:02,000\r\nあ\r\n', 'x.SRT')[0].t, 'あ', 'extension is case-insensitive');
});

test('SRT: a missing index, "." for the comma, and a cue straight after another are tolerated', () => {
  const noIndex = parseTimings('00:00:01.250 --> 00:00:02.000\nあ\n\n00:00:03.000 --> 00:00:04.500\nい\n', 'a.srt');
  assert.deepEqual(noIndex.map(c => [c.s, c.e, c.t]), [[1.25, 2, 'あ'], [3, 4.5, 'い']]);
  const glued = parseTimings('1\n00:00:01,000 --> 00:00:02,000\nあ\n2\n00:00:03,000 --> 00:00:04,000\nい\n', 'a.srt');
  assert.deepEqual(glued.map(c => c.t), ['あ', 'い'], 'the next cue\'s index number is not lyric text');
  const noBlank = parseTimings('00:00:01,000 --> 00:00:02,000\nあ\n00:00:03,000 --> 00:00:04,000\nい', 'a.srt');
  assert.deepEqual(noBlank.map(c => c.t), ['あ', 'い']);
});

test('SRT: styling tags and entities are not lyrics', () => {
  const r = parseTimings('1\n00:00:01,000 --> 00:00:02,000\n<i>きみの</i> <font color="#ff0000">こえ</font>\n{\\an8}<b>うた</b> &amp; &lt;3\n', 'a.srt');
  assert.equal(r[0].t, 'きみの こえ/うた & <3');
});

test('SRT: cues sort by start, empty cues are dropped, a zero-length cue has no end', () => {
  const r = parseTimings('2\n00:00:05,000 --> 00:00:05,000\nあと\n\n3\n00:00:09,000 --> 00:00:10,000\n<i></i>\n\n1\n00:00:01,000 --> 00:00:02,000\nさき\n', 'a.srt');
  assert.deepEqual(r, [{ s: 1, e: 2, t: 'さき' }, { s: 5, t: 'あと' }]);
});

test('SRT: hours may be missing (WebVTT-style) and cue settings are ignored', () => {
  const r = parseTimings('WEBVTT\n\n00:01.000 --> 00:03.000 align:start\nあ\n', 'a.srt');
  assert.deepEqual(r, [{ s: 1, e: 3, t: 'あ' }]);
});

test('SRT: a file with no cue gives a clear error, and the generic error mentions .srt', () => {
  assert.throws(() => parseTimings('こんにちは', 'a.srt'), /SRT/);
  assert.throws(() => parseTimings('', 'a.srt'), /SRT/);
  assert.throws(() => parseTimings('こんにちは', 'a.txt'), /\.srt/);
});

test('SRT detection does not steal LRC or JSON', () => {
  assert.deepEqual(parseTimings('[00:01.90]いち', 'a.lrc').map(l => [l.s, l.t]), [[1.9, 'いち']]);
  assert.deepEqual(parseTimings('[{"s":1,"t":"00:00:01,000 --> 00:00:02,000"}]', 'a.json').map(l => l.s), [1]);
});

test('SRT cues become timed lyric lines with s, e and a line break at "/"', () => {
  const doc = importTimedLyrics(parseTimings(JA, 'song.srt'), 'file');
  const lines = doc.events.filter(e => e.kind === 'line');
  assert.equal(lines.length, 3);
  assert.deepEqual(lines.map(e => [e.s, e.e, e.timingSource]), [[1.5, 4.2, 'file'], [5, 8.25, 'file'], [62.04, 65, 'file']]);
  assert.equal(lines[1].raw, 'ぐしゃっと くずれて/ほどけだす');
  assert.equal(lines[1].runs.map(r => r.text).join(''), 'ぐしゃっと くずれて\nほどけだす', 'the "/" is a line break inside the phrase');
});
