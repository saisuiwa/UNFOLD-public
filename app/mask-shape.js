// Any text (Japanese too, any web font) or an image silhouette → an extruded solid for the tile atlas.
// A mask is drawn on a canvas, traced with marching squares, and extruded with three.js.
import * as THREE from './vendor/three.module.min.js';
import {modelLayout} from './model-layout.js?v=9';

export const FONTS = {
  gothic: {label: 'ゴシック極太', family: '"Noto Sans JP","Hiragino Sans",sans-serif', weight: 900},
  mincho: {label: '明朝', family: '"Noto Serif JP","Hiragino Mincho ProN",serif', weight: 900},
  round: {label: '丸ゴシック', family: '"M PLUS Rounded 1c","Hiragino Maru Gothic ProN",sans-serif', weight: 800},
  dela: {label: 'デラゴシック', family: '"Dela Gothic One",sans-serif', weight: 400},
  marker: {label: 'マーカー手書き', family: '"Yusei Magic",sans-serif', weight: 400},
  dot: {label: 'ドット', family: '"DotGothic16",monospace', weight: 400},
};

export function validateMaskText(text) {
  const value = String(text).trim();
  if (!value || [...value].length > 32) throw new Error('文字は1〜32文字で入力してね（/ で改行）。');
  if (/[\u0000-\u001f]/.test(value)) throw new Error('使えない文字が含まれています。');
  return value;
}

// ------------------------------------------------------------- fields --
function textField(text, fontKey) {
  const f = FONTS[fontKey] || FONTS.gothic, px = 160, step = 2;
  const lines = text.split('/').map(s => s.trim()).filter(Boolean);
  const font = `${f.weight} ${px}px ${f.family}`;
  const c = document.createElement('canvas'), x = c.getContext('2d', {willReadFrequently: true});
  x.font = font;
  const width = Math.max(...lines.map(l => x.measureText(l).width));
  const pad = px * .2, lh = px * 1.12;
  c.width = Math.ceil(width + pad * 2); c.height = Math.ceil(lines.length * lh + pad * 2);
  x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
  x.font = font; x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
  lines.forEach((l, i) => x.fillText(l, c.width / 2, pad + lh * (i + .5)));
  return sample(x.getImageData(0, 0, c.width, c.height), step, (d, i) => d[i] / 255);
}

function imageField(img, sensitivity = .5) {
  const gw = 260, iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const gh = Math.max(8, Math.round(gw * ih / iw));
  const c = document.createElement('canvas'), x = c.getContext('2d', {willReadFrequently: true});
  c.width = gw; c.height = gh;
  x.drawImage(img, 0, 0, gw, gh);
  const data = x.getImageData(0, 0, gw, gh), d = data.data;
  let clear = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] < 200) clear++;
  if (clear > gw * gh * .02) return sample(data, 1, (p, i) => p[i + 3] / 255);   // real transparency
  // no alpha: cut away whatever looks like the border colour
  const border = [];
  for (let px = 0; px < gw; px++) border.push(px, (gh - 1) * gw + px);
  for (let py = 0; py < gh; py++) border.push(py * gw, py * gw + gw - 1);
  const med = [0, 1, 2].map(k => border.map(j => d[j * 4 + k]).sort((a, b) => a - b)[border.length >> 1]);
  const thr = .05 + (1 - sensitivity) * .35;
  return blur(sample(data, 1, (p, i) => {
    const dist = Math.hypot(p[i] - med[0], p[i + 1] - med[1], p[i + 2] - med[2]) / 441;
    return Math.min(1, Math.max(0, (dist - thr) / .06 + .5));
  }), 2);
}

