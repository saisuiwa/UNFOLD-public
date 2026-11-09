// 立体の舞台（1枚モード、2026-11-09）: 絵が立体になっている間だけ、立体の後ろにぼかした絵（背景）、下に床と接地の影を出す。
// 立体が「どこかに置かれている」ように見せる。絵が元のままの間（最初と最後）は何も出ない（立体になる割合 form で出入りする）。
//   描く順番: 背景（いちばん奥）→ 床 → 影 → 額縁 → 絵の粒・立体。どれも奥行きを書かない板で、画面（カメラの見える範囲）に合わせて置く。
// value = { enabled, backdrop: 'picture' | 'plate' | 'none'（絵をぼかして／人物のいない背景をぼかして／背景色のまま）, blur: 0–1, floor: 床と影を出すか }

export const BACKDROPS = [['picture', '絵をぼかして後ろに'], ['plate', '人物のいない背景をぼかして（切り抜きがある時）'], ['none', '背景色のまま']];
const BACKDROP_IDS = BACKDROPS.map(([id]) => id);
const num = (x, lo, hi, d) => typeof x === 'number' && Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d;
export function cleanSolidStage(value) {
  const v = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return { enabled: v.enabled === true, backdrop: BACKDROP_IDS.includes(v.backdrop) ? v.backdrop : 'picture', blur: Math.round(num(v.blur, 0, 1, .5) * 100) / 100, floor: v.floor !== false };
}

// the picture, blurred and a little darker, as the backdrop (the blur is in pixels of a 960-px-wide copy)
export function blurredBackdrop(source, amount) {
  const w = Math.min(960, source.width), h = Math.max(1, Math.round(w * source.height / source.width));
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  const px = Math.round(4 + 26 * num(amount, 0, 1, .5));
  // draw a little larger than the canvas so the blur does not pull the dark edge in
  x.filter = `blur(${px}px) brightness(.72) saturate(1.1)`; x.drawImage(source, -px * 2, -px * 2, w + px * 4, h + px * 4); return c;
}
// the floor: clear at the horizon, darker towards you, with a faint line where it meets the backdrop
function floorTexture() {
  const c = document.createElement('canvas'); c.width = 8; c.height = 256; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, 'rgba(255,255,255,.14)'); g.addColorStop(.03, 'rgba(30,34,36,.18)'); g.addColorStop(.5, 'rgba(14,18,20,.45)'); g.addColorStop(1, 'rgba(8,10,12,.8)');
  x.fillStyle = g; x.fillRect(0, 0, 8, 256); return c;
}
function shadowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, 'rgba(0,0,0,.95)'); g.addColorStop(.5, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256); return c;
}
// where the floor's horizon is and where the contact shadow goes, from the solid's centre y and size (world units) and the view's bottom
export function stageLayout(centreY, radius, viewBottom) {
  const ground = centreY - radius * 1.02;                       // the solid stands on the floor
  return { ground, horizon: Math.max(viewBottom + .05, ground + radius * .55), shadow: { y: ground - radius * .04, w: radius * 2.1, h: radius * .36 } };
}

export function createSolidStage(THREE) {
  const tex = canvas => { const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; return t; };
  const mat = map => new THREE.MeshBasicMaterial({ map, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false });
  const group = new THREE.Group();
  const back = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat(null)); back.renderOrder = -200;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat(tex(floorTexture()))); floor.renderOrder = -190;
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat(tex(shadowTexture()))); shadow.renderOrder = -180;
  group.add(back, floor, shadow);
  let key = '';
  const ids = new WeakMap(); let next = 0; const idOf = c => { if (!ids.has(c)) ids.set(c, ++next); return ids.get(c); };
  return {
    group,
    // source: the canvas to blur (the picture or the person-free one), or null for none
    setBackdrop(source, amount) {
      const k = source ? `${idOf(source)}:${source.width}x${source.height}:${amount}` : '';
      if (k === key) return; key = k;
      back.material.map?.dispose(); back.material.map = source ? tex(blurredBackdrop(source, amount)) : null; back.material.needsUpdate = true;
    },
    // view: {left, right, top, bottom} of what the camera sees (world units, at the solid's depth), form: 0–1, solid: {y, radius}
    update({ enabled, form, view, solid, floor: showFloor }) {
      const k = enabled ? num(form, 0, 1, 0) : 0;
      group.visible = k > 0;
      if (!k) return;
      const W = view.right - view.left, H = view.top - view.bottom, cx = (view.left + view.right) / 2, cy = (view.top + view.bottom) / 2;
      // the backdrop covers the view (and a little more, for shake) whatever the camera does
      back.visible = !!back.material.map; back.scale.set(W * 1.12, H * 1.12, 1); back.position.set(cx, cy, 0); back.material.opacity = k;
      const L = stageLayout(solid.y, solid.radius, view.bottom);
      floor.visible = shadow.visible = showFloor;
      floor.scale.set(W * 1.12, L.horizon - view.bottom + H * .06, 1); floor.position.set(cx, (L.horizon + view.bottom - H * .06) / 2, 0); floor.material.opacity = k;
      shadow.scale.set(L.shadow.w, L.shadow.h, 1); shadow.position.set(solid.x ?? 0, L.shadow.y, 0); shadow.material.opacity = k * k;
    },
    dispose() { for (const m of [back, floor, shadow]) { m.material.map?.dispose(); m.material.dispose(); m.geometry.dispose(); } },
  };
}
