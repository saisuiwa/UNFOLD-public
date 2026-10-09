import test from 'node:test';
import assert from 'node:assert/strict';
import {parseLyricLines, alignmentText, characterTimeline, lineTimes, fixOrder, toLrc, toJson, requestAlignment} from '../../app/lyric-sync/align.js';
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
