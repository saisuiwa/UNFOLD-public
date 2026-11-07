// 歌詞を曲に合わせる（自動）: 聞き取った字を歌詞の行に合わせる（app/lyric-auto/lyric-align.js）と、聞き取りの係の純な部分（app/lyric-auto/lyric-listen.js）。MOTION LAB の tests/lyric-align.test.mjs と同じ中身
import test from 'node:test';
import assert from 'node:assert/strict';
import {charKey, lcsPairs, trustPairs, alignLyrics, applyAligned, alignNote, lineLetters, lyricsBefore} from '../../app/lyric-auto/lyric-align.js';
import {cutLoops, readWindow, piecesToChars, WHISPER} from '../../app/lyric-auto/lyric-listen.js';

/** 文を、1字 step 秒ずつ歌ったことにした聞き取り（t0 から） */
const sing = (text, t0, step = .3) => [...text.replace(/\s/g, '')].map((ch, k) => ({ch, t: Math.round((t0 + k * step) * 1000) / 1000}));
const near = (a, b, tol = .011) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test('charKey: katakana as hiragana, full-width letters and digits as half-width lower case, kanji numbers as digits, marks and spaces are not letters', () => {
  assert.equal(charKey('ル'), 'る'); assert.equal(charKey('る'), 'る');
  assert.equal(charKey('Ｍ'), 'm'); assert.equal(charKey('M'), 'm'); assert.equal(charKey('１'), '1');
  assert.equal(charKey('一'), '1'); assert.equal(charKey('夜'), '夜'); assert.equal(charKey('ー'), 'ー');
  for (const c of ['！', '?', '、', '。', ' ', '　', '・', '/', '…']) assert.equal(charKey(c), null, c);
});

test('lineLetters counts like work.js (no spaces, no line-break marks), so sung has one time per letter', () => {
  assert.deepEqual(lineLetters('遠くへ 遠くへ'), [...'遠くへ遠くへ']);
  assert.deepEqual(lineLetters('ねえ/見えてる？'), [...'ねえ見えてる？']);
});

test('lcsPairs: the longest common run of letters, in order; null letters never match', () => {
  assert.deepEqual(lcsPairs([...'abcd'], [...'xbyd']), [[1, 1], [3, 3]]);
  assert.deepEqual(lcsPairs(['a', null, 'b'], [null, 'a', 'b']), [[0, 1], [2, 2]]);
  assert.deepEqual(lcsPairs([], [...'ab']), []);
});

test('trustPairs: runs of two or more are kept; a lone match far from the others (a stray particle) is dropped', () => {
  const t = [0, 1, 2, 3, 50, 51, 52];
  const pairs = [[0, 0], [1, 1], [2, 4], [3, 5], [4, 6]];   // 0-1 続き、2-4 続き（聞いた字の 4〜6）
  assert.deepEqual(trustPairs(pairs, t), pairs);
  const stray = [[0, 0], [1, 1], [2, 40], [5, 3], [6, 4]], tt = Array.from({length: 41}, (_, i) => i === 40 ? 99 : i);
  assert.deepEqual(trustPairs(stray, tt), [[0, 0], [1, 1], [5, 3], [6, 4]]);
});

test('alignLyrics: heard exactly → each line starts on its first letter and every letter gets its time (minus the lag); marks take the letter before', () => {
  const lines = [{text: '夜のホームで'}, {text: '光を待つ！'}];
  const heard = [...sing('夜のホームで', 10), ...sing('光を待つ', 14)];
  const got = alignLyrics(lines, heard, {lag: .2});
  assert.equal(got.matched, 2);
  near(got.lines[0].s, 9.8); near(got.lines[1].s, 13.8);
  assert.equal(got.lines[1].sung.length, lineLetters('光を待つ！').length);
  near(got.lines[1].sung[4], got.lines[1].sung[3]);
  got.lines[0].sung.forEach((t, k) => near(t, 9.8 + k * .3));
  assert.ok(got.lines[0].e < got.lines[1].s && got.lines[0].e > got.lines[0].sung.at(-1));
  assert.ok(got.lines[1].sung.every(t => t >= got.lines[1].s && t < got.lines[1].e));
});

