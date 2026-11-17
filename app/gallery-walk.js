// 美術館を歩く（シーケンス、2026-11-10）: 壁に、絵の枚数だけ額縁を横に並べる。絵は額縁の中で崩れて立体になり、額縁の手前へ飛び出して
// 壁に沿って次の額縁へ飛び、飛び込んで次の絵になる。カメラは壁の横を歩く（歩く間は少し先を向く）。
//   ・今見せている絵（と、変化の途中の絵）は、いつもの絵の粒（メッシュ）が額縁の位置で描く。ほかの額縁は、絵を貼った板。
//   ・通り過ぎた額縁には絵が残る（出ていった絵は、少しして戻る）。まだ行っていない額縁は、絵が来るまで暗い。
// value = { enabled, style: 'mix'（額縁を順にかえる）か FRAME_STYLES のどれか, size: 額縁が画面に占める大きさ 0.5–0.95,
//           pop: 立体が飛び出す大きさ 0–1（はじめは 0.15）, lead: 歩く間にカメラが先を向く強さ 0–1,
//           move: 移る時の動き（GALLERY_MOVES。はじめは 'walk' = 今まで通り。'auto' = 立体の形・名前に合わせて選ぶ） }
// 移る時の動き（2026-11-17）: 飛行機はビューン、風船はふわふわ、ハートはドクンドクン（曲の拍に合わせて）、ウサギはぴょんぴょん、魚はすいすい。
//   どれも額縁 i から i+1 へ、立体がまるごとの間（いつもと同じ時間）に渡り、最初と最後はいつもと同じ所・同じ形に戻る。
import { FRAME_STYLES, MUSEUM_STYLES, borderOf, drawFrame } from './frame-stage.js?v=9';
import { DIVE } from './dive-stage.js?v=1';

export const GALLERY_STYLES = [['mix', '額縁を順にかえる'], ...FRAME_STYLES];
const STYLE_IDS = GALLERY_STYLES.map(([id]) => id), ORDER = MUSEUM_STYLES;   // 額縁を順にかえる: 今までの4つ（新しい額は、選んだ時だけ）
const num = (x, lo, hi, d) => typeof x === 'number' && Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function cleanGallery(value) {
  const v = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return { enabled: v.enabled === true, style: STYLE_IDS.includes(v.style) ? v.style : 'mix', size: Math.round(num(v.size, .5, .95, .8) * 100) / 100,
    pop: Math.round(num(v.pop, 0, 1, .15) * 100) / 100, lead: Math.round(num(v.lead, 0, 1, .5) * 100) / 100,
    move: MOVE_IDS.includes(v.move) ? v.move : 'walk' };
}
export const GALLERY_MOVES = [['walk', 'ふつうに渡る'], ['auto', '立体に合わせる（おまかせ）'], ['zoom', 'ビューン（飛行機・鳥）'], ['float', 'ふわふわ（風船・クラゲ）'],
  ['beat', 'ドクンドクン（ハート）'], ['hop', 'ぴょんぴょん（ウサギ・猫）'], ['swim', 'すいすい（魚・クジラ）']];
const MOVE_IDS = GALLERY_MOVES.map(([id]) => id);
// 立体に合わせる: the shape's id first, then words in its name (the shelf GLBs are saved under their Japanese names; your own GLB by its file name)
const SHAPE_MOVES = { heart: 'beat', 'c-hearts': 'beat', 'c-balloons': 'float', 'c-ghost': 'float', 'c-bat': 'zoom', 'c-broom': 'zoom', 'c-witch-hat': 'float',
  'c-black-cat': 'hop', 'c-pumpkin': 'hop', pegasus: 'zoom', dragon: 'zoom', flock: 'zoom', whale: 'swim' };
