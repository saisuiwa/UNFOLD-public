// 奥行きから切り抜きを作る（2026-11-15）: 切り抜き画像がなくても、絵の奥行き（depth-auto、0 = 奥・1 = 手前）から「手前の物」の切り抜きを作る。
// 出来た切り抜きは、切り抜き画像を入れた時と同じ所へ渡す（人物を残す・額縁から飛び出す・人物の後ろの文字）。
//   ・奥行きは粗い（長辺 518）ので、ふちがぼやける。「ふちを整える」= 絵の色の境目に合わせて奥行きを引き直す
//     （近くの画素のうち、色が似ている物の奥行きを多くもらう。あらい → 細かい の3回。最後に、ぽつんと残った点を消す）。
//   ・「手前」と「奥」の分け目（at）より手前が、切り抜きに残る。tilt を付けると、分け目が左右で変わる（右へ行くほど手前側へ = 右では残る物が減る）。
// 上半分は DOM なし（node でも動く）。
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const num = (x, lo, hi, d) => typeof x === 'number' && Number.isFinite(x) ? clamp(x, lo, hi) : d;
export const DEPTH_CUT = Object.freeze({ at: .3, tilt: 0, fine: true });
export const DEPTH_CUT_LIMITS = { at: [.05, .95], tilt: [-1, 1], long: 960, soft: .02 };
export function cleanDepthCut(value) {
  const v = value && typeof value === 'object' && !Array.isArray(value) ? value : {}, L = DEPTH_CUT_LIMITS;
  return { at: Math.round(num(v.at, L.at[0], L.at[1], DEPTH_CUT.at) * 100) / 100, tilt: Math.round(num(v.tilt, L.tilt[0], L.tilt[1], DEPTH_CUT.tilt) * 100) / 100, fine: v.fine !== false };
}
/** 作業の大きさ（絵の縦横比のまま、長辺 long まで） */
export function workSize(width, height, long = DEPTH_CUT_LIMITS.long) {
  const k = Math.min(1, long / Math.max(width, height));
  return { W: Math.max(2, Math.round(width * k)), H: Math.max(2, Math.round(height * k)) };
}
/** 奥行き（field = {w, h, data}、行は上から下）を W×H に広げる（なめらかに） */
export function spreadDepth(field, W, H) {
  const { w, h, data } = field, out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const fy = clamp((y + .5) / H * h - .5, 0, h - 1), y0 = Math.floor(fy), y1 = Math.min(h - 1, y0 + 1), ty = fy - y0;
    for (let x = 0; x < W; x++) {
      const fx = clamp((x + .5) / W * w - .5, 0, w - 1), x0 = Math.floor(fx), x1 = Math.min(w - 1, x0 + 1), tx = fx - x0;
      out[y * W + x] = (data[y0 * w + x0] * (1 - tx) + data[y0 * w + x1] * tx) * (1 - ty) + (data[y1 * w + x0] * (1 - tx) + data[y1 * w + x1] * tx) * ty;
    }
  }
  return out;
}
/**
 * ふちを整える。depth: W×H の奥行き、rgba: 同じ大きさの絵（RGBA、0–255）。返す: 整えた奥行き（W×H）。
 * colour: 色がどのくらい違うと「別の物」と見るか（0–1）。steps: 見に行く間隔（画素）。radius: 片側の数（3 = 7×7）
 */