test('alignLyrics: katakana heard as hiragana, digits for kanji numbers, and a misheard word (開く vs ひらく) is split between its neighbours', () => {
  const lines = [{text: 'ループ もう一回'}, {text: '世界がひらく'}];
  const heard = [...sing('るーぷもう1回', 2), ...sing('世界が開く', 6)];
  const got = alignLyrics(lines, heard, {lag: 0});
  assert.equal(got.matched, 2);
  near(got.lines[0].s, 2); near(got.lines[0].sung[6], 2 + 6 * .3);
  const s = got.lines[1].sung;   // 世界が（合う）ひら（割る）く（合う）
  near(s[0], 6); near(s[2], 6.6); near(s[5], 7.2);
  assert.ok(s[3] > s[2] && s[4] > s[3] && s[5] > s[4]);
});

test('alignLyrics: a line that was not heard at all goes between the heard lines around it, as a guess (no letter times kept by applyAligned)', () => {
  const lines = [{text: '歌が言葉を'}, {text: 'モーション ラボ'}, {text: '連れていく'}];
  const heard = [...sing('歌が言葉を', 1), ...sing('Motion Love', 3), ...sing('連れていく', 6)];
  const got = alignLyrics(lines, heard, {lag: 0});
  assert.equal(got.matched, 2);
  const g = got.lines[1];
  assert.ok(g.guess && g.s > got.lines[0].sung.at(-1) && g.e <= got.lines[2].s, JSON.stringify(g));
  const work = applyAligned([{id: 'a', text: '歌が言葉を', s: 0, e: 1}, {id: 'b', text: 'モーション ラボ', s: 1, e: 2, sung: [1, 1, 1, 1, 1, 1, 1]}, {id: 'c', text: '連れていく', s: 2, e: 3}], got);
  assert.ok(work[0].sung && work[2].sung, 'heard lines get letter times');
  assert.equal(work[1].sung, undefined, 'a guessed line keeps no letter times (the voice search fills them)');
  assert.equal(work[1].id, 'b'); assert.equal(work[1].s, g.s);
  assert.match(alignNote(got), /3 行のうち 2 行/);
});

test('alignLyrics: junk heard before the song (a hallucinated credit line) does not pull a line to it', () => {
  const lines = [{text: '君の名前を'}, {text: '呼んでいる'}];
  const heard = [...sing('作詞作曲の名前', 0), ...sing('君の名前を', 20), ...sing('呼んでいる', 23)];
  const got = alignLyrics(lines, heard, {lag: 0});
  near(got.lines[0].s, 20); near(got.lines[1].s, 23);
});

test('alignLyrics: nothing heard → nothing matched, times untouched, and the note says so', () => {
  const lines = [{text: 'あいう'}, {text: 'えお'}];
  const got = alignLyrics(lines, [], {lag: 0});
  assert.equal(got.matched, 0);
  assert.ok(got.lines.every(l => l.s == null));
  const work = [{id: 'x', text: 'あいう', s: 1, e: 2}, {id: 'y', text: 'えお', s: 3, e: 4}];
  assert.deepEqual(applyAligned(work, got), work);
  assert.match(alignNote(got), /聞き取れなかった/);
});

test('alignLyrics: the last line ends before the end of the song, every line ends after it starts, lines never overlap', () => {
  const lines = [{text: 'もうすぐ'}, {text: 'ほら ひらく'}, {text: 'また会おう'}];
  const heard = [...sing('もうすぐ', 1), ...sing('ほらひらく', 3, .2), ...sing('また会おう', 9.5)];
  const got = alignLyrics(lines, heard, {lag: 0, duration: 11});
  got.lines.forEach((l, i) => { assert.ok(l.e > l.s); if (i) assert.ok(l.s >= got.lines[i - 1].e); });
  assert.ok(got.lines[2].e <= 11);
});

