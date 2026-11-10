// 絵の中へ飛び込む（シーケンスの◆の流れ方、2026-11-10）: 絵を、奥行きの違う層（人物の切り抜き / 人物のいない背景）に分けて置き、
// カメラがその間を進む。最初のカメラの位置からは、ぴったり元の絵（画面いっぱい）に見える。人物の横をすり抜けて奥へ進み、光に包まれて、
// 次の絵になる。切り抜きのない絵は、絵1枚に向かってまっすぐ進む（遠近感のある寄り）。
//   ◆の進み u: 0 → IN  絵が画面いっぱいになるまで寄る（ふつうのカメラ）
//              IN → CUT 層の間を進む（この部品が描く）。終わりに向けて光が強くなる
//              CUT → 1  次の絵が、寄った所から引いて現れる（ふつうのカメラ）。光が引く
export const DIVE = { IN: .14, CUT: .66 };
const ease = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x), span = (x, a, b) => ease((x - a) / (b - a));

// how far the dive has gone (0–1) at the change's progress u, the flash (0–1), and how much the next picture is still zoomed in (1 = settled)
export function diveAt(u) {
  return { closing: span(u, 0, DIVE.IN), go: u < DIVE.IN ? 0 : u >= DIVE.CUT ? 1 : (u - DIVE.IN) / (DIVE.CUT - DIVE.IN), inside: u >= DIVE.IN && u < DIVE.CUT,
    flash: Math.sin(Math.PI * Math.min(1, Math.max(0, (u - .50) / .34))) * .92, arrive: u < DIVE.CUT ? 0 : span(u, DIVE.CUT, 1) };
}
// the camera inside the picture, in units of the first distance d0 (where the picture fills the view): z from 1 down past the person (at PERSON_Z)
// towards the background (at BACK_Z); side = −1 / +1 the way it passes the person (0 without one), x in picture widths, y in picture heights
export const PERSON_Z = -.26, BACK_Z = -.85;
export function divePath(go, side = 0, sec = 0) {
  const a = span(go, 0, .62), b = span(go, .5, 1);
  return { z: 1 - 1.09 * a - .58 * b * b, x: side * (.24 * span(go, .2, .8) + .11 * b), y: .02 * Math.sin(sec * .9) * a - .08 * b,
    look: { x: side * .15 * b, y: -.06 * b }, bank: .05 * Math.sin(sec * 1.3) * a * (1 - b) };
}
// which side of the person has more room: the camera passes there (the cut-out's own pixels, u of its centre of mass)
export function passSide(cut) {
  if (!cut) return 0;
  const w = 64, h = Math.max(1, Math.round(64 * cut.height / cut.width)), c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(cut, 0, 0, w, h); const d = x.getImageData(0, 0, w, h).data;
  let sum = 0, n = 0; for (let i = 0; i < w * h; i++) if (d[i * 4 + 3] > 128) { sum += i % w; n++; }
  return n ? (sum / n / w > .5 ? -1 : 1) : 0;
}
// the background, drawn GROW times wider than the picture with soft blurred edges (the view widens as the camera goes in, and must not run out of picture)
const GROW = 2.2;
function wideBackdrop(src) {
  const c = document.createElement('canvas'); c.width = 1760; c.height = Math.round(1760 * src.height / src.width); const x = c.getContext('2d');
  x.filter = 'blur(28px) brightness(.9)'; x.drawImage(src, -c.width * .1, -c.height * .1, c.width * 1.2, c.height * 1.2); x.filter = 'none';
  const w = Math.round(c.width / GROW), h = Math.round(c.height / GROW), s = document.createElement('canvas'); s.width = w; s.height = h; const y = s.getContext('2d');
  y.drawImage(src, 0, 0, w, h); y.globalCompositeOperation = 'destination-in';
  for (const [x1, y1, f] of [[w, 0, .07], [0, h, .09]]) { const g = y.createLinearGradient(0, 0, x1, y1); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(f, '#000'); g.addColorStop(1 - f, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)'); y.fillStyle = g; y.fillRect(0, 0, w, h); }
  x.drawImage(s, (c.width - w) / 2, (c.height - h) / 2); return c;
}

export function createDiveStage(THREE) {
  const tex = canvas => { const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; return t; };
  const mat = () => new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, 16 / 9, .01, 500), FOV = 40;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat()), who = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat()); back.renderOrder = 0; who.renderOrder = 1; scene.add(back, who);
  const flashScene = new THREE.Scene(), flashCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const flash = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false })); flashScene.add(flash);
  let key = null, side = 0;
  const target = new THREE.Vector3();
  return {
    scene,
    // picture: the slide as it is shown (canvas); cut: its person cut-out on a canvas of the same size, or null; plate: the picture without the person, or null
    set(picture, cut, plate) {
      if (key && key[0] === picture && key[1] === cut && key[2] === plate) return;
      key = [picture, cut, plate];
      back.material.map?.dispose(); who.material.map?.dispose();
      back.material.map = tex(wideBackdrop(plate || picture)); back.material.needsUpdate = true;
      who.material.map = cut ? tex(cut) : null; who.material.needsUpdate = true; who.visible = !!cut; side = passSide(cut);
    },
    // view: {x, y, w, h, vh} — the picture (centre and size, world units) and the height of it the view shows at the start; go: 0–1; sec: seconds; → the camera to draw `scene` with
    camera(view, aspect, go, sec) {
      const d0 = (view.vh ?? view.h) / 2 / Math.tan(FOV * Math.PI / 360), p = divePath(go, side, sec);   // vh: the height the view shows of the picture (it may be cropped to cover)
      camera.fov = FOV; camera.aspect = aspect; camera.near = d0 * .004; camera.far = d0 * 40; camera.updateProjectionMatrix();
      // each layer sized so that from the first camera position it sits exactly on the picture
      const place = (m, z, grow) => { const s = 1 - z; m.scale.set(view.w * s * grow, view.h * s * grow, 1); m.position.set(view.x, view.y, z * d0); };
      place(back, BACK_Z, GROW); place(who, PERSON_Z, 1);
      const cx = view.x + p.x * view.w, cy = view.y + p.y * view.h, cz = p.z * d0;
      camera.position.set(cx, cy, cz); camera.up.set(0, 1, 0);
      camera.lookAt(target.set(view.x + (p.x * .55 + p.look.x) * view.w, cy + p.look.y * view.h, cz - d0));   // a little back towards the middle, then on ahead
      camera.rotateZ(p.bank); camera.updateMatrixWorld();
      // the person fades as the camera passes right beside her (a flat cut-out seen from beside would break the spell)
      who.material.opacity = 1 - span(PERSON_Z + .11 - p.z, 0, .09);
      return camera;
    },
    // the light the dive ends in: over whatever was drawn
    flash(renderer, opacity) {
      if (!(opacity > 0)) return;
      flash.material.opacity = opacity; const old = renderer.autoClear; renderer.autoClear = false; renderer.setRenderTarget(null); renderer.render(flashScene, flashCam); renderer.autoClear = old;
    },
    dispose() { for (const m of [back, who, flash]) { m.material.map?.dispose(); m.material.dispose(); m.geometry.dispose(); } },
  };
}
