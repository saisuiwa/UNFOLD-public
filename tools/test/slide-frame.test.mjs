import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanFrame, croppedCanvas, framePlacement, aspectCrop, needsFrame, coverLoss, describeFrame, frameFromChoice } from '../../app/slide-frame.js';

const W = 1920, H = 1080;
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} is not ${b}`);
// what fitCanvas drew before slides had a frame: the whole picture, scaled by max (fill) or min (not fill), centred
const before = (iw, ih, fill) => { const s = (fill ? Math.max : Math.min)(W / iw, H / ih), w = iw * s, h = ih * s; return { dx: (W - w) / 2, dy: (H - h) / 2, dw: w, dh: h }; };

test('no frame draws exactly what the old code drew, for every shape and both settings', () => {
  for (const [iw, ih] of [[1920, 1080], [1080, 1920], [3000, 1000], [1000, 1000], [4032, 3024], [640, 360]]) {
    for (const fill of [true, false]) {
      const p = framePlacement(iw, ih, undefined, fill, W, H), o = before(iw, ih, fill);
      assert.deepEqual([p.sx, p.sy, p.sw, p.sh], [0, 0, iw, ih]);
      for (const k of ['dx', 'dy', 'dw', 'dh']) close(p[k], o[k]);
    }
  }
});

test('the reported cut-off: a portrait picture that fills the frame loses its top and bottom, a contained one does not', () => {
  const cut = framePlacement(1080, 1920, undefined, true, W, H);
  assert.ok(cut.dh > H, 'the picture is taller than the frame, so its top and bottom are cut off');
  const whole = framePlacement(1080, 1920, { fit: 'contain' }, true, W, H);   // the frame's own fit wins over the project-wide setting
  close(whole.dh, H);
  assert.ok(whole.dw < W && whole.dx > 0);
});

test('a frame\'s own fit wins over the project-wide setting, in both directions', () => {
  assert.equal(framePlacement(1000, 1000, { fit: 'contain' }, true, W, H).dh, H);
  assert.ok(framePlacement(1000, 1000, { fit: 'cover' }, false, W, H).dh > H);
});

test('a crop with the frame\'s shape fills the frame exactly, whatever the fit says', () => {
  const crop = aspectCrop(1080, 1920, W / H);
  for (const fit of ['cover', 'contain', undefined]) {
    const p = framePlacement(1080, 1920, { fit, crop }, false, W, H);
    close(p.dx, 0, 1e-3); close(p.dy, 0, 1e-3); close(p.dw, W, 1e-3); close(p.dh, H, 1e-3);
  }
});

test('a crop of another shape: contain shows all of it, cover fills the frame', () => {
  const crop = { x: .25, y: .25, w: .5, h: .5 };                      // a square of a 3000×1000 picture is 1500×500: a 3:1 strip
  const keep = framePlacement(3000, 1000, { fit: 'contain', crop }, true, W, H);
  close(keep.sw, 1500); close(keep.sh, 500); close(keep.dw, W); close(keep.dh, W / 3); assert.ok(keep.dy > 0);
  const fill = framePlacement(3000, 1000, { fit: 'cover', crop }, true, W, H);
  close(fill.dh, H); assert.ok(fill.dw > W);
});

test('aspectCrop: the largest part with that shape, centred, smaller with zoom, kept inside the picture', () => {
  const full = aspectCrop(1080, 1920, W / H);                           // a portrait picture: full width, a 16:9 band of it
  close(full.x, 0); close(full.w, 1); close(full.h, 1080 * 9 / 16 / 1920); close(full.y + full.h / 2, .5);
  const zoomed = aspectCrop(1080, 1920, W / H, { zoom: 2 });
  close(zoomed.w, .5); close(zoomed.h, full.h / 2);
  const corner = aspectCrop(1080, 1920, W / H, { cx: 0, cy: 0, zoom: 2 });
  close(corner.x, 0); close(corner.y, 0);                               // asking for a centre near the edge is moved inwards
  const far = aspectCrop(1080, 1920, W / H, { cx: 9, cy: 9, zoom: 2 });
  close(far.x + far.w, 1); close(far.y + far.h, 1);
  const wide = aspectCrop(3000, 1000, W / H);                           // an ultra-wide picture: full height, a narrower slice
  close(wide.h, 1); close(wide.w, 1000 * 16 / 9 / 3000);
  assert.ok(aspectCrop(1000, 1000, 1, { zoom: 0 }).w <= 1, 'a bad zoom is read as 1');
  const ratio = c => (c.w * 3000) / (c.h * 1000);
  close(ratio(wide), W / H, 1e-9);
});

test('cleanFrame keeps a good frame, rounds it, and drops everything else', () => {
  assert.deepEqual(cleanFrame({ fit: 'cover', crop: { x: .1, y: .2, w: .5, h: .4 } }), { fit: 'cover', crop: { x: .1, y: .2, w: .5, h: .4 } });
  assert.deepEqual(cleanFrame({ fit: 'contain' }), { fit: 'contain' });
  assert.deepEqual(cleanFrame({ crop: { x: .123456, y: 0, w: .5, h: .5 } }), { crop: { x: .1235, y: 0, w: .5, h: .5 } });
  for (const bad of [undefined, null, 0, 'cover', [], {}, { fit: 'stretch' }, { crop: null }, { crop: { x: 'a', y: 0, w: 1, h: 1 } }, { crop: { x: NaN, y: 0, w: .5, h: .5 } }]) assert.equal(cleanFrame(bad), undefined, JSON.stringify(bad));
  assert.deepEqual(cleanFrame({ fit: 'stretch', crop: { x: 0, y: 0, w: .5, h: .5 } }), { crop: { x: 0, y: 0, w: .5, h: .5 } });
});

test('cleanFrame keeps the crop inside the picture and above the minimum size', () => {
  const c = cleanFrame({ crop: { x: .9, y: -1, w: .5, h: 0 } }).crop;
  assert.ok(c.x >= 0 && c.x + c.w <= 1 + 1e-9 && c.y >= 0 && c.y + c.h <= 1 + 1e-9);
  assert.ok(c.w >= .02 && c.h >= .02);
  assert.equal(cleanFrame({ crop: { x: 0, y: 0, w: 1, h: 1 } }), undefined, 'the whole picture is no crop');
  assert.equal(cleanFrame({ crop: { x: 0, y: 0, w: 5, h: 5 } }), undefined);
  assert.deepEqual(cleanFrame({ fit: 'cover', crop: { x: 0, y: 0, w: 1, h: 1 } }), { fit: 'cover' });
});

test('a frame survives JSON (the .unfold file and the autosave) unchanged', () => {
  const f = cleanFrame({ fit: 'cover', crop: aspectCrop(1080, 1920, W / H, { cx: .4, cy: .3, zoom: 1.7 }) });
  assert.deepEqual(cleanFrame(JSON.parse(JSON.stringify(f))), f);
});

test('needsFrame: the frame\'s own shape and near misses are left alone, the rest is asked about', () => {
  assert.equal(needsFrame(1920, 1080, W, H), false);
  assert.equal(needsFrame(1280, 720, W, H), false);
  assert.equal(needsFrame(1920, 1088, W, H), false, 'a 16:9.07 picture loses 2% at most');
  assert.equal(needsFrame(2880, 1800, W, H), true, '16:10, a Mac screenshot');
  assert.equal(needsFrame(4032, 3024, W, H), true, '4:3, a camera');
  assert.equal(needsFrame(1080, 1920, W, H), true, '9:16');
  assert.equal(needsFrame(3000, 1000, W, H), true, '3:1');
  assert.equal(needsFrame(1000, 1000, W, H), true, '1:1');
  for (const [w, h] of [[0, 0], [NaN, 10], [10, 0], [undefined, undefined]]) assert.equal(needsFrame(w, h, W, H), false);
  close(coverLoss(1080, 1920, W, H), 1 - (1080 / 1920) / (16 / 9));
  close(coverLoss(1920, 1080, W, H), 0);
});

test('describeFrame says what the slide does', () => {
  assert.match(describeFrame(undefined, true), /全体設定どおり（画面いっぱい）/);
  assert.match(describeFrame(undefined, false), /全体設定どおり（全体を見せる）/);
  assert.match(describeFrame({ fit: 'contain' }, true), /全体を見せる/);
  assert.match(describeFrame({ fit: 'cover' }, false), /画面いっぱい/);
  assert.match(describeFrame({ fit: 'cover', crop: { x: 0, y: 0, w: .5, h: .5 } }, false), /切り抜いて、画面いっぱい/);
  assert.match(describeFrame({ crop: { x: 0, y: 0, w: .5, h: .5 } }, false), /切り抜いて、全体を見せる/);
});

test('frameFromChoice carries one choice over to a picture of another shape', () => {
  assert.deepEqual(frameFromChoice({ mode: 'whole' }, 1080, 1920, W, H), { fit: 'contain' });
  assert.deepEqual(frameFromChoice(undefined, 1080, 1920, W, H), { fit: 'contain' });
  const portrait = frameFromChoice({ mode: 'screen', cx: .5, cy: .25, zoom: 1 }, 1080, 1920, W, H);
  assert.equal(portrait.fit, 'cover'); close(portrait.crop.w, 1); close(portrait.crop.y + portrait.crop.h / 2, .25);
  const wide = frameFromChoice({ mode: 'screen', cx: .5, cy: .5, zoom: 1 }, 3000, 1000, W, H);
  close(wide.crop.h, 1); close(wide.crop.w, 1000 * 16 / 9 / 3000, 1e-4);
  assert.deepEqual(frameFromChoice({ mode: 'screen', cx: .5, cy: .5, zoom: 1 }, 1920, 1080, W, H), { fit: 'cover' }, 'a picture of the frame\'s shape needs no crop');
});

test('croppedCanvas: the kept part as a canvas, or the picture itself when nothing is cut out', () => {
  const calls = [], make = () => ({ getContext: () => ({ drawImage: (...a) => calls.push(a) }) });
  const img = { width: 1000, height: 500 };
  assert.equal(croppedCanvas(img, undefined, make), img);
  assert.equal(croppedCanvas(img, { fit: 'contain' }, make), img);
  const c = croppedCanvas(img, { crop: { x: .1, y: .2, w: .5, h: .4 } }, make);
  assert.deepEqual([c.width, c.height], [500, 200]);
  assert.deepEqual(calls[0].slice(1), [100, 100, 500, 200, 0, 0, 500, 200]);
  assert.deepEqual(calls[0][0], img);
  const html = { naturalWidth: 2000, naturalHeight: 1000, width: 10, height: 5 };   // an <img> is as large as its file, whatever size the page draws it
  assert.deepEqual([croppedCanvas(html, { crop: { x: 0, y: 0, w: .5, h: .5 } }, make).width], [1000]);
});