test('lyricsBefore: the prompt for a window heard again is the lyrics up to the last line heard; before anything was heard, no prompt (lines not sung yet would be copied)', () => {
  const texts = ['夜のホームで', '光を待つ', '消えない声が', 'まだ残る', '遠くへ走り出す', '星を数えて'];
  assert.equal(lyricsBefore(texts, []), '');
  assert.equal(lyricsBefore(texts, sing('作詞作曲', 0)), '');
  assert.equal(lyricsBefore(texts, [...sing('夜のホームで', 1), ...sing('光を待つ', 3)], {lines: 2}), '夜のホームで 光を待つ');
  assert.equal(lyricsBefore(texts, sing('遠くへ走り出す', 9), {lines: 3}), '消えない声が まだ残る 遠くへ走り出す');
});

test('cutLoops: the same few tokens over and over are cut after the first time; a word sung twice is kept', () => {
  assert.deepEqual(cutLoops([1, 2, 3, 3, 3, 3, 3, 3, 3]), {ids: [1, 2, 3], cut: true});
  assert.deepEqual(cutLoops([9, 4, 5, 4, 5, 4, 5, 4, 5, 4, 5, 8]), {ids: [9, 4, 5], cut: true});
  assert.deepEqual(cutLoops([1, 2, 1, 2, 7]), {ids: [1, 2, 1, 2, 7], cut: false});
});

test('readWindow: closed segments are kept and the next window starts after the window; an open last segment is heard again from its start', () => {
  const TS = 100, tsOf = s => TS + Math.round(s / .02);
  const closed = [tsOf(0), 1, 2, tsOf(2), tsOf(2), 3, tsOf(4)];
  const a = readWindow(closed, [0, .1, .5, 2, 2, 2.4, 4], {tsBegin: TS, textEnd: 50, winSec: 30});
  assert.deepEqual(a.pieces.map(p => p.id), [1, 2, 3]); assert.equal(a.consumed, 30);
  const open = [tsOf(0), 1, tsOf(3), tsOf(12), 2, 3];
  const b = readWindow(open, [0, .1, 3, 12, 12.2, 12.5], {tsBegin: TS, textEnd: 50, winSec: 30});
  assert.deepEqual(b.pieces.map(p => p.id), [1]); near(b.consumed, 12);
});

test('piecesToChars: a letter split over two tokens is put together; a token with two letters shares its time span', () => {
  const words = {1: '夜', 2: '�', 3: 'ホー', 23: 'の'};   // 2 と 3 の組で「の」ではなく、2+3 →「のホー」のつもりの例
  const decode = ids => ids.length === 2 && ids[0] === 2 && ids[1] === 3 ? 'のホー' : ids.map(i => words[i]).join('');
  const chars = piecesToChars([{id: 1, t: 1, next: 1.4}, {id: 2, t: 1.4, next: 1.5}, {id: 3, t: 1.5, next: 2.3}], decode);
  assert.deepEqual(chars.map(c => c.ch), ['夜', 'の', 'ホ', 'ー']);
  near(chars[0].t, 1); near(chars[1].t, 1.4); near(chars[2].t, 1.4 + .3); near(chars[3].t, 1.4 + .6);
});

test('the model is the Whisper with letter times (cross-attentions), 8-bit, and the files the cache check looks for match the dtype', () => {
  assert.match(WHISPER.model, /whisper-.*_timestamped$/);
  assert.deepEqual(WHISPER.dtype, {encoder_model: 'q8', decoder_model_merged: 'q8'});
  assert.deepEqual(WHISPER.files, ['onnx/encoder_model_quantized.onnx', 'onnx/decoder_model_merged_quantized.onnx']);
  assert.ok(WHISPER.mb >= 200 && WHISPER.mb <= 300);
});
