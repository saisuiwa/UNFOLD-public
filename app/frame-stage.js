// 額縁から飛び出す（1枚モード、2026-11-09）: 絵を壁に掛けた額縁に入れて、崩れた絵が立体になる時に、立体が額縁の手前へ飛び出す。
// 切り抜き（人物だけの透過PNG）を入れると、絵が崩れはじめる時に、人物も額縁から手前へ出て、絵が元に戻る時に額縁へ帰る。
//   描く順番: 額縁と人物の影（いちばん先、絵の粒より後ろ）→ 絵の粒・立体（いつもどおり）→ 人物（いちばん最後、立体より手前）
//   額縁は絵と同じ大きさの穴が開いた1枚の板（キャンバスに描いた額）なので、光を足さなくても立体的に見える。
// 額縁の傾き: カメラが額縁のまわりを少し回り込む（額縁・絵・立体・人物がいっしょに傾くので、ずれない）。遠近感のあるカメラで描くので、手前に出た立体や人物と
// 額縁の奥行きの差が見える。崩れはじめから入って、元どおりに戻る時に正面へ戻る（最初と最後の1枚は、今までどおりまっすぐ）。
// value = { enabled, style: FRAME_STYLES のどれか, pop: 立体が飛び出す大きさ 0–1（0.4 = 1.4倍）, size: 額縁が画面に占める大きさ 0.5–0.95,
//           tilt: FRAME_TILTS のどれか, tiltAmount: 傾きの大きさ 0–1（0.5 で約13度）, personMove: PERSON_MOVES のどれか（飛び出した人物の、額縁とは別の動き）,
//           solidX / solidY: 立体をずらす -1–1（絵の幅・高さの半分まで。立体になるにつれてずれ、元の絵に戻る時に真ん中へ帰る） }

export const FRAME_STYLES = [['gold', '金の額'], ['wood', '木の額'], ['black', '黒の細い額'], ['white', '白いマットの額']];
const STYLE_IDS = FRAME_STYLES.map(([id]) => id);
export const FRAME_TILTS = [['none', 'なし（正面のまま）'], ['sway', 'ゆっくり左右に振れる'], ['topBack', '上が奥へ倒れる'], ['rightFront', '右が手前に来る'], ['leftFront', '左が手前に来る'], ['orbit', 'ぐるっと回り込む']];
const TILT_IDS = FRAME_TILTS.map(([id]) => id);
export const PERSON_MOVES = [['pop', '飛び出したまま'], ['forward', 'ゆっくり前へ'], ['counter', '額縁と逆に動く'], ['nudge', '前に出て、少し下がる'], ['float', 'ふわふわ漂う']];
const MOVE_IDS = PERSON_MOVES.map(([id]) => id);
const num = (x, lo, hi, d) => typeof x === 'number' && Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d;
export function cleanFrameStage(value) {
  const v = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return { enabled: v.enabled === true, style: STYLE_IDS.includes(v.style) ? v.style : 'gold', pop: Math.round(num(v.pop, 0, 1, .4) * 100) / 100, size: Math.round(num(v.size, .5, .95, .78) * 100) / 100,
    tilt: TILT_IDS.includes(v.tilt) ? v.tilt : 'none', tiltAmount: Math.round(num(v.tiltAmount, 0, 1, .5) * 100) / 100, personMove: MOVE_IDS.includes(v.personMove) ? v.personMove : 'pop',
    solidX: Math.round(num(v.solidX, -1, 1, 0) * 100) / 100, solidY: Math.round(num(v.solidY, -1, 1, 0) * 100) / 100 };
}

// the frame's width around the picture (world units, from the picture's shorter side), and the room left for its shadow on the wall
export const borderOf = (style, w, h) => Math.min(w, h) * ({ gold: .11, wood: .09, black: .035, white: .13 }[style] ?? .1);
const SHADOW = .28;

// the camera zoom that shows the whole frame at `size` of the view (an orthographic camera whose view is viewW × viewH world units at zoom 1)
export function frameZoom(viewW, viewH, w, h, style, size) {
  const b = borderOf(style, w, h);
  return Math.min(viewW / (w + 2 * b), viewH / (h + 2 * b)) * size;
}

