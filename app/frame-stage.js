// 額縁から飛び出す（1枚モード、2026-11-09）: 絵を壁に掛けた額縁に入れて、崩れた絵が立体になる時に、立体が額縁の手前へ飛び出す。
// 切り抜き（人物だけの透過PNG）を入れると、絵が崩れはじめる時に、人物も額縁から手前へ出て、絵が元に戻る時に額縁へ帰る。
//   描く順番: 額縁と人物の影（いちばん先、絵の粒より後ろ）→ 絵の粒・立体（いつもどおり）→ 人物（いちばん最後、立体より手前）
//   額縁は絵と同じ大きさの穴が開いた1枚の板（キャンバスに描いた額）なので、光を足さなくても立体的に見える。
// 額縁の傾き: カメラが額縁のまわりを少し回り込む（額縁・絵・立体・人物がいっしょに傾くので、ずれない）。遠近感のあるカメラで描くので、手前に出た立体や人物と
// 額縁の奥行きの差が見える。崩れはじめから入って、元どおりに戻る時に正面へ戻る（最初と最後の1枚は、今までどおりまっすぐ）。
// value = { enabled, style: FRAME_STYLES のどれか, pop: 立体が飛び出す大きさ 0–1（0.4 = 1.4倍）, size: 額縁が画面に占める大きさ 0.5–0.95,
//           tilt: FRAME_TILTS のどれか, tiltAmount: 傾きの大きさ 0–1（0.5 で約13度）, personMove: PERSON_MOVES のどれか（飛び出した人物の、額縁とは別の動き）,
//           solidX / solidY: 立体をずらす -1–1（絵の幅・高さの半分まで。立体になるにつれてずれ、元の絵に戻る時に真ん中へ帰る） }

export const FRAME_STYLES = [['gold', '金の額'], ['wood', '木の額'], ['black', '黒の細い額'], ['white', '白いマットの額'],
  ['baroque', 'バロック（飾り彫りの金の額）'], ['neon', 'ネオン管（ときどき瞬く）'], ['bulbs', '電球がぐるっと並ぶ（順に光る）'], ['polaroid', 'ポラロイド'], ['film', 'フィルムのコマ']];
const STYLE_IDS = FRAME_STYLES.map(([id]) => id);
/** シーケンスの「美術館を歩く」で、額縁を順にかえる時に使う額（今までの4つのまま。保存した作品の見え方が変わらないように。新しい額は、選んだ時だけ） */
export const MUSEUM_STYLES = ['gold', 'wood', 'black', 'white'];
/** 「額の色」の初めの色（色を選ばない時の、その額の色） */
export const FRAME_COLORS = { gold: '#c79a3c', wood: '#6e4527', black: '#1c1c1e', white: '#2a2a2c', baroque: '#c9a040', neon: '#ff3fd5', bulbs: '#8c1c24', polaroid: '#f6f3ec', film: '#141414' };
/** 額に重ねる飾り（どの額にも足せる） */
export const FRAME_DECOS = [['none', 'なし'], ['flowers', '四隅に花とツタ'], ['tape', 'マスキングテープで貼る'], ['sparkle', 'キラキラが額のまわりを回る'], ['petals', '花びらが舞う']];
const DECO_IDS = FRAME_DECOS.map(([id]) => id);
/** 動く額と飾り（時刻で絵が変わる） */
export const FRAME_PHASES = { neon: 2, bulbs: 3 };
export const MOVING_DECOS = ['sparkle', 'petals'];
const hash01 = (a, b = 0) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
/** 動く額の、sec の時の絵（電球: 3つで一回りする明かりの順番、6 回/秒で進む。ネオン: たまに一瞬暗くなる＝1）。時刻だけで決まる */
export function framePhase(style, sec) {
  const t = Number.isFinite(sec) ? Math.max(0, sec) : 0;
  if (style === 'bulbs') return Math.floor(t * 6) % 3;
  if (style === 'neon') { const n = Math.floor(t * 10); return hash01(n + 1, 17) < .09 || (hash01(n + 3, 5) < .04 && n % 2) ? 1 : 0; }
  return 0;
}
export const FRAME_TILTS = [['none', 'なし（正面のまま）'], ['sway', 'ゆっくり左右に振れる'], ['topBack', '上が奥へ倒れる'], ['rightFront', '右が手前に来る'], ['leftFront', '左が手前に来る'], ['orbit', 'ぐるっと回り込む']];
const TILT_IDS = FRAME_TILTS.map(([id]) => id);
export const PERSON_MOVES = [['pop', '飛び出したまま'], ['forward', 'ゆっくり前へ'], ['counter', '額縁と逆に動く'], ['nudge', '前に出て、少し下がる'], ['float', 'ふわふわ漂う'], ['stay', 'その場に残る']];
const MOVE_IDS = PERSON_MOVES.map(([id]) => id);
const num = (x, lo, hi, d) => typeof x === 'number' && Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d;
export function cleanFrameStage(value) {
  const v = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return { enabled: v.enabled === true, style: STYLE_IDS.includes(v.style) ? v.style : 'gold', color: typeof v.color === 'string' && /^#[0-9a-f]{6}$/i.test(v.color) ? v.color.toLowerCase() : '', deco: DECO_IDS.includes(v.deco) ? v.deco : 'none',
    pop: Math.round(num(v.pop, 0, 1, .4) * 100) / 100, size: Math.round(num(v.size, .5, .95, .78) * 100) / 100,
    tilt: TILT_IDS.includes(v.tilt) ? v.tilt : 'none', tiltAmount: Math.round(num(v.tiltAmount, 0, 1, .5) * 100) / 100, personMove: MOVE_IDS.includes(v.personMove) ? v.personMove : 'pop',
    solidX: Math.round(num(v.solidX, -1, 1, 0) * 100) / 100, solidY: Math.round(num(v.solidY, -1, 1, 0) * 100) / 100 };
}

