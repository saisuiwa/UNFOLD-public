// シーケンスの「人物の立体」(app/seq-person-relief.js): the ふくらみ used with and without a depth, the solid's swing timed to the sequence's solid,
// and the fields read back from a grey picture / a cut-out (here with a tiny stand-in for the canvas).
import test from 'node:test';
import assert from 'node:assert/strict';
import { personPuff, seqReliefTime, personSwing, personTilt, fieldShare, flatField, fieldCanvas, canvasField } from '../../app/seq-person-relief.js';
import { reliefSwing } from '../../app/relief-shape.js';

test('ふくらみ: only the puff without a depth; the ◆ value (0–1) or the default with one', () => {
  assert.equal(personPuff({ puff: .2 }, false), 1);
  assert.equal(personPuff({}, true), .5);
  assert.equal(personPuff({ puff: .2 }, true), .2);
  assert.equal(personPuff({ puff: 7 }, true), 1);
  assert.equal(personPuff({ puff: 'x' }, true), .5);
});

test('the swing runs once across the sequence solid (.45–.60) and is still outside it', () => {
  assert.equal(seqReliefTime(.45), .45); assert.ok(Math.abs(seqReliefTime(.6) - .75) < 1e-12);
  assert.equal(personSwing(.3), 0); assert.equal(personSwing(.7), 0); assert.equal(personTilt(.3), 0);
  assert.ok(Math.abs(personSwing(.5)) > .05, 'it moves while the solid is formed');
  assert.equal(personSwing(.5), reliefSwing(.55));
});

test('fields: the share inside, a flat depth, and a grey picture round trip', () => {
  assert.equal(fieldShare({ data: new Float32Array([0, 1, .9, .2]) }), .5);
  assert.equal(fieldShare(null), 0);
  const flat = flatField(); assert.equal(flat.w * flat.h, flat.data.length); assert.ok(flat.data.every(v => v === .5));
  // a tiny 2D canvas stand-in: putImageData keeps the pixels, drawImage copies them (same size only)
  const doc = { createElement: () => { const c = { width: 0, height: 0, px: null }; c.getContext = () => ({
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData: img => { c.px = img.data; },
    drawImage: src => { c.px = Uint8ClampedArray.from(src.px); }, getImageData: () => ({ data: c.px }), set imageSmoothingQuality(v) {} }); return c; } };
  const depth = { w: 3, h: 2, data: new Float32Array([0, .5, 1, .25, .75, 1.4]) };
  const grey = fieldCanvas(depth, doc), back = canvasField(grey, 0, 512, doc);
  assert.equal(back.w, 3); assert.equal(back.h, 2);
  for (let i = 0; i < 6; i++) assert.ok(Math.abs(back.data[i] - Math.min(1, depth.data[i])) < 1 / 255 + 1e-9, `pixel ${i}`);
});