// how far the cut-out person is out of the frame (0 = in the picture, 1 = all the way out): out as the picture starts to break, back as it comes together
export const personOut = (distort, form) => { const x = Math.min(1, Math.max(distort, form) * 1.6); return x * x * (3 - 2 * x); };
// the solid's size against the frame: 1 + pop as it forms (the frame stays, so the solid grows past it)
export const solidPop = (pop, form) => 1 + pop * form;
// where the solid moves to (world units) as it forms: solidX / solidY of half the picture's width / height (so two things can come out side by side)
export const solidShift = (x, y, w, h, form) => [num(x, -1, 1, 0) * w * .5 * form, num(y, -1, 1, 0) * h * .5 * form, 0];

// the camera's turn around the frame (radians): yaw = to the right (the right side comes closer), pitch = up (the top comes closer);
// sec: seconds into the clip, w: how far into the change (0 = the picture is whole, so the camera is straight)
export function tiltAt(tilt, amount, sec, w) {
  if (!(num(w, 0, 1, 0) > 0)) return { yaw: 0, pitch: 0 };   // the picture is whole: straight
  const a = (6 + 14 * num(amount, 0, 1, .5)) * Math.PI / 180 * num(w, 0, 1, 0), ph = 2 * Math.PI * sec / 5;
  switch (tilt) {
    case 'sway': return { yaw: a * Math.sin(ph), pitch: -.25 * a };
    case 'topBack': return { yaw: .2 * a * Math.sin(ph * .5), pitch: -a };
    case 'rightFront': return { yaw: a, pitch: -.2 * a };
    case 'leftFront': return { yaw: -a, pitch: -.2 * a };
    case 'orbit': return { yaw: a * Math.sin(ph), pitch: .55 * a * Math.cos(ph) - .2 * a };
    default: return { yaw: 0, pitch: 0 };
  }
}
// 🎲: a tilt that is not the current one (never なし)
export function pickTilt(current, random = Math.random) { const pool = TILT_IDS.filter(id => id !== 'none' && id !== current); return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]; }
// the camera's turn applied to a perspective camera that looks straight at `target` from distance d (so with yaw = pitch = 0 nothing changes)
export function orbitCamera(cam, target, { yaw, pitch }, roll = 0) {
  if (!yaw && !pitch) return cam;
  const d = cam.position.distanceTo(target);
  cam.position.set(target.x + d * Math.sin(yaw) * Math.cos(pitch), target.y + d * Math.sin(pitch), target.z + d * Math.cos(yaw) * Math.cos(pitch));
  cam.lookAt(target); if (roll) cam.rotateZ(roll); cam.updateMatrixWorld();
  return cam;
}

// the cut-out person's pose (x, y in picture widths / heights, z in picture heights toward you, s = size, rx ry rz radians).
// out: how far it is out of the frame (0 = in the picture: everything 0, s 1), hold: 0→1 across the time it is out, sec: seconds,
// tilt: the camera's turn (tiltAt) for 額縁と逆に動く. Every value is multiplied by `out`, so the person always lands exactly on the picture.
const ease = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
export function personPose(move, out, hold = 0, sec = 0, tilt = { yaw: 0, pitch: 0 }) {
  const o = num(out, 0, 1, 0), h = num(hold, 0, 1, 0), base = { s: 1 + .32 * o, x: -.02 * o, y: .06 * o, z: .35 * o, rx: 0, ry: 0, rz: 0 };
  if (!o) return { s: 1, x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 };
  switch (move) {
    case 'forward': { const g = ease(h); return { ...base, s: 1 + o * (.14 + .26 * g), y: o * (.03 + .05 * g), z: o * (.1 + .45 * g) }; }
    case 'counter': {
      // turn the other way from the frame: further than the camera turned (so it looks turned against the frame), and shift against it;
      // with no tilt, a slow swing of its own
      const yaw = tilt.yaw || .2 * Math.sin(2 * Math.PI * sec / 5), pitch = tilt.pitch || 0;
      return { ...base, ry: o * 2.2 * yaw, rx: -o * 2.2 * pitch, x: base.x - o * .55 * yaw, y: base.y + o * .3 * pitch };
    }
    case 'nudge': { const back = ease((h - .3) / .45); return { ...base, s: 1 + o * (.38 - .12 * back), z: o * (.5 - .26 * back), y: o * (.07 - .03 * back) }; }
    case 'float': { const a = 2 * Math.PI * sec; return { ...base, y: base.y + o * .03 * Math.sin(a / 3.2), rz: o * .035 * Math.sin(a / 4.1), ry: o * .12 * Math.sin(a / 5.3) }; }
    default: return base;
  }
}
export function pickPersonMove(current, random = Math.random) { const pool = MOVE_IDS.filter(id => id !== current); return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]; }