// average step×step blocks into a padded scalar field (zero border keeps every contour closed)
function sample(img, step, value) {
  const w = Math.floor(img.width / step) + 2, h = Math.floor(img.height / step) + 2, v = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    let s = 0;
    for (let yy = 0; yy < step; yy++) for (let xx = 0; xx < step; xx++) s += value(img.data, (((y - 1) * step + yy) * img.width + (x - 1) * step + xx) * 4);
    v[y * w + x] = s / (step * step);
  }
  return {w, h, v};
}
function blur(f, passes) {
  const {w, h} = f;
  let v = f.v;
  for (let p = 0; p < passes; p++) {
    const o = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      let s = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += v[(y + dy) * w + x + dx];
      o[y * w + x] = s / 9;
    }
    v = o;
  }
  return {w, h, v};
}

// -------------------------------------------------------- contours --
function traceLoops({w, h, v}, iso = .5) {
  const verts = new Map();
  const vert = (key, x, y) => { if (!verts.has(key)) verts.set(key, {p: [x, y], n: []}); return key; };
  const hEdge = (x, y) => { const a = v[y * w + x], b = v[y * w + x + 1]; return vert('h' + (y * w + x), x + (iso - a) / (b - a), y); };
  const vEdge = (x, y) => { const a = v[y * w + x], b = v[(y + 1) * w + x]; return vert('v' + (y * w + x), x, y + (iso - a) / (b - a)); };
  const link = (a, b) => { verts.get(a).n.push(b); verts.get(b).n.push(a); };
  for (let y = 0; y < h - 1; y++) for (let x = 0; x < w - 1; x++) {
    const tl = v[y * w + x] > iso, tr = v[y * w + x + 1] > iso, bl = v[(y + 1) * w + x] > iso, br = v[(y + 1) * w + x + 1] > iso;
    if (tl === tr && tr === br && br === bl) continue;
    const T = () => hEdge(x, y), B = () => hEdge(x, y + 1), L = () => vEdge(x, y), R = () => vEdge(x + 1, y);
    if (tl === br && tr === bl) {   // saddle: cut off the corners that disagree with the centre
      const c = (v[y * w + x] + v[y * w + x + 1] + v[(y + 1) * w + x] + v[(y + 1) * w + x + 1]) / 4 > iso;
      if (tl !== c) link(T(), L());
      if (tr !== c) link(T(), R());
      if (br !== c) link(R(), B());
      if (bl !== c) link(B(), L());
      continue;
    }
    const e = [];
    if (tl !== tr) e.push(T());
    if (tr !== br) e.push(R());
    if (br !== bl) e.push(B());
    if (bl !== tl) e.push(L());
    link(e[0], e[1]);
  }
  const loops = [], seen = new Set();
  for (const [start] of verts) {
    if (seen.has(start)) continue;
    const loop = [];
    let prev = null, cur = start;
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      const node = verts.get(cur);
      loop.push(node.p);
      const next = node.n[0] !== prev ? node.n[0] : node.n[1];
      prev = cur; cur = next;
    }
    if (loop.length >= 4) loops.push(loop);
  }
  return loops;
}

function simplify(pts, eps) {   // Ramer–Douglas–Peucker on a closed loop
  const rdp = (a, b, out) => {
    let best = -1, far = 0;
    const [ax, ay] = pts[a], [bx, by] = pts[b % pts.length], dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / len;
      if (d > far) { far = d; best = i; }
    }
    if (far > eps) { rdp(a, best, out); rdp(best, b, out); } else out.push(pts[a]);
  };
  const half = pts.length >> 1, out = [];
  rdp(0, half, out); rdp(half, pts.length, out);
  return out;
}
const area = p => { let s = 0; for (let i = 0; i < p.length; i++) { const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length]; s += x1 * y2 - x2 * y1; } return Math.abs(s) / 2; };
function inside([x, y], p) {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i], [xj, yj] = p[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}

