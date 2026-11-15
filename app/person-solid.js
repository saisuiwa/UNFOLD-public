// 人物のほうを立体にする（2026-11-15）: 切り抜いた人物だけが崩れて立体になる時、人物の絵は絵の一部にしかないので、そのままだと立体が穴だらけになる。
// そこで「人物の柄だけで出来た、すき間のない絵」を作る:
//   1. 人物のまわりの四角（bbox）の中のすき間を、いちばん近い人物の色で埋める
//   2. その四角を、鏡写しにしながら絵いっぱいにくり返す
// 出来た絵は、色 = この絵・濃さ（アルファ）= 元の切り抜き、で1枚にまとめる。平らな間は切り抜きのまま見え、立体になるにつれて全面が見えてくる
// （絵の粒のシェーダーの uWhole）。上半分は DOM なし（node でも動く）。

/** 鏡写しのくり返し: 位置 i を、[lo, hi] の中へ折り返す（lo-1 → lo, lo-2 → lo+1, … / hi+1 → hi, …） */
export function mirrorInto(i, lo, hi) {
  const n = hi - lo + 1; if (n <= 1) return lo;
  let k = (i - lo) % (2 * n); if (k < 0) k += 2 * n;
  return lo + (k < n ? k : 2 * n - 1 - k);
}
/** 濃い所（alpha > 128）のまわりの四角。何もなければ null */
export function solidBox(alpha, W, H) {
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (alpha[y * W + x] > 128) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}
/**
 * すき間のない絵を作る。rgba: 切り抜き（W×H、RGBA 0–255、色はアルファを掛けていない物）。
 * 返す: { rgba: 同じ大きさの RGBA（アルファは全部 255）, gap: 埋めた所が 1（W×H。鏡写しの先でも同じ） }。
 * 濃い所はそのまま。四角の中のすき間は、いちばん近い濃い所の色（となりへ順に広げる）。四角の外は、四角の鏡写し。人物がいなければ null
 */
export function wholePicture(rgba, W, H) {
  const alpha = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) alpha[i] = rgba[i * 4 + 3];
  const box = solidBox(alpha, W, H); if (!box) return null;
  const from = new Int32Array(W * H).fill(-1), queue = new Int32Array(W * H); let head = 0, tail = 0;
  // only the fully solid pixels give their colour (a soft edge pixel is partly the background's colour, and would smear it over the gaps)
  let sure = 0; for (let i = 0; i < W * H; i++) if (alpha[i] >= 250) sure++;
  const least = sure ? 250 : 129;
  for (let i = 0; i < W * H; i++) if (alpha[i] >= least) { from[i] = i; queue[tail++] = i; }
  while (head < tail) {   // 濃い所から、となりへ順に広げる（四角の中だけ）
    const i = queue[head++], x = i % W, y = (i - x) / W;
    if (x > box.x0 && from[i - 1] < 0) { from[i - 1] = from[i]; queue[tail++] = i - 1; }
    if (x < box.x1 && from[i + 1] < 0) { from[i + 1] = from[i]; queue[tail++] = i + 1; }
    if (y > box.y0 && from[i - W] < 0) { from[i - W] = from[i]; queue[tail++] = i - W; }
    if (y < box.y1 && from[i + W] < 0) { from[i + W] = from[i]; queue[tail++] = i + W; }
  }
  const out = new Uint8ClampedArray(W * H * 4), gap = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    const sy = mirrorInto(y, box.y0, box.y1);
    for (let x = 0; x < W; x++) {
      const m = sy * W + mirrorInto(x, box.x0, box.x1), s = from[m] * 4, o = (y * W + x) * 4;
      out[o] = rgba[s]; out[o + 1] = rgba[s + 1]; out[o + 2] = rgba[s + 2]; out[o + 3] = 255; gap[y * W + x] = from[m] === m ? 0 : 1;
    }
  }
  return { rgba: out, gap };
}

// ---- ここから下は画面（canvas）を使う
/**
 * 切り抜き（絵と同じ大きさの canvas）から、立体用の絵を作る。返す: { data（RGBA、行は下から上 = テクスチャ用）, width, height } か null（人物がいない）。
 * 色 = 人物の柄で埋めた絵（埋めた所だけ、ぼかしてすじを和らげる。鏡写しの人物はそのまま）、ただし人物の所は元のまま。アルファ = 切り抜きのアルファ。
 * 埋める作業は長辺 long まで縮めてする（人物の所の色は、元の大きさのまま）
 */
export function personSolidPixels(cut, doc = globalThis.document, long = 640) {
  const W = cut.width, H = cut.height, k = Math.min(1, long / Math.max(W, H)), w = Math.max(2, Math.round(W * k)), h = Math.max(2, Math.round(H * k));
  const small = doc.createElement('canvas'); small.width = w; small.height = h; const sx = small.getContext('2d', { willReadFrequently: true }); sx.drawImage(cut, 0, 0, w, h);
  const made = wholePicture(sx.getImageData(0, 0, w, h).data, w, h); if (!made) return null;
  const sheet = () => { const c = doc.createElement('canvas'); c.width = w; c.height = h; return c; };
  const tmp = sheet(), tx = tmp.getContext('2d'); tx.putImageData(new ImageData(made.rgba, w, h), 0, 0);
  // the filled-in gaps: the same picture blurred, shown only where a gap was filled (soft edge)
  const soft = sheet(), fx = soft.getContext('2d'); fx.filter = `blur(${Math.max(2, Math.round(Math.max(w, h) / 90))}px)`; fx.drawImage(tmp, 0, 0); fx.filter = 'none';
  const mask = sheet(), mk = mask.getContext('2d'), md = mk.createImageData(w, h); for (let i = 0; i < w * h; i++) md.data[i * 4 + 3] = made.gap[i] * 255; mk.putImageData(md, 0, 0);
  const edge = sheet(), ex = edge.getContext('2d'); ex.filter = 'blur(2px)'; ex.drawImage(mask, 0, 0); ex.filter = 'none'; ex.globalCompositeOperation = 'source-in'; ex.drawImage(soft, 0, 0);
  tx.drawImage(edge, 0, 0);
  const big = doc.createElement('canvas'); big.width = W; big.height = H; const bx = big.getContext('2d', { willReadFrequently: true });
  bx.imageSmoothingQuality = 'high'; bx.filter = `blur(${Math.max(1, Math.round(Math.max(W, H) / 700))}px)`; bx.drawImage(tmp, 0, 0, W, H); bx.filter = 'none';
  const fill = bx.getImageData(0, 0, W, H).data, src = cut.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data, data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    const row = (H - 1 - y) * W * 4;   // テクスチャは下の行から
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4, o = row + x * 4, a = src[i + 3] / 255;
      data[o] = fill[i] + (src[i] - fill[i]) * a; data[o + 1] = fill[i + 1] + (src[i + 1] - fill[i + 1]) * a; data[o + 2] = fill[i + 2] + (src[i + 2] - fill[i + 2]) * a; data[o + 3] = src[i + 3];
    }
  }
  return { data, width: W, height: H };
}