// the frame's width around the picture (world units, from the picture's shorter side), and the room left for its shadow on the wall
// (ポラロイドは下だけ太い。額の絵は上下そろえて作るので、ここは太い方。上の余りは透明)
export const borderOf = (style, w, h) => Math.min(w, h) * ({ gold: .11, wood: .09, black: .035, white: .13, baroque: .15, neon: .075, bulbs: .13, polaroid: .22, film: .14 }[style] ?? .1);
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
    // その場に残る (and always without the frame): the person stays where she is while the background breaks around her, just a breath of life
    case 'stay': return { s: 1 + .03 * o, x: 0, y: o * .012 * Math.sin(2 * Math.PI * sec / 3.4), z: .08 * o, rx: 0, ry: 0, rz: 0 };
    case 'float': { const a = 2 * Math.PI * sec; return { ...base, y: base.y + o * .03 * Math.sin(a / 3.2), rz: o * .035 * Math.sin(a / 4.1), ry: o * .12 * Math.sin(a / 5.3) }; }
    default: return base;
  }
}
export function pickPersonMove(current, random = Math.random) { const pool = MOVE_IDS.filter(id => id !== current); return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]; }

// the frame as a picture: a board with a w × h hole (k pixels per world unit), its bevel lit from the top left, and its soft shadow on the wall
export function drawFrame(style, w, h, k = 200, { color = '', phase = 0 } = {}) {
  const b = borderOf(style, w, h), W = Math.round((w + 2 * b + 2 * SHADOW) * k), H = Math.round((h + 2 * b + 2 * SHADOW) * k);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  const ox = SHADOW * k, oy = SHADOW * k, fw = (w + 2 * b) * k, fh = (h + 2 * b) * k, B = b * k;
  if (FANCY[style]) { FANCY[style](x, { L: ox, T: oy, R: ox + fw, Bt: oy + fh, il: ox + B, it: oy + B, ir: ox + fw - B, ib: oy + fh - B, B, k, side: Math.min(w, h) * k }, color || FRAME_COLORS[style], phase); return { canvas: c, width: W / k, height: H / k }; }
  const ring = (inset) => { x.beginPath(); x.rect(ox + inset, oy + inset, fw - 2 * inset, fh - 2 * inset); x.rect(ox + B, oy + B, fw - 2 * B, fh - 2 * B); };
  // shadow on the wall (drawn with the board, then the board is painted over it)
  x.save(); x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = .16 * k; x.shadowOffsetX = .04 * k; x.shadowOffsetY = .08 * k;
  x.fillStyle = '#000'; ring(0); x.fill('evenodd'); x.restore();
  const look = color ? toneOf(color) : {
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
      x.save(); x.strokeStyle = color ? 'rgba(255,255,255,.4)' : 'rgba(255,240,190,.55)'; x.lineWidth = Math.max(1, .012 * k); const d = B * .45; x.strokeRect(L + d, T + d, fw - 2 * d, fh - 2 * d); x.restore();
      x.save(); x.strokeStyle = 'rgba(80,55,10,.5)'; x.lineWidth = Math.max(1, .008 * k); const e = B * .52; x.strokeRect(L + e, T + e, fw - 2 * e, fh - 2 * e); x.restore();
    }
    // the inner lip, where the picture sits
    x.save(); x.strokeStyle = look.lip; x.lineWidth = Math.max(2, .02 * k); x.strokeRect(il - x.lineWidth / 2, it - x.lineWidth / 2, ir - il + x.lineWidth, ib - it + x.lineWidth); x.restore();
  }
  return { canvas: c, width: W / k, height: H / k };
}