// ------------------------------------------------------------ solid --
function solidFromField(field, {depth, fitW, fitH, minArea, place}) {
  let loops = traceLoops(field).map(l => simplify(l, .35)).filter(l => l.length >= 3);
  const areas = loops.map(area);
  loops = loops.filter((_, i) => areas[i] >= minArea);
  const A = loops.map(area);
  if (!loops.length) throw new Error('形を切り抜けませんでした。感度を変えるか、背景がはっきりした画像を選んでね。');
  // even nesting depth = solid outline, odd = hole inside its nearest solid parent
  const depthOf = loops.map((l, i) => loops.reduce((n, o, j) => n + (j !== i && A[j] > A[i] && inside(l[0], o) ? 1 : 0), 0));
  const toV = ([x, y]) => new THREE.Vector2(x, -y);
  const shapes = new Map();
  loops.forEach((l, i) => { if (depthOf[i] % 2 === 0) shapes.set(i, new THREE.Shape(l.map(toV))); });
  loops.forEach((l, i) => {
    if (depthOf[i] % 2 === 0) return;
    let parent = -1;
    loops.forEach((o, j) => { if (depthOf[j] === depthOf[i] - 1 && inside(l[0], o) && (parent < 0 || A[j] < A[parent])) parent = j; });
    if (parent >= 0) shapes.get(parent).holes.push(new THREE.Path(l.map(toV)));
  });
  const geo = new THREE.ExtrudeGeometry([...shapes.values()], {depth, steps: 1, curveSegments: 1, bevelEnabled: true,
    bevelThickness: depth * .09, bevelSize: Math.min(.6, depth * .06), bevelSegments: 2});
  try {
    geo.computeBoundingBox();
    const b = geo.boundingBox;
    const pos = geo.getAttribute('position').array;
    const data = modelLayout(pos);
    if (place) {   // put the solid exactly where the picture shows it, so it pops straight out of the image
      const c = [0, 1, 2].map(k => (b.min.getComponent(k) + b.max.getComponent(k)) / 2), t = data.target, sc = data.scale;
      const unit = place.h / (field.h - 2);
      for (let i = 0; i < t.length; i += 3) {
        const gx = t[i] / sc + c[0], gy = -(t[i + 1] / sc + c[1]), gz = t[i + 2] / sc;
        t[i] = place.x + (gx - .5) / (field.w - 2) * place.w;
        t[i + 1] = place.y - (gy - .5) / (field.h - 2) * place.h;
        t[i + 2] = gz * unit;
      }
      return data;
    }
    const factor = Math.min(fitW / (b.max.x - b.min.x), fitH / (b.max.y - b.min.y)) / data.scale;
    for (let i = 0; i < data.target.length; i++) data.target[i] *= factor;
    data.scale *= factor;
    return data;
  } finally { geo.dispose(); }
}

// the web-font stylesheet may still be downloading; without it the canvas silently falls back to a system font
export async function ensureFont(font, glyphs) {
  const link = document.querySelector('link[href*="fonts.googleapis.com/css"]');
  if (link && !link.sheet) await Promise.race([new Promise(r => { link.addEventListener('load', r, {once: true}); link.addEventListener('error', r, {once: true}); }), new Promise(r => setTimeout(r, 4000))]);
  for (let tries = 0; tries < 3; tries++) {
    try { await document.fonts.load(font, glyphs); } catch { return; }   // offline: use the system fallback
    if (document.fonts.check(font, glyphs)) return;
    await new Promise(r => setTimeout(r, 300));
  }
}

export async function createMaskTextShape(text, fontKey = 'gothic') {
  const value = validateMaskText(text), f = FONTS[fontKey] || FONTS.gothic;
  const glyphs = value.replace(/\//g, '');
  await ensureFont(`${f.weight} 160px ${f.family}`, glyphs);
  const field = textField(value, fontKey);
  return solidFromField(field, {depth: 22, fitW: 5, fitH: 3.2, minArea: 3});
}

// place: the image's rectangle in world units {x: left, y: top, w, h}
export function createSilhouetteShape(img, sensitivity = .5, place = null) {
  const field = imageField(img, sensitivity);
  return solidFromField(field, {depth: 26, fitW: 4.6, fitH: 3.3, minArea: field.w * field.h * .002, place});
}