const NAME_MOVES = [
  ['beat', /ハート|heart/i],
  ['float', /風船|気球|クラゲ|羽根|提灯|傘|おばけ|お化け|ゴースト|雲|シャボン|balloon|jelly|feather|ghost|cloud|bubble|lantern|umbrella/i],
  ['zoom', /飛行機|ひこうき|ロケット|鳥|ワシ|鷲|ハチドリ|不死鳥|龍|竜|ドラゴン|ペガサス|鶴|翼|コウモリ|ほうき|バイク|plane|jet|rocket|bird|eagle|hawk|dragon|phoenix|pegasus|wing|broom/i],
  ['swim', /クジラ|鯨|鯉|魚|イルカ|サメ|カメ|亀|タツノオトシゴ|タコ|whale|fish|koi|dolphin|shark|turtle|octopus|seahorse/i],
  ['hop', /ウサギ|うさぎ|兎|猫|ねこ|ネコ|キツネ|カエル|かえる|蛙|かぼちゃ|カボチャ|ペンギン|カンガルー|rabbit|bunny|kitten|fox|frog|kangaroo|pumpkin|penguin/i],
];
export function galleryMoveFor(move, shape = '', name = '') {
  if (move !== 'auto') return MOVE_IDS.includes(move) ? move : 'walk';
  if (SHAPE_MOVES[shape]) return SHAPE_MOVES[shape];
  const text = `${name || ''} ${shape || ''}`;
  for (const [id, re] of NAME_MOVES) if (re.test(text)) return id;
  return 'walk';
}
export const styleOf = (style, i) => style === 'mix' ? ORDER[i % ORDER.length] : style;
// the distance from one frame to the next (world units, from the picture's width)
export const galleryGap = w => w * 1.75;
// the camera zoom that shows a whole frame at `size` of the view (the widest border, so every style fits)
export function galleryZoom(viewW, viewH, w, h, size) {
  const b = Math.max(...ORDER.map(s => borderOf(s, w, h)));
  return Math.min(viewW / (w + 2 * b), viewH / (h + 2 * b)) * num(size, .5, .95, .8);
}