// ---- 2026-11-17: 額の色、新しい額（バロック・ネオン管・電球・ポラロイド・フィルム）、重ねる飾り
const mixRGB = (hex, to, k) => { const a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16), c = s => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k); return `rgb(${c(16)},${c(8)},${c(0)})`; };
/** 1つの色から、額の面・明るい面・暗い面・内側の縁の色を作る */
export const toneOf = hex => ({ base: hex, light: mixRGB(hex, '#ffffff', .45), dark: mixRGB(hex, '#000000', .5), lip: mixRGB(hex, '#000000', .78) });
function wallShadow(x, k, path, hole) { x.save(); x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = .16 * k; x.shadowOffsetX = .04 * k; x.shadowOffsetY = .08 * k; x.fillStyle = '#000'; x.beginPath(); path(); hole(); x.fill('evenodd'); x.restore(); }
/** 額の4つの面（左上から光が当たる）: 外 (L,T,R,Bt) と内 (il,it,ir,ib) の間 */
function bevel(x, g, t) {
  const { L, T, R, Bt, il, it, ir, ib } = g, side = (pts, shade) => { x.beginPath(); x.moveTo(...pts[0]); for (const p of pts.slice(1)) x.lineTo(...p); x.closePath(); x.fillStyle = shade; x.fill(); };
  const grad = (x0, y0, x1, y1, a, z) => { const gr = x.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, a); gr.addColorStop(1, z); return gr; };
  side([[L, T], [R, T], [ir, it], [il, it]], grad(0, T, 0, it, t.light, t.base)); side([[L, Bt], [R, Bt], [ir, ib], [il, ib]], grad(0, Bt, 0, ib, t.dark, t.base));
  side([[L, T], [L, Bt], [il, ib], [il, it]], grad(L, 0, il, 0, t.light, t.base)); side([[R, T], [R, Bt], [ir, ib], [ir, it]], grad(R, 0, ir, 0, t.dark, t.base));
}
const lip = (x, g, colour, width) => { x.save(); x.strokeStyle = colour; x.lineWidth = width; x.strokeRect(g.il - width / 2, g.it - width / 2, g.ir - g.il + width, g.ib - g.it + width); x.restore(); };
/** 外の四角の周り（左上から時計回り）で、d だけ内側の線の上の点を、間隔 step で並べる。返す: [{x, y, along: 0..1}] */
function aroundRect(g, d, step) {
  const x0 = g.L + d, y0 = g.T + d, x1 = g.R - d, y1 = g.Bt - d, sides = [[x0, y0, x1, y0], [x1, y0, x1, y1], [x1, y1, x0, y1], [x0, y1, x0, y0]], out = [];
  const total = 2 * (x1 - x0 + y1 - y0); let at = 0;
  for (const [ax, ay, bx, by] of sides) { const len = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(len / step)); for (let i = 0; i < n; i++) { const f = i / n; out.push({ x: ax + (bx - ax) * f, y: ay + (by - ay) * f, along: (at + len * f) / total }); } at += len; }
  return out;
}
/** 飾り彫り: 扇の形の貝（lobes 枚）。(cx, cy) から向き a へ、長さ r */
function shell(x, cx, cy, a, r, t, lobes = 7, spread = 1.7) {
  for (let i = 0; i < lobes; i++) {
    const b = a + (i / (lobes - 1) - .5) * spread, ex = cx + Math.cos(b) * r * .55, ey = cy + Math.sin(b) * r * .55;
    x.save(); x.translate(ex, ey); x.rotate(b); const gr = x.createLinearGradient(-r * .5, 0, r * .5, 0); gr.addColorStop(0, t.dark); gr.addColorStop(.55, t.light); gr.addColorStop(1, t.base);
    x.fillStyle = gr; x.beginPath(); x.ellipse(0, 0, r * .5, r * .13, 0, 0, 6.2832); x.fill(); x.strokeStyle = t.lip; x.globalAlpha = .55; x.lineWidth = Math.max(1, r * .025); x.stroke(); x.restore();
  }
  x.save(); const gr = x.createRadialGradient(cx - r * .05, cy - r * .05, 0, cx, cy, r * .2); gr.addColorStop(0, t.light); gr.addColorStop(1, t.dark); x.fillStyle = gr; x.beginPath(); x.arc(cx, cy, r * .18, 0, 6.2832); x.fill(); x.restore();
}
/** 渦の巻き（C の字の帯と、端の巻き） */
function scroll(x, pts, r, t, w) {
  for (const [colour, off, width] of [[t.lip, w * .35, w * 1.25], [t.light, 0, w]]) {
    x.save(); x.strokeStyle = colour; x.lineWidth = width; x.lineCap = 'round'; x.translate(off, off);
    x.beginPath(); x.moveTo(...pts[0]); x.bezierCurveTo(...pts[1], ...pts[2], ...pts[3]); x.stroke();
    const [ex, ey] = pts[3]; x.beginPath(); for (let i = 0; i <= 24; i++) { const a = i / 24 * 5.6, rr = r * (1 - i / 30); const px = ex + Math.cos(a + 3.6) * rr, py = ey + Math.sin(a + 3.6) * rr; if (i) x.lineTo(px, py); else x.moveTo(px, py); } x.stroke(); x.restore();
  }
}
const FANCY = {
  baroque(x, g, colour) {
    const t = toneOf(colour), { L, T, R, Bt, B } = g;
    wallShadow(x, g.k, () => x.rect(L, T, R - L, Bt - T), () => x.rect(g.il, g.it, g.ir - g.il, g.ib - g.it));
    bevel(x, g, t);
    x.save(); x.strokeStyle = t.light; x.globalAlpha = .7; x.lineWidth = Math.max(1, B * .05); x.strokeRect(L + B * .3, T + B * .3, R - L - B * .6, Bt - T - B * .6); x.strokeStyle = t.dark; x.lineWidth = Math.max(1, B * .035); x.strokeRect(L + B * .38, T + B * .38, R - L - B * .76, Bt - T - B * .76); x.restore();
    for (const p of aroundRect(g, B * .8, B * .13)) { const r = B * .045, gr = x.createRadialGradient(p.x - r * .3, p.y - r * .3, 0, p.x, p.y, r); gr.addColorStop(0, t.light); gr.addColorStop(1, t.dark); x.fillStyle = gr; x.beginPath(); x.arc(p.x, p.y, r, 0, 6.2832); x.fill(); }   // 玉の縁
    // 四隅: 斜めに外を向いた大きな貝と、辺に沿って伸びる渦。辺の真ん中: 小さな貝
    for (const [cx, cy, sx, sy] of [[L, T, 1, 1], [R, T, -1, 1], [R, Bt, -1, -1], [L, Bt, 1, -1]]) {
      x.save(); x.translate(cx, cy); x.scale(sx, sy);
      scroll(x, [[B * .55, B * .32], [B * 1.1, B * .05], [B * 1.6, B * .55], [B * 2.1, B * .36]], B * .14, t, B * .09);
      scroll(x, [[B * .32, B * .55], [B * .05, B * 1.1], [B * .55, B * 1.6], [B * .36, B * 2.1]], B * .14, t, B * .09);
      shell(x, B * .62, B * .62, Math.PI * 1.25, B * 1.05, t, 7, 1.9);
      x.restore();
    }
    for (const [cx, cy, a] of [[(L + R) / 2, T + B * .45, -Math.PI / 2], [(L + R) / 2, Bt - B * .45, Math.PI / 2], [L + B * .45, (T + Bt) / 2, Math.PI], [R - B * .45, (T + Bt) / 2, 0]]) shell(x, cx, cy, a, B * .75, t, 5, 1.6);
    lip(x, g, t.lip, Math.max(2, .02 * g.k));
  },
  neon(x, g, colour, phase) {
    const { il, it, ir, ib, B, k } = g, bar = Math.max(2, g.side * .018), lit = phase === 0;
    x.save(); x.fillStyle = '#0d0d10'; x.beginPath(); x.rect(il - bar, it - bar, ir - il + 2 * bar, ib - it + 2 * bar); x.rect(il, it, ir - il, ib - it); x.fill('evenodd'); x.restore();   // 絵の周りの、細い黒い縁
    const d = bar + (B - bar) * .5, r = B * .35, path = () => { x.beginPath(); x.roundRect(il - d, it - d, ir - il + 2 * d, ib - it + 2 * d, r); };
    x.save(); x.lineJoin = 'round'; x.strokeStyle = colour; x.shadowColor = colour;
    for (const [blur, width, alpha] of [[.18, .03, lit ? .85 : .25], [.06, .02, lit ? 1 : .4]]) { x.shadowBlur = blur * k; x.lineWidth = width * k; x.globalAlpha = alpha; path(); x.stroke(); }
    x.shadowBlur = 0; x.globalAlpha = lit ? 1 : .45; x.strokeStyle = mixRGB(colour, '#ffffff', .75); x.lineWidth = .008 * k; path(); x.stroke(); x.restore();
    for (const p of aroundRect(g, B - d, B * 3)) { x.save(); x.fillStyle = 'rgba(20,20,24,.85)'; x.fillRect(p.x - .006 * k, p.y - .006 * k, .012 * k, .012 * k); x.restore(); }   // 管の留め具
  },
  bulbs(x, g, colour, phase) {
    const t = toneOf(colour), { L, T, R, Bt, B, k } = g;
    wallShadow(x, k, () => x.rect(L, T, R - L, Bt - T), () => x.rect(g.il, g.it, g.ir - g.il, g.ib - g.it));
    bevel(x, g, t);
    x.save(); x.strokeStyle = '#e8c66a'; x.lineWidth = Math.max(1, B * .05); x.strokeRect(L + B * .08, T + B * .08, R - L - B * .16, Bt - T - B * .16); x.strokeRect(g.il - B * .08, g.it - B * .08, g.ir - g.il + B * .16, g.ib - g.it + B * .16); x.restore();
    const bulbs = aroundRect(g, B * .5, B * .62), r = B * .17;
    bulbs.forEach((p, i) => { x.fillStyle = '#2a1010'; x.beginPath(); x.arc(p.x, p.y, r * 1.25, 0, 6.2832); x.fill(); });
    bulbs.forEach((p, i) => { if ((i + phase) % 3 === 0) return; const gr = x.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3); gr.addColorStop(0, 'rgba(255,214,120,.75)'); gr.addColorStop(1, 'rgba(255,170,40,0)'); x.fillStyle = gr; x.beginPath(); x.arc(p.x, p.y, r * 3, 0, 6.2832); x.fill(); });   // 光（先に全部）
    bulbs.forEach((p, i) => {
      const on = (i + phase) % 3 !== 0, gr = x.createRadialGradient(p.x - r * .3, p.y - r * .3, 0, p.x, p.y, r);
      if (on) { gr.addColorStop(0, '#ffffff'); gr.addColorStop(.45, '#fff2b0'); gr.addColorStop(1, '#ffc34d'); } else { gr.addColorStop(0, '#b08a4a'); gr.addColorStop(1, '#4a3416'); }
      x.fillStyle = gr; x.beginPath(); x.arc(p.x, p.y, r, 0, 6.2832); x.fill();
    });
    lip(x, g, t.lip, Math.max(2, .02 * k));
  },
  polaroid(x, g, colour) {
    const { il, it, ir, ib, Bt, k } = g, s = g.side * .06, x0 = il - s, y0 = it - s, x1 = ir + s, y1 = Bt;
    wallShadow(x, k, () => x.rect(x0, y0, x1 - x0, y1 - y0), () => x.rect(il, it, ir - il, ib - it));
    x.save(); x.beginPath(); x.rect(x0, y0, x1 - x0, y1 - y0); x.rect(il, it, ir - il, ib - it); x.clip('evenodd');
    const gr = x.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, mixRGB(colour, '#ffffff', .35)); gr.addColorStop(1, mixRGB(colour, '#000000', .06)); x.fillStyle = gr; x.fillRect(x0, y0, x1 - x0, y1 - y0);
    for (let i = 0; i < 1800; i++) { x.fillStyle = hash01(i, 3) < .5 ? 'rgba(0,0,0,.035)' : 'rgba(255,255,255,.05)'; x.fillRect(x0 + hash01(i, 7) * (x1 - x0), y0 + hash01(i, 11) * (y1 - y0), 1.5, 1.5); }   // 紙の目
    x.restore();
    x.save(); x.strokeStyle = 'rgba(0,0,0,.28)'; x.lineWidth = Math.max(1.5, .006 * k); x.strokeRect(il, it, ir - il, ib - it); x.restore();   // 写真の縁
  },
  film(x, g, colour) {
    const { L, T, R, Bt, il, it, ir, ib, B, k } = g;
    wallShadow(x, k, () => x.rect(L, T, R - L, Bt - T), () => x.rect(il, it, ir - il, ib - it));
    x.save(); x.fillStyle = colour; x.beginPath(); x.rect(L, T, R - L, Bt - T); x.rect(il, it, ir - il, ib - it); x.fill('evenodd');
    // 送り穴（後ろから光が透けて、明るく見える）
    const hw = B * .3, hh = B * .4, step = B * .62;
    for (const cy of [T + B * .5, Bt - B * .5]) for (let cx = L + step * .5; cx < R; cx += step) { x.fillStyle = '#efeadf'; x.beginPath(); x.roundRect(cx - hw / 2, cy - hh / 2, hw, hh, hw * .22); x.fill(); x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(cx - hw / 2, cy - hh / 2, hw, hh * .14); }
    // コマ番号（橙色の小さな字）
    x.fillStyle = 'rgba(232,160,64,.85)'; x.font = `700 ${Math.round(B * .17)}px sans-serif`; x.textBaseline = 'middle';
    for (let i = 0, cx = L + step * 1.05; cx < R - step; i++, cx += step * 4) { x.fillText(i % 2 ? `${12 + (i >> 1)}A` : `▶ ${12 + (i >> 1)}`, cx, T + B * .5); x.fillText(`${12 + (i >> 1)}`, cx + step * 2, Bt - B * .5); }
    x.restore();
    x.save(); x.strokeStyle = 'rgba(255,255,255,.08)'; x.lineWidth = 1; x.strokeRect(il - .5, it - .5, ir - il + 1, ib - it + 1); x.restore();
  },
};

