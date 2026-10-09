import test from 'node:test';
import assert from 'node:assert/strict';
import {parseLyricLines, alignmentText, characterTimeline, lineTimes, fixOrder, toLrc, toJson, requestAlignment, splitRow, mergeRows, applyRewritten, kanjiRequest} from '../../app/lyric-sync/align.js';
import {parseTimings} from '../../app/lyric-mv.js';

const lyrics = '[Verse]\nいち に\nさん/よん\n[Chorus]\n*ご*ろく';

test('headings are not lyrics and give the kind of the lines after them', () => {
  const lines = parseLyricLines(lyrics);
  assert.deepEqual(lines.map(l => [l.t, l.k]), [['いち に', 'verse'], ['さん/よん', 'verse'], ['*ご*ろく', 'chorus']]);
});

test('the text sent for alignment has no UNFOLD marks', () => {
  assert.equal(alignmentText(parseLyricLines(lyrics)), 'いち に\nさんよん\nごろく');
});

test('per-character answers give every line the time of its first character', () => {
  const lines = parseLyricLines(lyrics);
  const chars = [...'いちにさんよんごろく'].map((text, i) => ({text, start: i, end: i + .5}));
  const rows = lineTimes(lines, {characters: chars});
  assert.deepEqual(rows.map(r => r.s), [0, 3, 7]);
  assert.ok(rows.every(r => r.exact));
  assert.equal(rows[0].e, 2.5);
});

test('per-word answers are spread over their characters', () => {
  const rows = lineTimes(parseLyricLines('あい\nうえ'), {words: [{text: 'あい', start: 1, end: 3}, {text: 'うえ', start: 5, end: 7}]});
  assert.deepEqual(rows.map(r => r.s), [1, 5]);
});

test('a different number of characters still keeps the lines in order', () => {
  const rows = lineTimes(parseLyricLines('あいう\nえおか'), {characters: [...'あいうえお'].map((text, i) => ({text, start: i, end: i + 1}))});
  assert.equal(rows[0].exact, false);
  assert.ok(rows[0].s < rows[1].s);
});

test('fixOrder removes backwards times and overlaps', () => {
  const r = fixOrder([{s: 5, e: 9}, {s: 4, e: 6}]);
  assert.equal(r[1].s, 5);
  assert.equal(r[0].e, 5);
});

test('the LRC and JSON that come out are read back by UNFOLD', () => {
  const rows = [{t: 'いち', k: 'verse', s: 1.5, e: 3}, {t: 'に', k: '', s: 65.25, e: 70}];
  assert.deepEqual(parseTimings(toLrc(rows), 'a.lrc').map(r => [r.s, r.t]), [[1.5, 'いち'], [65.25, 'に']]);
  assert.deepEqual(parseTimings(toJson(rows), 'a.json').map(r => [r.s, r.t, r.k]), [[1.5, 'いち', 'verse'], [65.25, 'に', undefined]]);
});

test('the request goes to /v1/forced-alignment with the key, and errors are readable', async () => {
  let seen;
  const ok = async (url, init) => { seen = {url, key: init.headers['xi-api-key'], text: init.body.get('text')}; return {ok: true, json: async () => ({words: []})}; };
  await requestAlignment({file: new Blob(['x']), text: 'あ', apiKey: 'K', baseUrl: 'https://example.test/', fetchImpl: ok});
  assert.deepEqual(seen, {url: 'https://example.test/v1/forced-alignment', key: 'K', text: 'あ'});
  const bad = async () => ({ok: false, status: 401, json: async () => ({detail: {status: 'invalid_api_key'}})});
  await assert.rejects(requestAlignment({file: new Blob(['x']), text: 'あ', apiKey: 'K', fetchImpl: bad}), /401/);
});

const chars = [...'くるくるまわりだすせかい'].map((text, i) => ({text, start: 10 + i, end: 10.8 + i}));
const row = () => lineTimes(parseLyricLines('くるくる まわりだす せかい'), {characters: chars})[0];

test('cutting a line uses the exact time of the first character of the second part', () => {
  const [a, b] = splitRow(row(), 'くるくる まわりだす '.length);
  assert.equal(a.t, 'くるくる まわりだす');
  assert.equal(b.t, 'せかい');
  assert.equal(a.s, 10);
  assert.equal(b.s, 19);
  assert.ok(a.e <= b.s);
  assert.equal(b.chars.length, 3);
});

test('a line already turned into kanji is cut at the same share of its length', () => {
  const r = {...row(), t: '周り出す世界'};   // the characters no longer match the kana times
  const [a, b] = splitRow(r, 4);
  assert.equal(a.t, '周り出す');
  assert.ok(b.s > r.s && b.s < r.e);
  assert.equal(b.chars, null);
});

test('cutting at an edge does nothing, and joining puts the parts back', () => {
  assert.equal(splitRow(row(), 0).length, 1);
  assert.equal(splitRow(row(), 99).length, 1);
  const [a, b] = splitRow(row(), 'くるくる まわりだす '.length);
  const joined = mergeRows(a, b);
  assert.equal(joined.s, 10);
  assert.equal(joined.chars.length, 12);
});

test('rewritten lyrics replace the text line by line, and a different line count is refused', () => {
  const rows = lineTimes(parseLyricLines('いち\nに'), {characters: [...'いちに'].map((text, i) => ({text, start: i, end: i + 1}))});
  const out = applyRewritten(rows, '[Verse]\n一\n二\n');
  assert.deepEqual(out.map(r => [r.t, r.s]), [['一', 0], ['二', 2]]);
  assert.throws(() => applyRewritten(rows, '一'), /行の数が違います/);
});

test('the kanji request lists every line once', () => {
  const req = kanjiRequest([{t: 'あ'}, {t: 'い'}]);
  assert.ok(req.endsWith('あ\nい'));
});

test('the code block marks an AI wraps around its answer are ignored', () => {
  const rows = lineTimes(parseLyricLines('いち\nに'), {characters: [...'いちに'].map((text, i) => ({text, start: i, end: i + 1}))});
  assert.deepEqual(applyRewritten(rows, '```\n一\n二\n```').map(r => r.t), ['一', '二']);
});
