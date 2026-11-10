// 美術館を歩く（シーケンス、2026-11-10）: 壁に、絵の枚数だけ額縁を横に並べる。絵は額縁の中で崩れて立体になり、額縁の手前へ飛び出して
// 壁に沿って次の額縁へ飛び、飛び込んで次の絵になる。カメラは壁の横を歩く（歩く間は少し先を向く）。
//   ・今見せている絵（と、変化の途中の絵）は、いつもの絵の粒（メッシュ）が額縁の位置で描く。ほかの額縁は、絵を貼った板。
//   ・通り過ぎた額縁には絵が残る（出ていった絵は、少しして戻る）。まだ行っていない額縁は、絵が来るまで暗い。
// value = { enabled, style: 'mix'（額縁を順にかえる）か FRAME_STYLES のどれか, size: 額縁が画面に占める大きさ 0.5–0.95,
//           pop: 立体が飛び出す大きさ 0–1（はじめは 0.15）, lead: 歩く間にカメラが先を向く強さ 0–1 }
import { FRAME_STYLES, borderOf, drawFrame } from './frame-stage.js?v=7';
import { DIVE } from './dive-stage.js?v=1';

export const GALLERY_STYLES = [['mix', '額縁を順にかえる'], ...FRAME_STYLES];
const STYLE_IDS = GALLERY_STYLES.map(([id]) => id), ORDER = FRAME_STYLES.map(([id]) => id);
const num = (x, lo, hi, d) => typeof x === 'number' && Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function cleanGallery(value) {
  const v = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return { enabled: v.enabled === true, style: STYLE_IDS.includes(v.style) ? v.style : 'mix', size: Math.round(num(v.size, .5, .95, .8) * 100) / 100,
    pop: Math.round(num(v.pop, 0, 1, .15) * 100) / 100, lead: Math.round(num(v.lead, 0, 1, .5) * 100) / 100 };
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
export function galleryPose(i, hasTr, u = 0, uw = u, flow = '') {
  if (!hasTr) return { x: i, lift: 0, focus: i, lead: 0 };
  if (flow === 'dive') { const there = u >= DIVE.CUT ? 1 : 0; return { x: i + there, lift: 0, focus: i + there, lead: 0 }; }   // into frame A, out of frame B
  // the solid crosses while it is whole; without a solid the pieces cross in the middle; a reveal breaks away where it hangs
  const go = flow === 'reveal' ? 0 : flow === 'through' || flow === 'return' ? smooth(.3, .7, u) : smooth(.30, .72, uw), walk = smooth(.1, .9, u);
  // the camera stays with the solid (so it is never cut off at the edge), setting off a little before it and arriving a little after
  return { x: i + go, lift: .06 * Math.sin(Math.PI * go), focus: i + .3 * walk + .7 * go, lead: Math.sin(Math.PI * walk) };
}
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
    update({ enabled, i = 0, hasTr = false, u = 0, flow = '' }) {
      group.visible = !!enabled;
      if (!enabled) return;
      items.forEach((it, j) => { const o = planeOpacity(j, i, hasTr, u, flow); it.pic.visible = o > 0; it.pic.material.opacity = o; });
    },
    // for checks: how much of each frame's own picture shows now
    opacities() { return items.map(it => it.pic.visible ? Math.round(it.pic.material.opacity * 100) / 100 : 0); },
    dispose() { clear(); for (const b of boards.values()) b.texture.dispose(); glowTex.dispose(); },
  };
}
