import test from 'node:test';
import assert from 'node:assert/strict';
import { lookView, lookViewText } from '../../app/look-view.js';

test('auto follows the phase under the playhead', () => {
  assert.equal(lookView('auto', 'chaos'), 'chaos');
  assert.equal(lookView('auto', 'form'), 'form');
});

test('outside chaos and form the picture is simply shown: image', () => {
  assert.equal(lookView('auto', null), 'image');
  assert.equal(lookView('auto', undefined), 'image');
});

test('all mode ignores the phase', () => {
  assert.equal(lookView('all', 'chaos'), 'all');
  assert.equal(lookView('all', 'form'), 'all');
  assert.equal(lookView('all', null), 'all');
});

test('the text names the current view', () => {
  assert.equal(lookViewText('chaos').label, 'いま：ぐちゃぐちゃ');
  assert.equal(lookViewText('form').label, 'いま：立体化');
  assert.equal(lookViewText('image').label, 'いま：画像');
  assert.equal(lookViewText('all').label, 'すべての設定を表示中');
});

test('only the image view carries the hint about moving to a ◆ section', () => {
  assert.match(lookViewText('image').hint, /◆の区間/);
  for (const v of ['chaos', 'form', 'all']) assert.equal(lookViewText(v).hint, '');
});