export function refineDepth(depth, rgba, W, H, { steps = [3, 2, 1], colour = .08, radius = 3 } = {}) {
  const sigma = colour * 255, lut = new Float32Array((195075 >> 4) + 2);
  for (let i = 0; i < lut.length; i++) lut[i] = Math.exp(-(i * 16) / (2 * sigma * sigma));
  const space = []; for (let j = -radius; j <= radius; j++) for (let i = -radius; i <= radius; i++) space.push(Math.exp(-(i * i + j * j) / (radius * radius * 2)));
  let src = depth, out = new Float32Array(W * H);
  for (const step of steps) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const p = (y * W + x) * 4, r0 = rgba[p], g0 = rgba[p + 1], b0 = rgba[p + 2];
      let sum = 0, all = 0, k = 0;
      for (let j = -radius; j <= radius; j++) {
        const yy = clamp(y + j * step, 0, H - 1) * W;
        for (let i = -radius; i <= radius; i++, k++) {
          const n = yy + clamp(x + i * step, 0, W - 1), q = n * 4, dr = rgba[q] - r0, dg = rgba[q + 1] - g0, db = rgba[q + 2] - b0;
          const wgt = space[k] * lut[(dr * dr + dg * dg + db * db) >> 4];
          sum += src[n] * wgt; all += wgt;
        }
      }
      out[y * W + x] = sum / all;
    }
    const t = src === depth ? new Float32Array(W * H) : src; src = out; out = t;
  }
  return median3(src, W, H);
}
/** 3×3 のまん中の値（ふちは残して、ぽつんとした点だけ消える） */
export function median3(src, W, H) {
  const out = new Float32Array(W * H), v = new Float32Array(9);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let k = 0;
    for (let j = -1; j <= 1; j++) { const yy = clamp(y + j, 0, H - 1) * W; for (let i = -1; i <= 1; i++) v[k++] = src[yy + clamp(x + i, 0, W - 1)]; }
    for (let a = 1; a < 9; a++) { const t = v[a]; let b = a - 1; while (b >= 0 && v[b] > t) { v[b + 1] = v[b]; b--; } v[b + 1] = t; }
    out[y * W + x] = v[4];
  }
  return out;
}
/** その場所の分け目（x: 左 0 → 右 1） */
export const splitAt = (settings, x) => settings.at + settings.tilt * (x - .5);
/** 手前の物の濃さ（0–255、W×H）。分け目より手前 = 255。ふちは soft の幅でなだらか */
export function depthMatte(depth, W, H, settings, soft = DEPTH_CUT_LIMITS.soft) {
  const s = cleanDepthCut(settings), out = new Uint8ClampedArray(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = clamp((depth[y * W + x] - (splitAt(s, (x + .5) / W) - soft)) / (2 * soft), 0, 1);
    out[y * W + x] = Math.round(t * t * (3 - 2 * t) * 255);
  }
  return out;
}
/** 切り抜きに残る割合（0–1）。ほとんど何も残らない・全部残る、を知らせるのに使う */
export function matteShare(matte) { let n = 0; for (let i = 0; i < matte.length; i++) if (matte[i] > 127) n++; return matte.length ? n / matte.length : 0; }

// ---- ここから下は画面（canvas）を使う
/**
 * 絵 1 枚ぶんの係を作る。picture: 絵（canvas）、field: 奥行き {w, h, data}。
 *   cut(settings) → { canvas（絵と同じ大きさ。手前の物だけ・地は透明）, share（残った割合 0–1）}
 *   depth(fine) → 奥行き（文字の層を、絵の奥行きで隠すのに使う: 人物の後ろの文字の「奥行きの動き」）
 * 奥行きを広げる・ふちを整えるのは、絵ごとに1回だけ（設定を変えても、分け直すだけ）。
 */
export function createDepthCutter(picture, field, doc = globalThis.document) {
  const { W, H } = workSize(picture.width, picture.height);
  const small = doc.createElement('canvas'); small.width = W; small.height = H;
  const sx = small.getContext('2d', { willReadFrequently: true }); sx.drawImage(picture, 0, 0, W, H);
  const rgba = sx.getImageData(0, 0, W, H).data, raw = spreadDepth(field, W, H);
  let fine = null;
  const mask = doc.createElement('canvas'); mask.width = W; mask.height = H; const mx = mask.getContext('2d');
  return {
    size: { W, H },
    /** 奥行きそのもの（W×H、行は上から下）。fine: ふちを整えた物 */
    depth(fineWanted = true) { return fineWanted ? (fine ??= refineDepth(raw, rgba, W, H)) : raw; },
    cut(settings) {
      const s = cleanDepthCut(settings), depth = s.fine ? (fine ??= refineDepth(raw, rgba, W, H)) : raw, matte = depthMatte(depth, W, H, s);
      const img = mx.createImageData(W, H); for (let i = 0; i < W * H; i++) { img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = 255; img.data[i * 4 + 3] = matte[i]; }
      mx.putImageData(img, 0, 0);
      const canvas = doc.createElement('canvas'); canvas.width = picture.width; canvas.height = picture.height; const x = canvas.getContext('2d');
      x.imageSmoothingQuality = 'high'; x.drawImage(mask, 0, 0, canvas.width, canvas.height); x.globalCompositeOperation = 'source-in'; x.drawImage(picture, 0, 0);
      return { canvas, share: matteShare(matte) };
    },
  };
}