/**
 * 重ねる飾り: 額の絵と同じ大きさ・同じ位置の絵（額の上、絵や立体の上に重なる）。花とテープは動かない、キラキラと花びらは sec で動く
 * （dur: 全体の長さ。どちらも、ちょうど何回か回って終わるので、最後のコマが最初のコマにつながる）
 */
export function drawDeco(kind, style, w, h, k = 200, sec = 0, dur = 10, canvas = null) {
  const b = borderOf(style, w, h), W = Math.round((w + 2 * b + 2 * SHADOW) * k), H = Math.round((h + 2 * b + 2 * SHADOW) * k);
  const c = canvas || document.createElement('canvas'); if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
  const x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, W, H);
  const B = b * k, L = SHADOW * k, T = SHADOW * k, R = W - SHADOW * k, Bt = H - SHADOW * k, il = L + B, it = T + B, ir = R - B, ib = Bt - B, side = Math.min(w, h) * k, D = dur > 0 ? dur : 10, u = sec / D;
  if (kind === 'flowers') { flowerCorner(x, L + B * .35, T + B * .35, side * .28, 1, 1, 3); flowerCorner(x, R - B * .35, Bt - B * .35, side * .24, -1, -1, 11); flowerCorner(x, R - B * .3, T + B * .3, side * .13, -1, 1, 23); flowerCorner(x, L + B * .3, Bt - B * .3, side * .1, 1, -1, 31); }
  else if (kind === 'tape') {
    const colours = ['#e8d9b5', '#f6c1cf', '#b9e0f2', '#c8e6b0'], len = side * .26, wid = side * .065;
    [[il, it, -Math.PI / 4], [ir, it, Math.PI / 4], [ir, ib, -Math.PI / 4], [il, ib, Math.PI / 4]].forEach(([cx, cy, a], i) => tape(x, cx, cy, a + (hash01(i, 2) - .5) * .25, len, wid, colours[i], i));
  } else if (kind === 'sparkle') {
    const n = 26, loops = Math.max(1, Math.round(D / 6)), tw = Math.max(1, Math.round(D * 1.2)), d = Math.max(B * .5, side * .015), x0 = L + d, y0 = T + d, x1 = R - d, y1 = Bt - d, per = 2 * (x1 - x0 + y1 - y0);
    for (let i = 0; i < n; i++) {
      let a = ((i / n + loops * u + hash01(i, 4) * .02) % 1) * per; const [px, py] = a < x1 - x0 ? [x0 + a, y0] : (a -= x1 - x0) < y1 - y0 ? [x1, y0 + a] : (a -= y1 - y0) < x1 - x0 ? [x1 - a, y1] : [x0, y1 - (a - (x1 - x0))];
      const sz = side * .032 * (.35 + .65 * (.5 + .5 * Math.sin(2 * Math.PI * (i * .618 + tw * u)))) * (.7 + .6 * hash01(i, 9));
      star(x, px + (hash01(i, 1) - .5) * B * .5, py + (hash01(i, 6) - .5) * B * .5, sz);
    }
  } else if (kind === 'petals') {
    const n = 42, m = side * .25;
    for (let i = 0; i < n; i++) {
      const fall = 1 + (i % 2), sway = 1 + (i % 3), spin = 1 + (i % 2), y = (((hash01(i, 1) + fall * u) % 1) * (H + 2 * m)) - m;
      const px = hash01(i, 2) * W + Math.sin(2 * Math.PI * (sway * u) + hash01(i, 3) * 6) * side * .06;
      petal(x, px, y, side * .042 * (.7 + .6 * hash01(i, 4)), 2 * Math.PI * spin * u + hash01(i, 5) * 10, Math.cos(2 * Math.PI * spin * u + hash01(i, 7) * 7));
    }
  }
  return { canvas: c, width: W / k, height: H / k };
}
function leaf(x, cx, cy, a, l, wd) {
  x.save(); x.translate(cx, cy); x.rotate(a); const gr = x.createLinearGradient(0, -wd, 0, wd); gr.addColorStop(0, '#7fbf5a'); gr.addColorStop(1, '#3f7a30'); x.fillStyle = gr;
  x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(l * .5, -wd, l, 0); x.quadraticCurveTo(l * .5, wd, 0, 0); x.fill(); x.strokeStyle = 'rgba(30,60,20,.5)'; x.lineWidth = Math.max(1, wd * .12); x.beginPath(); x.moveTo(0, 0); x.lineTo(l * .9, 0); x.stroke(); x.restore();
}
function blossom(x, cx, cy, r, colour, turn) {
  for (let p = 0; p < 5; p++) {
    const a = turn + p * 2 * Math.PI / 5, ex = cx + Math.cos(a) * r * .5, ey = cy + Math.sin(a) * r * .5;
    x.save(); x.translate(ex, ey); x.rotate(a); const gr = x.createRadialGradient(-r * .35, 0, 0, 0, 0, r * .6); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, colour);
    x.fillStyle = gr; x.beginPath(); x.ellipse(0, 0, r * .55, r * .4, 0, 0, 6.2832); x.fill(); x.strokeStyle = 'rgba(160,60,90,.25)'; x.lineWidth = Math.max(1, r * .03); x.stroke(); x.restore();
  }
  x.fillStyle = '#ffd54f'; x.beginPath(); x.arc(cx, cy, r * .2, 0, 6.2832); x.fill(); x.fillStyle = '#e09a2a'; for (let i = 0; i < 6; i++) { const a = i * 1.05 + turn; x.beginPath(); x.arc(cx + Math.cos(a) * r * .1, cy + Math.sin(a) * r * .1, r * .035, 0, 6.2832); x.fill(); }
}
/** 隅の花かご: (cx, cy) が隅、(sx, sy) が額の内側へ向かう向き */
function flowerCorner(x, cx, cy, size, sx, sy, seed) {
  const r = i => hash01(seed + i, seed * 3 + 1), colours = ['#f7a1c4', '#fff5f8', '#ffc29a', '#f48fb1'];
  x.save(); x.translate(cx, cy); x.scale(sx, sy);
  x.strokeStyle = '#4f7d36'; x.lineWidth = Math.max(1.5, size * .025); x.lineCap = 'round';
  for (const [ex, ey] of [[size * 2.6, size * .2], [size * .2, size * 2.2]]) {   // 辺に沿うツタ
    x.beginPath(); x.moveTo(0, 0); x.bezierCurveTo(ex * .35, ey * .35 + size * .25, ex * .65, ey * .65 - size * .2, ex, ey); x.stroke();
    for (let i = 1; i <= 5; i++) { const f = i / 6, px = ex * f, py = ey * f + Math.sin(f * 6) * size * .08; leaf(x, px, py, Math.atan2(ey, ex) + (i % 2 ? -.9 : .9), size * .22, size * .07); }
  }
  for (let i = 0; i < 7; i++) leaf(x, size * (.15 + .3 * r(i)), size * (.15 + .3 * r(i + 9)), r(i + 20) * Math.PI / 2 + (i % 2 ? -.3 : .4), size * (.35 + .2 * r(i + 30)), size * .1);
  blossom(x, size * .32, size * .3, size * .42, colours[0], r(1) * 2);
  blossom(x, size * .9, size * .12, size * .26, colours[1], r(2) * 2);
  blossom(x, size * .14, size * .88, size * .28, colours[2], r(3) * 2);
  blossom(x, size * .7, size * .62, size * .18, colours[3], r(4) * 2);
  for (const [bx, by] of [[size * 1.35, size * .3], [size * .35, size * 1.3]]) { x.fillStyle = '#f48fb1'; x.beginPath(); x.ellipse(bx, by, size * .06, size * .09, .6, 0, 6.2832); x.fill(); }   // つぼみ
  x.restore();
}
function tape(x, cx, cy, a, len, wid, colour, seed) {
  x.save(); x.translate(cx, cy); x.rotate(a); x.globalAlpha = .86;
  const teeth = 7, path = () => { x.beginPath(); x.moveTo(-len / 2, -wid / 2); x.lineTo(len / 2, -wid / 2); for (let i = 1; i <= teeth; i++) x.lineTo(len / 2 + (i % 2 ? wid * .05 : -wid * .03) * (1 + hash01(seed, i)), -wid / 2 + wid * i / teeth); x.lineTo(-len / 2, wid / 2); for (let i = teeth - 1; i >= 0; i--) x.lineTo(-len / 2 + (i % 2 ? -wid * .05 : wid * .03) * (1 + hash01(seed + 5, i)), -wid / 2 + wid * i / teeth); x.closePath(); };
  x.shadowColor = 'rgba(0,0,0,.25)'; x.shadowBlur = wid * .2; x.shadowOffsetY = wid * .06; x.fillStyle = colour; path(); x.fill(); x.shadowColor = 'transparent';
  x.save(); path(); x.clip(); x.globalAlpha = .18; x.strokeStyle = '#ffffff'; x.lineWidth = wid * .12; for (let s = -len; s < len; s += wid * .5) { x.beginPath(); x.moveTo(s, -wid); x.lineTo(s + wid, wid); x.stroke(); } x.restore();   // 斜めの縞
  x.restore();
}
function star(x, cx, cy, r) {
  const gr = x.createRadialGradient(cx, cy, 0, cx, cy, r * 2.6); gr.addColorStop(0, 'rgba(255,246,210,.9)'); gr.addColorStop(1, 'rgba(255,220,140,0)'); x.fillStyle = gr; x.beginPath(); x.arc(cx, cy, r * 2.6, 0, 6.2832); x.fill();
  x.fillStyle = '#ffffff'; x.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * .22 : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.closePath(); x.fill();
}
function petal(x, cx, cy, l, rot, flip) {
  x.save(); x.translate(cx, cy); x.rotate(rot); x.scale(Math.max(.15, Math.abs(flip)), 1);
  const gr = x.createLinearGradient(0, -l, 0, l); gr.addColorStop(0, '#ffe3ee'); gr.addColorStop(1, '#f28db8'); x.fillStyle = gr;
  x.beginPath(); x.moveTo(0, l); x.bezierCurveTo(l * .9, l * .2, l * .6, -l * .9, l * .12, -l); x.lineTo(0, -l * .78); x.lineTo(-l * .12, -l); x.bezierCurveTo(-l * .6, -l * .9, -l * .9, l * .2, 0, l); x.fill(); x.restore();
}