// the frame as a picture: a board with a w × h hole (k pixels per world unit), its bevel lit from the top left, and its soft shadow on the wall
export function drawFrame(style, w, h, k = 200) {
  const b = borderOf(style, w, h), W = Math.round((w + 2 * b + 2 * SHADOW) * k), H = Math.round((h + 2 * b + 2 * SHADOW) * k);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  const ox = SHADOW * k, oy = SHADOW * k, fw = (w + 2 * b) * k, fh = (h + 2 * b) * k, B = b * k;
  const ring = (inset) => { x.beginPath(); x.rect(ox + inset, oy + inset, fw - 2 * inset, fh - 2 * inset); x.rect(ox + B, oy + B, fw - 2 * B, fh - 2 * B); };
  // shadow on the wall (drawn with the board, then the board is painted over it)
  x.save(); x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = .16 * k; x.shadowOffsetX = .04 * k; x.shadowOffsetY = .08 * k;
  x.fillStyle = '#000'; ring(0); x.fill('evenodd'); x.restore();
  const look = {
    gold: { base: '#c79a3c', light: '#f6dc8a', dark: '#6e4f17', lip: '#3a2a0c' },
    wood: { base: '#6e4527', light: '#a87447', dark: '#3b2412', lip: '#24150a' },
    black: { base: '#1c1c1e', light: '#4a4a4f', dark: '#0a0a0b', lip: '#000000' },
    white: { base: '#2a2a2c', light: '#55555a', dark: '#111113', lip: '#000000' },
  }[style] || {};
  // one side of the bevel: a mitred strip, shaded by which way it faces
  const side = (pts, shade) => { x.beginPath(); x.moveTo(...pts[0]); for (const p of pts.slice(1)) x.lineTo(...p); x.closePath(); x.fillStyle = shade; x.fill(); };
  const L = ox, T = oy, R = ox + fw, Bt = oy + fh, il = ox + B, it = oy + B, ir = R - B, ib = Bt - B;
  const grad = (x0, y0, x1, y1, a, z) => { const g = x.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, a); g.addColorStop(1, z); return g; };
  if (style === 'white') {
    // a thin dark frame, and a wide white mat inside it
    const t = Math.min(B * .28, .045 * k), mi = t;
    side([[L, T], [R, T], [R - t, T + t], [L + t, T + t]], look.light); side([[L, Bt], [R, Bt], [R - t, Bt - t], [L + t, Bt - t]], look.dark);
    side([[L, T], [L, Bt], [L + t, Bt - t], [L + t, T + t]], look.base); side([[R, T], [R, Bt], [R - t, Bt - t], [R - t, T + t]], look.dark);
    x.fillStyle = '#efebe2'; x.beginPath(); x.rect(L + mi, T + mi, fw - 2 * mi, fh - 2 * mi); x.rect(il, it, ir - il, ib - it); x.fill('evenodd');
    // the mat's cut edge, a little shadow on its top and left
    x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(il - .012 * k, it - .012 * k, ir - il + .012 * k, .012 * k); x.fillRect(il - .012 * k, it, .012 * k, ib - it);
  } else {
    side([[L, T], [R, T], [ir, it], [il, it]], grad(0, T, 0, it, look.light, look.base));
    side([[L, Bt], [R, Bt], [ir, ib], [il, ib]], grad(0, Bt, 0, ib, look.dark, look.base));
    side([[L, T], [L, Bt], [il, ib], [il, it]], grad(L, 0, il, 0, look.light, look.base));
    side([[R, T], [R, Bt], [ir, ib], [ir, it]], grad(R, 0, ir, 0, look.dark, look.base));
    if (style === 'wood') {   // grain: thin darker lines along each side
      x.save(); ring(0); x.clip('evenodd'); x.strokeStyle = 'rgba(30,15,5,.28)'; x.lineWidth = Math.max(1, .004 * k);
      for (let i = 0; i < 26; i++) { const d = (i + .5) / 26 * B; x.beginPath(); x.moveTo(L + d, T + d); x.lineTo(R - d, T + d); x.lineTo(R - d, Bt - d); x.lineTo(L + d, Bt - d); x.closePath(); x.stroke(); }
      x.restore();
    }
    if (style === 'gold') {   // a raised ridge in the middle of the gold
      x.save(); x.strokeStyle = 'rgba(255,240,190,.55)'; x.lineWidth = Math.max(1, .012 * k); const d = B * .45; x.strokeRect(L + d, T + d, fw - 2 * d, fh - 2 * d); x.restore();
      x.save(); x.strokeStyle = 'rgba(80,55,10,.5)'; x.lineWidth = Math.max(1, .008 * k); const e = B * .52; x.strokeRect(L + e, T + e, fw - 2 * e, fh - 2 * e); x.restore();
    }
    // the inner lip, where the picture sits
    x.save(); x.strokeStyle = look.lip; x.lineWidth = Math.max(2, .02 * k); x.strokeRect(il - x.lineWidth / 2, it - x.lineWidth / 2, ir - il + x.lineWidth, ib - it + x.lineWidth); x.restore();
  }
  return { canvas: c, width: W / k, height: H / k };
}

