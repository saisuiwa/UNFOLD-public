import test from 'node:test';
import assert from 'node:assert/strict';
import { GALLERY_STYLES, GALLERY_MOVES, cleanGallery, styleOf, galleryGap, galleryZoom, galleryPose, galleryMoveFor, planeOpacity } from '../../app/gallery-walk.js';
import { borderOf } from '../../app/frame-stage.js';

test('the gallery settings are cleaned: off by default, a known style, numbers in range', () => {
  assert.deepEqual(cleanGallery(), { enabled: false, style: 'mix', size: .8, pop: .15, lead: .5, move: 'walk' });
  assert.deepEqual(cleanGallery({ enabled: 'x', style: 'velvet', size: 2, pop: -1, lead: 9, move: 'teleport' }), { enabled: false, style: 'mix', size: .95, pop: 0, lead: 1, move: 'walk' });
  assert.deepEqual(cleanGallery({ enabled: true, style: 'wood', size: .6, pop: .5, lead: 0, move: 'auto' }), { enabled: true, style: 'wood', size: .6, pop: .5, lead: 0, move: 'auto' });
  assert.equal(GALLERY_STYLES[0][0], 'mix');
  assert.deepEqual([0, 1, 2, 3, 4].map(i => styleOf('mix', i)), ['gold', 'wood', 'black', 'white', 'gold']);
  assert.equal(styleOf('black', 3), 'black');
});

test('every frame style fits the view at the chosen size, and the frames do not touch', () => {
  const w = 5.25, h = w * 9 / 16, z = galleryZoom(9.6, 5.4, w, h, .8);
  for (const s of ['gold', 'wood', 'black', 'white']) { const b = borderOf(s, w, h); assert.ok((w + 2 * b) * z <= 9.6 * .8 + 1e-9 && (h + 2 * b) * z <= 5.4 * .8 + 1e-9, s); }
  assert.ok(galleryGap(w) > w + 2 * borderOf('white', w, h) + .5, 'a gap of wall between two frames');
});

test('a held picture hangs in its own frame; a change carries it to the next frame, and the camera goes with it', () => {
  assert.deepEqual(galleryPose(2, false), { x: 2, lift: 0, focus: 2, lead: 0 });
  const start = galleryPose(1, true, 0, 0), end = galleryPose(1, true, 1, 1);
  assert.ok(Math.abs(start.x - 1) < 1e-9 && Math.abs(start.focus - 1) < 1e-9 && Math.abs(start.lead) < 1e-9, 'starts in frame 1, the camera on it');
  assert.ok(Math.abs(end.x - 2) < 1e-9 && Math.abs(end.focus - 2) < 1e-9 && Math.abs(end.lead) < 1e-9 && Math.abs(end.lift) < 1e-9, 'ends in frame 2, the camera on it');
  let lastX = 1, lastF = 1;
  for (let u = 0; u <= 1.0001; u += .05) { const p = galleryPose(1, true, u, u); assert.ok(p.x >= lastX - 1e-9 && p.focus >= lastF - 1e-9 && p.lift >= -1e-9 && p.lead >= -1e-9 && p.lead <= 1 + 1e-9); assert.ok(Math.abs(p.focus - p.x) < .32, `the camera stays with the solid (u ${u.toFixed(2)})`); lastX = p.x; lastF = p.focus; }
  assert.ok(galleryPose(1, true, .5, .5).lift > 0 && galleryPose(1, true, .5, .5).lead > .9, 'half way: lifted, the camera walking');
  assert.equal(galleryPose(1, true, .7, .7, 'reveal').x, 1, 'a reveal breaks away where it hangs');
  assert.ok(Math.abs(galleryPose(1, true, .5, .9, 'through').x - 1.5) < 1e-9, 'without a solid the pieces cross in the middle of the change (its own time, not the solid\'s)');
});

test('the frames behind keep their pictures, the one being left gets its picture back, the ones ahead wait dark', () => {
  assert.deepEqual([0, 1, 2, 3].map(j => planeOpacity(j, 1, false)), [1, 0, 0, 0], 'holding picture 2: it is the mesh itself; ahead is dark');
  assert.deepEqual([0, 1, 2, 3].map(j => planeOpacity(j, 1, true, .2)), [1, 0, 0, 0], 'just left: its frame is empty');
  assert.deepEqual([0, 1, 2, 3].map(j => planeOpacity(j, 1, true, .95)), [1, 1, 0, 0], 'later: the picture is back in the frame it left; the next is the mesh landing');
  assert.equal(planeOpacity(2, 1, true, .3, 'reveal'), 1, 'a reveal\'s next picture already hangs there');
});

