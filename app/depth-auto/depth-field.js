// 奥行きマップ（0 = 奥、1 = 手前。行は上から下）の小さな道具。DOM なし（node でも動く）。
// 「写真の浮き彫り」（relief-shape.js）と、奥行きを作る係（depth-worker.js）が使う。

/** 値の並びを 0〜1 に直す（いちばん小さい = 0、いちばん大きい = 1）。全部同じ値なら 0 */
export function normalizeField(values) {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < values.length; i++) { const v = values[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
  const out = new Float32Array(values.length), span = hi - lo;
  if (!(span > 1e-12)) return out;
  for (let i = 0; i < values.length; i++) out[i] = (values[i] - lo) / span;
  return out;
}

/** ガウスぼかし（横→縦）。端は端の値をのばす。sigma は画素。髪の毛のような細い線を、まわりの深さに溶かすのに使う */
export function blurField(src, w, h, sigma) {
  if (!(sigma > 0.05)) return Float32Array.from(src);
  const r = Math.max(1, Math.ceil(sigma * 3)), k = new Float32Array(r * 2 + 1);
  let sum = 0;
  for (let i = -r; i <= r; i++) { k[i + r] = Math.exp(-(i * i) / (2 * sigma * sigma)); sum += k[i + r]; }
  for (let i = 0; i < k.length; i++) k[i] /= sum;
  const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let a = 0;
    for (let i = -r; i <= r; i++) a += src[y * w + Math.min(w - 1, Math.max(0, x + i))] * k[i + r];
    tmp[y * w + x] = a;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let a = 0;
    for (let i = -r; i <= r; i++) a += tmp[Math.min(h - 1, Math.max(0, y + i)) * w + x] * k[i + r];
    out[y * w + x] = a;
  }
  return out;
}

/** なめらかに読む。u: 左 0 → 右 1、v: 下 0 → 上 1（絵の座標。行は上から下なので、ここで逆さにする） */
export function sampleField(f, w, h, u, v) {
  const x = Math.min(w - 1, Math.max(0, u * (w - 1))), y = Math.min(h - 1, Math.max(0, (1 - v) * (h - 1)));
  const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1), fx = x - x0, fy = y - y0;
  const a = f[y0 * w + x0] * (1 - fx) + f[y0 * w + x1] * fx, b = f[y1 * w + x0] * (1 - fx) + f[y1 * w + x1] * fx;
  return a * (1 - fy) + b * fy;
}

/** 奥行きマップを、8bit の白黒画像（試験・確認用）にする。白 = 手前 */
export function fieldToBytes(f) {
  const out = new Uint8Array(f.length);
  for (let i = 0; i < f.length; i++) out[i] = Math.round(Math.min(1, Math.max(0, f[i])) * 255);
  return out;
}
