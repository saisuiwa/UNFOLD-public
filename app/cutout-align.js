// 切り抜き（人物だけの透過PNG）が、元の絵のどこにあるかを探す。MOTION LAB の site/lab/cutout.js の bestOffset・alignCutout を写した物（2026-11-09）。
// 直す時は、両方そろえる。切り抜く道具はまわりを詰めることがあるので、大きさが元の絵と違っても、いちばん色が合う位置を探す。

/**
 * RGBA の画素 a（aw×ah）の上に、b（bw×bh）をずらして重ね、色がいちばん合う位置 {x, y, err}。b の透明な所は見ない。err は色の差の平均（0..255）。
 * x0..x1・y0..y1 の範囲を探す（a の外にはみ出た点は、いちばん違うとする）
 */
export function bestOffset(a, aw, ah, b, bw, bh, {x0 = 0, x1 = aw - bw, y0 = 0, y1 = ah - bh} = {}) {
  const pts = [];
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { const i = (y * bw + x) * 4; if (b[i + 3] > 160) pts.push(x, y, b[i], b[i + 1], b[i + 2]); }
  const n = pts.length / 5, keep = Math.max(1, Math.ceil(n / 1500)), P = [];   // 見る点は 1500 まで（等しくまびく）
  for (let k = 0; k < n; k += keep) P.push(pts[k * 5], pts[k * 5 + 1], pts[k * 5 + 2], pts[k * 5 + 3], pts[k * 5 + 4]);
  const m = P.length / 5;
  let best = {x: 0, y: 0, err: Infinity};
  if (!m) return best;
  for (let oy = y0; oy <= y1; oy++) for (let ox = x0; ox <= x1; ox++) {
    let sum = 0;
    for (let k = 0; k < P.length; k += 5) {
      const x = ox + P[k], y = oy + P[k + 1];
      if (x < 0 || y < 0 || x >= aw || y >= ah) { sum += 255; continue; }
      const i = (y * aw + x) * 4;
      sum += (Math.abs(a[i] - P[k + 2]) + Math.abs(a[i + 1] - P[k + 3]) + Math.abs(a[i + 2] - P[k + 4])) / 3;
      if (sum > best.err * m) break;   // もう負けている
    }
    const err = sum / m;
    if (err < best.err) best = {x: ox, y: oy, err};
  }
  return best;
}

/** 絵 img（ImageBitmap か canvas）を w×h に縮めた画素 {d, w, h} */
function pixels(img, w, h) {
  w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
  const c = new OffscreenCanvas(w, h), x = c.getContext('2d', {willReadFrequently: true});
  x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, w, h);
  return {d: x.getImageData(0, 0, w, h).data, w, h};
}
/**
 * 切り抜き cut が、元の絵 orig のどこにあるか {x, y（元の絵の px）, s（切り抜きの px ÷ 元の絵の px）, err（色の差の平均。30 未満なら合っている）}。
 * 大きさは「同じ」か「横か縦が元の絵と同じになる縮め方」を試す（切り抜く道具の多くは、拡大・縮小をしないので）
 */
export function alignCutout(orig, cut) {
  const ow = orig.width, oh = orig.height, cw = cut.width, ch = cut.height;
  const scales = [...new Set([1, cw / ow, ch / oh].map(v => Math.round(v * 1000) / 1000))].filter(s => s > 0 && cw / s <= ow * 1.02 && ch / s <= oh * 1.02);
  if (!scales.length) scales.push(Math.max(cw / ow, ch / oh));
  let best = null;
  for (const s of scales) {   // 粗く: 元の絵の長い辺を 160 px にして、全部の位置
    const f = 160 / Math.max(ow, oh), A = pixels(orig, ow * f, oh * f), B = pixels(cut, cw / s * f, ch / s * f);
    const r = bestOffset(A.d, A.w, A.h, B.d, B.w, B.h, {x0: -2, x1: A.w - B.w + 2, y0: -2, y1: A.h - B.h + 2});
    if (!best || r.err < best.err) best = {...r, s, f};
  }
  const g = Math.min(1, 640 / Math.max(ow, oh)), k = g / best.f, A = pixels(orig, ow * g, oh * g), B = pixels(cut, cw / best.s * g, ch / best.s * g);   // 細かく: 長い辺 640 px で、まわりだけ
  const cx = Math.round(best.x * k), cy = Math.round(best.y * k), r = bestOffset(A.d, A.w, A.h, B.d, B.w, B.h, {x0: cx - Math.ceil(k) - 2, x1: cx + Math.ceil(k) + 2, y0: cy - Math.ceil(k) - 2, y1: cy + Math.ceil(k) + 2});
  return {x: Math.round(r.x / g * 10) / 10, y: Math.round(r.y / g * 10) / 10, s: best.s, err: Math.round(r.err * 10) / 10};
}
