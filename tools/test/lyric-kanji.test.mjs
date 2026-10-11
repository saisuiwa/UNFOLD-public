import test from 'node:test';
import assert from 'node:assert/strict';
import {kanjiRequest,readKanjiAnswer,checkKanjiAnswer,KANJI_REQUEST_HEAD} from '../../app/lyric-kanji.js';

const BEFORE=['いちまいの えを ここにおいて','ぐしゃっと *くずれて* ほどけだす','こなごなの いろが/ふりそそぐ'];

test('the request holds the rules and the lyric lines, one per line, in order', () => {
 const text=kanjiRequest(BEFORE);
 assert.ok(text.startsWith(KANJI_REQUEST_HEAD));
 assert.match(text,/行数と行の順番は変えない/);assert.match(text,/\* と \/ の記号/);
 assert.deepEqual(text.split('--- 歌詞 ---\n')[1].trim().split('\n'),BEFORE);
});

test('the answer is cleaned: fences, numbering, blank lines and an echoed header are dropped', () => {
 const fenced='```\n一枚の 絵を ここに置いて\n\nぐしゃっと *崩れて* ほどけだす\n\nこなごなの 色が/降りそそぐ\n```\n';
 assert.deepEqual(readKanjiAnswer(fenced),['一枚の 絵を ここに置いて','ぐしゃっと *崩れて* ほどけだす','こなごなの 色が/降りそそぐ']);
 const numbered='1. 一枚の 絵を\n2. 崩れて\n3) 降りそそぐ';
 assert.deepEqual(readKanjiAnswer(numbered),['一枚の 絵を','崩れて','降りそそぐ']);
 const echoed=KANJI_REQUEST_HEAD+'一枚の 絵を ここに置いて\nぐしゃっと *崩れて* ほどけだす\nこなごなの 色が/降りそそぐ';
 assert.equal(readKanjiAnswer(echoed).length,3,'the request that was pasted back with the answer is cut off');
 assert.deepEqual(readKanjiAnswer('1行目だけ\n普通の行'),['1行目だけ','普通の行'],'text that merely starts with a digit is kept');
});

test('the line count decides: a different count is refused with the numbers', () => {
 const r=checkKanjiAnswer(BEFORE,'一枚の 絵を\n崩れて');
 assert.equal(r.ok,false);assert.match(r.problems[0],/歌詞は 3 行、貼り付けは 2 行/);
 assert.equal(checkKanjiAnswer(BEFORE,'  \n').ok,false);
});

test('a matching answer is paired line by line, counted, and its marks are compared with the original', () => {
 const good=checkKanjiAnswer(BEFORE,'一枚の 絵を ここに置いて\nぐしゃっと *崩れて* ほどけだす\nこなごなの 色が/降りそそぐ');
 assert.equal(good.ok,true);assert.equal(good.changed,3);assert.deepEqual(good.warnings,[]);
 assert.deepEqual(good.pairs.map(p=>p.index),[0,1,2]);assert.equal(good.pairs[1].before,BEFORE[1]);
 const lost=checkKanjiAnswer(BEFORE,'一枚の 絵を ここに置いて\nぐしゃっと 崩れて ほどけだす\nこなごなの 色が降りそそぐ');
 assert.equal(lost.ok,true);assert.equal(lost.warnings.length,2);assert.match(lost.warnings[0],/2行目/);assert.match(lost.warnings[1],/3行目/);
 const same=checkKanjiAnswer(BEFORE,BEFORE.join('\n'));
 assert.equal(same.ok,true);assert.equal(same.changed,0);assert.match(same.warnings[0],/元と同じ/);
});