// where things are, in frames (0 = the first frame, 1 = the second …): x = the picture / solid, lift = how high it arcs (picture heights),
// focus = the camera, lead = 0–1 how much the camera is walking. i: the picture shown (or being left), hasTr: a change is under way,
// u: its progress 0–1, uw: the same on the solid's own (warped) time, flow: '' (a solid) | 'through' | 'reveal' | 'return' | 'dive'
// opt (移る時の動き, only with a solid): { move: one of GALLERY_MOVES (not 'auto': galleryMoveFor picks first), beats: the ◆'s length in beats,
// warp: u → the solid's own time (so ドクンドクン lands on the song's beats) }. A move also gives rx ry rz (a tilt, radians), sx sy sz (squash / stretch),
// camY (the camera rises with the solid, picture heights), camZoom (× the zoom) and speed (0–1, for the wind lines of ビューン).
export function galleryPose(i, hasTr, u = 0, uw = u, flow = '', opt = {}) {
  if (!hasTr) return { x: i, lift: 0, focus: i, lead: 0 };
  if (flow === 'dive') { const there = u >= DIVE.CUT ? 1 : 0; return { x: i + there, lift: 0, focus: i + there, lead: 0 }; }   // into frame A, out of frame B
  const move = !flow && MOVES[opt.move] ? opt.move : 'walk';
  if (move !== 'walk') { const walk = smooth(.1, .9, u), m = MOVES[move](travel(uw), { u, uw, walk, ...opt });
    return { rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1, camY: 0, camZoom: 1, speed: 0, ...m, x: i + m.x, focus: i + m.focus }; }
  // the solid crosses while it is whole; without a solid the pieces cross in the middle; a reveal breaks away where it hangs
  const go = flow === 'reveal' ? 0 : flow === 'through' || flow === 'return' ? smooth(.3, .7, u) : smooth(.30, .72, uw), walk = smooth(.1, .9, u);
  // the camera stays with the solid (so it is never cut off at the edge), setting off a little before it and arriving a little after
  return { x: i + go, lift: .06 * Math.sin(Math.PI * go), focus: i + .3 * walk + .7 * go, lead: Math.sin(Math.PI * walk) };
}
// the travel: 0 → 1 while the solid is whole (the same time the usual crossing takes)
const GO_A = .30, GO_B = .72;
const travel = uw => Math.min(1, Math.max(0, (uw - GO_A) / (GO_B - GO_A)));
const sine = t => .5 - .5 * Math.cos(Math.PI * t);
const smoother = q => q * q * q * (q * (q * 6 - 15) + 10);
const kick = x => x < 0 ? 0 : Math.exp(-x * 14) * Math.min(1, x / .03);   // a beat: up fast, down slower
// ビューン: a wind-up back, a dash (the camera a little behind, the view a little wider), past the frame and back into it
const zoomP = t => t < .22 ? -.07 * smooth(0, .22, t) : t < .8 ? -.07 + 1.12 * smoother((t - .22) / .58) : 1.05 - .05 * smooth(.8, 1, t);
const ZOOM_TOP = 1.12 * 1.875 / .58;   // the fastest the dash goes (per unit of t)
const MOVES = {
  zoom(t, o) {
    const e = .004, v = (zoomP(Math.min(1, t + e)) - zoomP(Math.max(0, t - e))) / (2 * e), speed = Math.min(1, Math.max(0, v / ZOOM_TOP)), q = Math.min(1, Math.max(0, (t - .22) / .58));
    const sx = 1 + .32 * speed * speed, back = Math.min(0, v) / ZOOM_TOP * smooth(0, .03, t) * (1 - smooth(.97, 1, t));   // (not at the very ends: there it only looks one way)
    return { x: zoomP(t), lift: .14 * Math.sin(Math.PI * q) - .02 * smooth(0, .22, t) * (1 - q), focus: .15 * o.walk + .85 * zoomP(t - .05 * (1 - smooth(.85, 1, t))),
      lead: Math.sin(Math.PI * o.walk), rz: -.26 * speed - .5 * back + .12 * Math.cos(Math.PI * q) * speed, sx, sy: 1 / Math.sqrt(sx), sz: 1 / Math.sqrt(sx),
      camZoom: 1 - .1 * Math.sin(Math.PI * q), speed };
  },
  // ふわふわ: up first, drifting across with a little bob and sway, down softly into the next frame (the camera rises most of the way with it)
  float(t, o) {
    const across = smooth(.12, .88, t), aloft = smooth(0, .4, t) * (1 - smooth(.6, 1, t)), air = Math.sin(Math.PI * t);
    const lift = .4 * aloft + .045 * Math.sin(2 * Math.PI * 2 * t) * air;
    return { x: across + .035 * Math.sin(2 * Math.PI * 1.5 * t) * air, lift, focus: .2 * o.walk + .8 * smooth(.1, .9, t), lead: .7 * Math.sin(Math.PI * o.walk),
      rz: .1 * Math.sin(2 * Math.PI * 1.2 * t + .4) * air, rx: .05 * Math.sin(2 * Math.PI * .9 * t + 1) * air, camY: .7 * lift };
  },
  // ドクンドクン: on every half beat (every beat in a long ◆) the heart thumps twice — ドク・ン — and is shoved a step on with each thump
  beat(t, o) {
    const beats = o.beats > 0 ? o.beats : 4, warp = typeof o.warp === 'function' ? o.warp : x => x, step = beats >= 8 ? 1 : .5;
    const at = b => travel(warp(Math.min(1, Math.max(0, b / beats))));
    const b = o.u * beats, g0 = Math.floor(b / step + 1e-9) * step, ph = Math.min(1, (b - g0) / step), a0 = at(g0), a1 = at(g0 + step);
    const shove = .6 * smooth(0, .16, ph) + .4 * smooth(.24, .4, ph), alive = smooth(.26, .32, o.uw) * (1 - smooth(.7, .78, o.uw));
    const pulse = (kick(ph) + .75 * kick(ph - .24)) * alive, x = a0 + (a1 - a0) * shove, sc = 1 + .34 * pulse;
    return { x, lift: .06 * pulse, focus: .2 * o.walk + .8 * (.5 * x + .5 * smooth(0, 1, t)), lead: .5 * Math.sin(Math.PI * o.walk), sx: sc, sy: sc, sz: sc, camZoom: 1 + .035 * pulse };
  },
  // ぴょんぴょん: three hops, squashed as it lands and stretched in the air, leaning forward
  hop(t, o) {
    const n = 3, k = Math.min(n - 1, Math.floor(t * n)), ph = t * n - k, gate = smooth(0, .04, t) * (1 - smooth(.96, 1, t));
    const air = 4 * ph * (1 - ph), land = (Math.exp(-((ph / .07) ** 2)) + Math.exp(-(((ph - 1) / .07) ** 2))) * gate, sy = 1 - .18 * land + .08 * air * gate;
    return { x: (k + ph) / n, lift: .2 * air * gate, focus: .2 * o.walk + .8 * smooth(0, 1, t), lead: .6 * Math.sin(Math.PI * o.walk),
      rz: -.12 * Math.sin(Math.PI * ph) * gate, sx: 1 / Math.sqrt(sy), sy, sz: 1 / Math.sqrt(sy) };
  },
  // すいすい: an S across, the body wiggling like a tail, nose up as it climbs
  swim(t, o) {
    const e = sine(t), air = Math.sin(Math.PI * t);
    return { x: e, lift: .11 * Math.sin(2 * Math.PI * t), focus: .2 * o.walk + .8 * sine(Math.max(0, t - .04 * (1 - smooth(.85, 1, t)))), lead: .6 * Math.sin(Math.PI * o.walk),
      ry: .35 * Math.sin(2 * Math.PI * 3 * t) * air, rz: .22 * Math.cos(2 * Math.PI * t) * air };
  },
};

