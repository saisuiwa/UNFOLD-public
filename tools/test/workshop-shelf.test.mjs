import test from 'node:test';
import assert from 'node:assert/strict';
import { viewOf } from '../../app/workshop-data.js';
import { cleanWorkshopSettings, settingsOf } from '../../app/workshop-settings.js';
import { CODE_MOTION_PRESETS } from '../../app/code-motion-presets.js';
import { DAILY_CODE_MOTIONS } from '../../app/code-motion-daily.js';
import { effectPrompt } from '../../app/effect-prompt.js';

test('the workshop tab of a card: effects are text code motions shown on their own tab', () => {
  assert.equal(viewOf({ kind: 'glsl' }), 'glsl');
  assert.equal(viewOf({ kind: 'image' }), 'image');
  assert.equal(viewOf({ kind: 'text' }), 'text');
  assert.equal(viewOf({ kind: 'text', shelf: 'effect' }), 'effect');
  assert.equal(viewOf({ kind: 'glsl', shelf: 'effect' }), 'glsl', 'only code motions have a shelf');
  assert.equal(viewOf(undefined), undefined);
});

test('every effect of the preset list lands on the effect tab and every other preset on the text tab', () => {
  const effects = DAILY_CODE_MOTIONS.filter(m => m.shelf === 'effect');
  assert.ok(effects.length >= 18, 'the shader decorations and the keycaps are effects');
  const asCards = CODE_MOTION_PRESETS.map(s => ({ kind: 'text', name: s.name, ...(s.shelf === 'effect' ? { shelf: 'effect' } : {}) }));   // as workshop.js builds them
  assert.equal(asCards.filter(c => viewOf(c) === 'effect').length, effects.length);
  assert.equal(asCards.filter(c => viewOf(c) === 'text').length, CODE_MOTION_PRESETS.length - effects.length);
  assert.ok(asCards.filter(c => viewOf(c) === 'text').length >= 3, 'the Mac-made presets stay with the text motions');
});

test('the shelf of a saved or exported item is kept, and nothing else is accepted', () => {
  assert.deepEqual(settingsOf({ kind: 'text', words: 'a', shelf: 'effect' }), { shelf: 'effect', words: 'a' });
  assert.deepEqual(settingsOf({ kind: 'text', words: 'a' }), { words: 'a' });
  assert.deepEqual(cleanWorkshopSettings({ shelf: 'effect' }), { shelf: 'effect' });
  assert.throws(() => cleanWorkshopSettings({ shelf: 'motion' }));
  assert.throws(() => cleanWorkshopSettings({ shelf: 'effect', unknown: 1 }));
});

test('the AI request for an effect adds what an effect needs and keeps the sample after it', () => {
  const text = effectPrompt();
  assert.match(text, /エフェクトとして作る場合/);
  assert.match(text, /ShaderMaterial/);
  assert.match(text, /overflowWrap/);
  assert.ok(text.indexOf('エフェクトとして作る場合') < text.indexOf('参考:'), 'the effect guidance comes before the reference code');
  assert.ok(text.endsWith('希望する演出：'));
});
