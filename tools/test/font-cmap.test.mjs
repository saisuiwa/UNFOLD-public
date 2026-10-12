import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fontCoverage } from '../../app/font-cmap.js';
import { wantsFontPool } from '../../app/code-motion-runtime.js';
import { DAILY_CODE_MOTIONS } from '../../app/code-motion-daily.js';

const FONTS = ['gothic', 'mincho', 'round', 'marker', 'dela', 'dot'];
const load = key => { const b = readFileSync(new URL(`../../app/vendor/motion-fonts/${key}.ttf`, import.meta.url)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };

test('every bundled font says it has kana, ASCII and common kanji, and has no emoji', () => {
  for (const key of FONTS) {
    const has = fontCoverage(load(key));
    for (const ch of 'あアAa幻想音顔') assert.equal(has(ch.codePointAt(0)), true, `${key} should have ${ch}`);
    assert.equal(has(0x1f600), false, `${key} has no emoji`);
    assert.equal(has(0x10ffff), false);
  }
});

test('the fonts do differ in what they cover (the check is real, not "always true")', () => {
  const rare = [0x20bb7, 0x9b31, 0x9f8d, 0x7e8b];     // 𠮷 鬱 龍 纋
  const counts = FONTS.map(key => { const has = fontCoverage(load(key)); return rare.filter(cp => has(cp)).length; });
  assert.ok(new Set(counts).size > 1 || counts.some(c => c < rare.length), `coverage of rare characters: ${counts}`);
});

test('a broken or empty buffer covers nothing and does not throw', () => {
  assert.equal(fontCoverage(new ArrayBuffer(0))(65), false);
  assert.equal(fontCoverage(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]).buffer)(65), false);
  const half = load('gothic').slice(0, 300);
  assert.equal(typeof fontCoverage(half)(65), 'boolean');
});

test('a motion asks for the font pool with a "// @fonts" line, and only then', () => {
  assert.equal(wantsFontPool('// @fonts\nconst {createText}=api;'), true);
  assert.equal(wantsFontPool('const a=1;\n  // @fonts  切り貼り\nreturn {};'), true);
  assert.equal(wantsFontPool('// fonts are nice\nconst a=1;'), false);
  assert.equal(wantsFontPool('const x="// @fonts";'), false);
});

test('the three 切り貼り文字 motions are in the shelf, ask for the pool and differ only in speed and shake', () => {
  const m = DAILY_CODE_MOTIONS.filter(x => x.key.startsWith('ransom-'));
  assert.deepEqual(m.map(x => x.key), ['ransom-slow', 'ransom-paste', 'ransom-rapid']);
  for (const x of m) {
    assert.equal(wantsFontPool(x.source), true, x.key);
    assert.doesNotMatch(x.source, /__[A-Z]+__/, `${x.key}: a placeholder was left`);
    assert.ok(x.name.length <= 20 && x.desc.length >= 10 && x.desc.length <= 60 && x.desc.endsWith('。'), x.key);
  }
  const div = x => Number(/DIV=(\d+)/.exec(x.source)[1]);
  assert.deepEqual(m.map(div), [1, 2, 4]);
});
