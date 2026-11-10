import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanToon, applyToon, lineAt, TOON_LINE } from '../../app/toon-look.js';

test('the setting is off at first, and anything odd in a saved one falls back', () => {
  assert.deepEqual(cleanToon(), { enabled: false, cel: true, shade: .45, line: .5, colour: TOON_LINE, beat: false });
  assert.deepEqual(cleanToon({ enabled: true, cel: false, shade: 3, line: -1, colour: 'red', beat: 1 }), { enabled: true, cel: false, shade: .8, line: 0, colour: TOON_LINE, beat: false });
  assert.equal(cleanToon({ colour: '#FF8800' }).colour, '#ff8800');
  assert.deepEqual(cleanToon(cleanToon({ enabled: true, shade: .3, line: .9, colour: '#123456', beat: true })), { enabled: true, cel: true, shade: .3, line: .9, colour: '#123456', beat: true });
});

test('the shader gets two steps of light only while the look and its cel shading are on', () => {
  const u = {};
  applyToon(u, { enabled: true, shade: .6 }); assert.deepEqual([u.uToon.value, u.uToonShade.value], [1, .6]);
  applyToon(u, { enabled: true, cel: false }); assert.equal(u.uToon.value, 0);
  applyToon(u, { enabled: false }); assert.equal(u.uToon.value, 0);
  applyToon(u, { enabled: true }, false); assert.equal(u.uToon.value, 0, 'a page that cannot draw the look (image code) keeps it off');
});

test('the line is there only while the solid is whole', () => {
  const on = { enabled: true };
  assert.equal(lineAt(on, 1).strength, 1);
  for (const form of [0, .5, .92, .997, .9996]) assert.equal(lineAt(on, form).strength, 0, `no line at form ${form}: the pieces are still apart`);
  assert.equal(lineAt({ enabled: false }, 1).strength, 0);
  assert.equal(lineAt({ enabled: true, line: 0 }, 1).strength, 0, 'width 0 = cel shading alone');
  assert.ok(lineAt({ enabled: true, line: 1 }, 1).width > lineAt({ enabled: true, line: .2 }, 1).width);
  assert.deepEqual(lineAt({ enabled: true, colour: '#ff0000' }, 1).colour, [1, 0, 0]);
});

test('with 拍で光る the line swells and takes a bright colour on the beat, and calms down before the next', () => {
  const plain = lineAt({ enabled: true }, 1, 4), flash = { enabled: true, beat: true };
  const on = lineAt(flash, 1, 4), late = lineAt(flash, 1, 4.9), next = lineAt(flash, 1, 5);
  assert.deepEqual(plain, lineAt({ enabled: true }, 1), 'without it the beat changes nothing');
  assert.ok(on.width > plain.width * 1.8 && late.width < plain.width * 1.05, `${on.width} → ${late.width}`);
  const bright = c => Math.max(...c);
  assert.ok(bright(on.colour) > .8 && bright(late.colour) < bright(on.colour), 'bright on the beat');
  assert.notDeepEqual(on.colour.map(v => v.toFixed(2)), next.colour.map(v => v.toFixed(2)), 'another colour on the next beat');
  assert.deepEqual(lineAt(flash, 1, null), plain, 'no beat (the single picture page): the plain line');
  for (const c of [on, late, next]) assert.ok(c.colour.every(v => v >= 0 && v <= 1));
});
