import test from 'node:test';
import assert from 'node:assert/strict';
import { mirrorInto, solidBox, wholePicture } from '../../app/person-solid.js';

test('positions outside a range fold back into it like a mirror', () => {
  assert.deepEqual([2, 3, 4, 5].map(i => mirrorInto(i, 2, 5)), [2, 3, 4, 5], 'inside: as it is');
  assert.deepEqual([1, 0, -1, -2, -3].map(i => mirrorInto(i, 2, 5)), [2, 3, 4, 5, 5], 'to the left: mirrored, then mirrored again');
  assert.deepEqual([6, 7, 8, 9, 10].map(i => mirrorInto(i, 2, 5)), [5, 4, 3, 2, 2]);
  assert.equal(mirrorInto(40, 7, 7), 7, 'a range of one');
});

// a 12×8 cut-out: a "person" of two colours in the box x 4–7, y 2–5 with a clear gap in its middle column pair
function person() {
  const W = 12, H = 8, rgba = new Uint8ClampedArray(W * H * 4);
  for (let y = 2; y <= 5; y++) for (let x = 4; x <= 7; x++) { if ((x === 5 || x === 6) && y === 3) continue; const p = (y * W + x) * 4; rgba[p] = x < 6 ? 200 : 20; rgba[p + 1] = 50; rgba[p + 2] = x < 6 ? 20 : 200; rgba[p + 3] = 255; }
  return { W, H, rgba };
}

test('the box around the person is found', () => {
  const { W, H, rgba } = person(), alpha = Uint8Array.from({ length: W * H }, (_, i) => rgba[i * 4 + 3]);
  assert.deepEqual(solidBox(alpha, W, H), { x0: 4, y0: 2, x1: 7, y1: 5 });
  assert.equal(solidBox(new Uint8Array(W * H), W, H), null);
});

test('the whole picture is made of the person alone: the person as she is, gaps from their neighbours, the rest mirrored', () => {
  const { W, H, rgba } = person(), made = wholePicture(rgba, W, H), out = made.rgba, at = (x, y) => [...out.slice((y * W + x) * 4, (y * W + x) * 4 + 4)];
  for (let i = 3; i < out.length; i += 4) assert.equal(out[i], 255, 'no clear pixel is left');
  assert.deepEqual(at(4, 2), [200, 50, 20, 255]); assert.deepEqual(at(7, 5), [20, 50, 200, 255]);
  assert.deepEqual(at(5, 3), [200, 50, 20, 255], 'the gap takes the colour next to it (left half)');
  assert.deepEqual(at(6, 3), [20, 50, 200, 255], 'and the right half its own side');
  assert.deepEqual(at(3, 2), at(4, 2), 'left of the box: its mirror image'); assert.deepEqual(at(2, 2), at(5, 2)); assert.deepEqual(at(0, 2), at(7, 2));
  assert.deepEqual(at(8, 4), at(7, 4)); assert.deepEqual(at(11, 4), at(4, 4));
  assert.deepEqual(at(4, 1), at(4, 2)); assert.deepEqual(at(4, 7), at(4, 4));
  const gapAt = (x, y) => made.gap[y * W + x];
  assert.ok(gapAt(5, 3) === 1 && gapAt(6, 3) === 1 && gapAt(4, 2) === 0 && gapAt(7, 5) === 0, 'which pixels were filled in is known');
  assert.equal(gapAt(2, 3), gapAt(5, 3), 'and it is mirrored with the picture'); assert.equal(gapAt(3, 2), 0);
  assert.equal(wholePicture(new Uint8ClampedArray(W * H * 4), W, H), null, 'nobody in the picture: nothing to make');
});