// the person's shadow on the wall and the picture: the cut-out made black and soft
export function shadowOf(cut) {
  const c = document.createElement('canvas'); c.width = cut.width; c.height = cut.height; const x = c.getContext('2d');
  x.filter = `blur(${Math.max(4, Math.round(Math.max(cut.width, cut.height) / 90))}px) brightness(0)`; x.drawImage(cut, 0, 0); return c;
}

// the three.js side: `back` goes into the scene (drawn first), `front` is drawn after everything else
export function createFrameStage(THREE) {
  const texture = canvas => { const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; return t; };
  const material = (map, opacity = 1) => new THREE.MeshBasicMaterial({ map, transparent: true, opacity, depthTest: false, depthWrite: false, toneMapped: false });
  const back = new THREE.Group(), front = new THREE.Scene();
  const frame = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material(null)); frame.renderOrder = -100; back.add(frame);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material(null, 0)); shadow.renderOrder = -90; back.add(shadow);
  const person = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material(null)); front.add(person);
  let size = { w: 1, h: 1 }, style = '', cut = null;
  function redraw() { const f = drawFrame(style, size.w, size.h); frame.material.map?.dispose(); frame.material.map = texture(f.canvas); frame.material.needsUpdate = true; frame.scale.set(f.width, f.height, 1); }
  return {
    back, front,
    setPicture(w, h) { size = { w, h }; if (style) redraw(); person.scale.set(w, h, 1); shadow.scale.set(w, h, 1); },
    setStyle(s) { if (s !== style) { style = s; redraw(); } },
    // cutCanvas: the cut-out placed on a canvas the same size as the picture (so it sits exactly on it), or null
    setCutout(cutCanvas) {
      cut = cutCanvas; for (const m of [person, shadow]) { m.material.map?.dispose(); m.material.map = null; }
      if (cut) { person.material.map = texture(cut); shadow.material.map = texture(shadowOf(cut)); }
      person.material.needsUpdate = shadow.material.needsUpdate = true;
    },
    get hasCutout() { return !!cut; },
    // enabled: the frame is on; out: personOut(); camera: the scene camera (the person is drawn with it)
    update({ enabled, out, hold = 0, sec = 0, tilt, move = 'pop' }) {
      back.visible = enabled; frame.visible = enabled;
      const show = enabled && !!cut; shadow.visible = person.visible = show;
      if (!show) return;
      const p = personPose(move, out, hold, sec, tilt);   // in front of the frame (z), so a tilted camera sees it move against the frame
      person.scale.set(size.w * p.s, size.h * p.s, 1); person.position.set(p.x * size.w, p.y * size.h, p.z * size.h); person.rotation.set(p.rx, p.ry, p.rz);
      // the shadow on the wall: further off and softer the further out the person is
      const far = Math.min(1.6, out + p.z * .6);
      shadow.scale.set(size.w * (1 + .06 * far), size.h * (1 + .06 * far), 1); shadow.position.set(p.x * size.w + .05 * size.w * far, p.y * size.h * .5 - .05 * size.h * far, 0); shadow.material.opacity = .34 * out;
    },
    dispose() { for (const m of [frame, shadow, person]) { m.material.map?.dispose(); m.material.dispose(); m.geometry.dispose(); } },
  };
}