test('移る時の動き: 立体に合わせる picks by the shape id or its name; a project saved before keeps the usual crossing', () => {
  assert.deepEqual(GALLERY_MOVES.map(([id]) => id), ['walk', 'auto', 'zoom', 'float', 'beat', 'hop', 'swim']);
  const cases = [['heart', '', 'beat'], ['c-hearts', '', 'beat'], ['c-balloons', '風船', 'float'], ['glb-1', 'ハート（鍵穴つき）', 'beat'], ['glb-2', '風船', 'float'],
    ['glb-3', '熱気球', 'float'], ['glb-4', 'クラゲ', 'float'], ['glb-5', '紙飛行機', 'zoom'], ['glb-6', 'ロケット', 'zoom'], ['glb-7', 'ワシ', 'zoom'], ['pegasus', 'ペガサス', 'zoom'],
    ['glb-8', 'ウサギ', 'hop'], ['glb-9', '猫', 'hop'], ['glb-10', 'クジラ', 'swim'], ['glb-11', 'イルカ', 'swim'], ['glb-12', 'my_airplane', 'zoom'], ['sphere', '球', 'walk'], ['glb-13', 'お城', 'walk']];
  for (const [shape, name, want] of cases) assert.equal(galleryMoveFor('auto', shape, name), want, `${shape} ${name}`);
  assert.equal(galleryMoveFor('float', 'heart', 'ハート'), 'float', 'a chosen move is used for every shape');
  assert.equal(galleryMoveFor(undefined, 'heart'), 'walk');
  assert.equal(galleryMoveFor('teleport', 'heart'), 'walk');
});

test('every move starts in frame i and ends in frame i+1 at rest, with the camera on it, and never loses the solid', () => {
  const warp = x => x;
  for (const move of ['zoom', 'float', 'beat', 'hop', 'swim']) for (const beats of [4, 8]) {
    const s = galleryPose(1, true, 0, 0, '', { move, beats, warp }), e = galleryPose(1, true, 1, 1, '', { move, beats, warp });
    for (const [p, at] of [[s, 1], [e, 2]]) {
      assert.ok(Math.abs(p.x - at) < 1e-9 && Math.abs(p.focus - at) < 1e-9 && Math.abs(p.lift) < 1e-9 && Math.abs(p.lead) < 1e-9, `${move} ${beats}: at frame ${at}`);
      assert.ok(Math.abs(p.rx) + Math.abs(p.ry) + Math.abs(p.rz) < 1e-9 && Math.abs(p.sx - 1) + Math.abs(p.sy - 1) + Math.abs(p.sz - 1) < 1e-9 && Math.abs(p.camY) < 1e-9 && Math.abs(p.camZoom - 1) < 1e-9, `${move}: at rest`);
    }
    for (let k = 0; k <= 400; k++) { const u = k / 400, p = galleryPose(1, true, u, u, '', { move, beats, warp });
      assert.ok(Math.abs(p.focus - p.x) < .2, `${move}: the camera keeps the solid in view (u ${u})`);
      assert.ok(Math.abs(p.lift - p.camY) < .4, `${move}: not lost above or below (u ${u})`); }
  }
  assert.ok(galleryPose(1, true, .7, .7, 'through', { move: 'zoom' }).rz === undefined, 'without a solid the pieces cross as before');
});

test('ビューン dashes (wind lines), ふわふわ rises, ぴょんぴょん hops three times, すいすい goes in an S', () => {
  const at = (move, u, beats = 4) => galleryPose(0, true, u, u, '', { move, beats });
  let top = 0, back = 0; for (let u = 0; u <= 1; u += .005) { const p = at('zoom', u); top = Math.max(top, p.speed); back = Math.min(back, p.x); }
  assert.ok(top > .95 && back < -.05, 'a wind-up back, then the dash at full speed');
  assert.ok(at('zoom', .51).sx > 1.2 && at('zoom', .51).rz < -.15, 'stretched and leaning into the dash');
  assert.ok(at('float', .51).lift > .35 && at('float', .51).camY > .2, 'high up, the camera rising with it');
  let hops = 0, prev = 0; for (let u = 0; u <= 1; u += .002) { const l = at('hop', u).lift; if (l > .05 && prev <= .05) hops++; prev = l; }
  assert.equal(hops, 3);
  assert.ok(at('swim', .4).lift > .05 && at('swim', .6).lift < -.05, 'up, then down');
});

test('ドクンドクン thumps on the song\'s half beats and moves only on the thumps', () => {
  const beats = 4, at = u => galleryPose(0, true, u, u, '', { move: 'beat', beats });
  const thump = b => at(b / beats + .03 / beats / 2).sx;   // just after a half beat
  assert.ok(thump(1.5) > 1.15 && thump(2) > 1.15 && thump(2.5) > 1.15, 'a big thump on each half beat while it crosses');
  assert.ok(Math.abs(at(1.5 / beats + .42 * .5 / beats).x - at(1.5 / beats + .95 * .5 / beats).x) < .002, 'between the thumps it stays still');
  assert.ok(at(2.0 / beats + .2 * .5 / beats).x > at(2.0 / beats).x + .05, 'and is shoved on by them');
});