// the picture without the person: where the cut-out is, each row is filled from the colours on its left and right, softened, so the pieces
// that break away (and the solid they make) carry no copy of the person. Both canvases are the picture's size.
export function cleanPlate(source, cut) {
  const W = source.width, H = source.height, ctx = c => c.getContext('2d', { willReadFrequently: true });
  const src = ctx(source).getImageData(0, 0, W, H), alpha = ctx(cut).getImageData(0, 0, W, H).data, d = src.data;
  // the mask, a little wider than the person (hair edges)
  const m0 = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) m0[i] = alpha[i * 4 + 3] > 20 ? 1 : 0;
  const r = Math.max(2, Math.round(Math.max(W, H) / 250)), m1 = new Uint8Array(W * H), mask = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) { let last = -1e9; for (let x = 0; x < W; x++) { if (m0[y * W + x]) last = x; if (x - last <= r) m1[y * W + x] = 1; } last = 1e9; for (let x = W - 1; x >= 0; x--) { if (m0[y * W + x]) last = x; if (last - x <= r) m1[y * W + x] = 1; } }
  for (let x = 0; x < W; x++) { let last = -1e9; for (let y = 0; y < H; y++) { if (m1[y * W + x]) last = y; if (y - last <= r) mask[y * W + x] = 1; } last = 1e9; for (let y = H - 1; y >= 0; y--) { if (m1[y * W + x]) last = y; if (last - y <= r) mask[y * W + x] = 1; } }
  const fill = new Uint8ClampedArray(d), avg = (y, x0, x1) => { let n = 0, c = [0, 0, 0]; for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) { const i = (y * W + x) * 4; c[0] += d[i]; c[1] += d[i + 1]; c[2] += d[i + 2]; n++; } return n ? c.map(v => v / n) : null; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W;) {
    if (!mask[y * W + x]) { x++; continue; }
    let e = x; while (e < W && mask[y * W + e]) e++;
    const L = x > 0 ? avg(y, x - 5, x - 1) : null, R = e < W ? avg(y, e, e + 4) : null, a = L || R, b = R || L;
    if (a) for (let k = x; k < e; k++) { const t = e - x > 1 ? (k - x) / (e - x - 1) : .5, i = (y * W + k) * 4; for (let c = 0; c < 3; c++) fill[i + c] = a[c] + (b[c] - a[c]) * t; fill[i + 3] = 255; }
    x = e;
  }
  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const filled = canvas(W, H); ctx(filled).putImageData(new ImageData(fill, W, H), 0, 0);
  // soften the rows (they streak), and keep the softened fill only inside the (feathered) mask
  const soft = canvas(W, H), s = soft.getContext('2d'); s.filter = `blur(${Math.max(3, Math.round(Math.max(W, H) / 160))}px)`; s.drawImage(filled, 0, 0); s.filter = 'none';
  const mk = canvas(W, H), mi = new ImageData(W, H); for (let i = 0; i < W * H; i++) mi.data[i * 4 + 3] = mask[i] ? 255 : 0; ctx(mk).putImageData(mi, 0, 0);
  const feather = canvas(W, H), f = feather.getContext('2d'); f.filter = `blur(${r}px)`; f.drawImage(mk, 0, 0);
  s.globalCompositeOperation = 'destination-in'; s.drawImage(feather, 0, 0);
  const out = canvas(W, H), o = out.getContext('2d'); o.drawImage(source, 0, 0); o.drawImage(soft, 0, 0);
  return out;
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
  // 重ねる飾り: 額と同じ大きさの板（絵・立体・文字のあと、人物の前に、app.js が描く）
  const decoScene = new THREE.Scene(), deco = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material(null)); deco.position.z = .002; decoScene.add(deco);
  let size = { w: 1, h: 1 }, style = '', colour = '', decoKind = 'none', cut = null, plate = null, phases = [], shown = -1, decoCanvas = null, decoAt = NaN, decoOn = false;
  const DECO_K = 110;   // 動く飾りの細かさ（毎コマ描き直すので、少し粗く）
  function redraw() {
    for (const t of phases) t.dispose(); phases = []; shown = -1; frame.material.map = null;
    const n = FRAME_PHASES[style] || 1;
    for (let p = 0; p < n; p++) { const f = drawFrame(style, size.w, size.h, 200, { color: colour, phase: p }); phases.push(texture(f.canvas)); frame.scale.set(f.width, f.height, 1); }
    showPhase(0); redrawDeco(0, 10, true);
  }
  function showPhase(p) { if (p === shown || !phases[p]) return; shown = p; frame.material.map = phases[p]; frame.material.needsUpdate = true; }
  function redrawDeco(sec, dur, force = false) {
    if (decoKind === 'none' || !style) { deco.visible = false; return; }
    const moving = MOVING_DECOS.includes(decoKind);
    if (!force && (!moving || sec === decoAt)) return;
    decoAt = sec;
    const d = drawDeco(decoKind, style, size.w, size.h, moving ? DECO_K : 200, sec, dur, moving ? decoCanvas : null);
    if (moving) decoCanvas = d.canvas;
    if (!deco.material.map || deco.material.map.image !== d.canvas) { deco.material.map?.dispose(); deco.material.map = texture(d.canvas); deco.material.needsUpdate = true; } else deco.material.map.needsUpdate = true;
    deco.scale.set(d.width, d.height, 1);
  }
  return {
    back, front, decoScene,
    get decoVisible() { return decoOn; },
    setPicture(w, h) { size = { w, h }; if (style) redraw(); person.scale.set(w, h, 1); shadow.scale.set(w, h, 1); },
    setStyle(s) { if (s !== style) { style = s; redraw(); } },
    /** 額の種類・色・重ねる飾りをまとめて（cleanFrameStage の値） */
    setLook({ style: s, color = '', deco: d = 'none' }) {
      const restyle = s !== style || color !== colour; style = s; colour = color;
      if (d !== decoKind) { decoKind = d; decoCanvas = null; deco.material.map?.dispose(); deco.material.map = null; }
      if (restyle) redraw(); else redrawDeco(0, 10, true);
    },
    // cutCanvas: the cut-out placed on a canvas the same size as the picture (so it sits exactly on it), or null
    setCutout(cutCanvas, source = null) {
      cut = cutCanvas; plate = cut && source ? cleanPlate(source, cut) : null; for (const m of [person, shadow]) { m.material.map?.dispose(); m.material.map = null; }
      if (cut) { person.material.map = texture(cut); shadow.material.map = texture(shadowOf(cut)); }
      person.material.needsUpdate = shadow.material.needsUpdate = true;
    },
    get hasCutout() { return !!cut; },
    get plate() { return plate; },   // the picture without the person (null without a cut-out)
    get cutout() { return cut; },   // the person alone, on a canvas the size of the picture (null without a cut-out)
    // enabled: the frame is on; out: personOut(); camera: the scene camera (the person is drawn with it)
    // enabled: the frame is on (without it the person stays where she is: その場に残る)
    // hidePerson: the person is not drawn here (人物のほうを立体にする: she is the picture that breaks up)
    update({ enabled, out, hold = 0, sec = 0, dur = 10, tilt, move = 'pop', hidePerson = false }) {
      frame.visible = enabled;
      if (enabled) { showPhase(framePhase(style, sec)); redrawDeco(sec, dur); }
      decoOn = enabled && decoKind !== 'none'; deco.visible = decoOn;
      const show = !!cut && !hidePerson; shadow.visible = person.visible = show;
      if (!show) return;
      const p = personPose(enabled ? move : 'stay', out, hold, sec, tilt);   // in front of the frame (z), so a tilted camera sees it move against the frame
      person.scale.set(size.w * p.s, size.h * p.s, 1); person.position.set(p.x * size.w, p.y * size.h, p.z * size.h); person.rotation.set(p.rx, p.ry, p.rz);
      // the shadow on the wall: further off and softer the further out the person is
      const far = Math.min(1.6, out + p.z * .6);
      shadow.scale.set(size.w * (1 + .06 * far), size.h * (1 + .06 * far), 1); shadow.position.set(p.x * size.w + .05 * size.w * far, p.y * size.h * .5 - .05 * size.h * far, 0); shadow.material.opacity = (enabled ? .34 : .2) * out;
    },
    dispose() { for (const t of phases) t.dispose(); phases = []; frame.material.map = null; for (const m of [frame, shadow, person, deco]) { m.material.map?.dispose(); m.material.dispose(); m.geometry.dispose(); } },
  };
}