// how much of frame j's own (board) picture shows: the frames behind keep theirs, the one being left gets its picture back once the solid has gone,
// the ones ahead are dark until the picture arrives (a reveal's next picture is already hanging there)
export function planeOpacity(j, i, hasTr, u = 0, flow = '') {
  if (j < i) return 1;
  if (j === i) return hasTr ? smooth(.55, .9, u) : 0;   // while it is held, the picture is the mesh itself
  if (j === i + 1) return hasTr && flow === 'reveal' ? 1 : 0;
  return 0;
}

export function createGallery(THREE) {
  const tex = canvas => { const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; return t; };
  const flat = opts => new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, toneMapped: false, ...opts });
  const group = new THREE.Group(), boards = new Map();   // style → { texture, width, height }
  let items = [], key = '';
  // a warm pool of light on the wall behind each frame
  const glowCanvas = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,232,190,.20)'); g.addColorStop(1, 'rgba(255,232,190,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return c; })();
  const glowTex = tex(glowCanvas);
  // ビューン: wind lines streaming behind the solid while it dashes (y: of the solid's height, len: × its width, back: how far behind it they start)
  const windCanvas = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 8; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 256, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.8, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 2, 256, 4); return c; })();
  const windTex = tex(windCanvas), WIND = [[.3, .9, .1], [-.2, 1.25, .25], [.06, .7, .02], [-.38, 1, .15], [.18, .6, .32], [-.04, 1.1, .4]];
  const winds = WIND.map(() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), flat({ map: windTex, blending: THREE.AdditiveBlending, opacity: 0 })); m.renderOrder = -80; m.visible = false; group.add(m); return m; });
  function clear() { for (const it of items) for (const m of [it.glow, it.dark, it.pic, it.board]) { group.remove(m); m.geometry.dispose(); m.material.dispose(); } items = []; }
  return {
    group,
    // one frame per slide (rebuilt when their number, the style or the picture size changes); the pictures' textures are taken every time
    sync(slides, slideTexture, w, h, style) {
      const k = `${slides.length}:${style}:${w}:${h}`;
      if (k !== key) {
        key = k; clear(); for (const b of boards.values()) b.texture.dispose(); boards.clear();
        const gap = galleryGap(w);
        slides.forEach((_, i) => {
          const s = styleOf(style, i);
          if (!boards.has(s)) { const f = drawFrame(s, w, h); boards.set(s, { texture: tex(f.canvas), width: f.width, height: f.height }); }
          const b = boards.get(s), x = i * gap;
          const glow = new THREE.Mesh(new THREE.PlaneGeometry(w * 2.3, h * 2.6), flat({ map: glowTex })); glow.position.set(x, h * .1, 0); glow.renderOrder = -120;
          const board = new THREE.Mesh(new THREE.PlaneGeometry(b.width, b.height), flat({ map: b.texture })); board.position.set(x, 0, 0); board.renderOrder = -100;
          const dark = new THREE.Mesh(new THREE.PlaneGeometry(w, h), flat({ color: 0x0b0c0d, transparent: false })); dark.position.set(x, 0, 0); dark.renderOrder = -95;
          const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h), flat({ opacity: 0 })); pic.position.set(x, 0, 0); pic.renderOrder = -90;
          group.add(glow, board, dark, pic); items.push({ glow, board, dark, pic });
        });
      }
      slides.forEach((s, i) => { const t = slideTexture(s), m = items[i].pic.material; if (m.map !== t) { m.map = t; m.needsUpdate = true; } });
    },
    update({ enabled, i = 0, hasTr = false, u = 0, flow = '', wind = null }) {
      group.visible = !!enabled;
      if (!enabled) return;
      items.forEach((it, j) => { const o = planeOpacity(j, i, hasTr, u, flow); it.pic.visible = o > 0; it.pic.material.opacity = o; });
      const sp = wind?.speed || 0;
      winds.forEach((m, k) => { m.visible = sp > .04; if (!m.visible) return; const [y, len, back] = WIND[k], l = wind.w * len * (.4 + .9 * sp);
        m.scale.set(l, wind.h * .014, 1); m.position.set(wind.x - wind.w * (.3 + back) - l / 2, wind.y + y * wind.h, 0); m.material.opacity = .6 * sp; });
    },
    // for checks: the wind lines showing now
    windLines() { return winds.filter(m => m.visible).length; },
    // for checks: how much of each frame's own picture shows now
    opacities() { return items.map(it => it.pic.visible ? Math.round(it.pic.material.opacity * 100) / 100 : 0); },
    dispose() { clear(); for (const b of boards.values()) b.texture.dispose(); glowTex.dispose(); for (const m of winds) { m.geometry.dispose(); m.material.dispose(); } windTex.dispose(); },
  };
}
