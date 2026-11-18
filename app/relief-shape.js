// 写真の浮き彫り: 奥行きマップ（0 = 奥、1 = 手前）から、絵とまったく同じ位置で、手前の物だけを前へ出した「立体の形」を作る。
// 作る形は、色差シルエット（mask-shape.js）と同じ「絵をそのまま通して見せる」形（kind 'text'）。立体になった時、各欠片は自分の場所の絵を映すので、
// 正面から見ると元の絵のまま、少し斜めから見ると手前の物が浮いて見える。DOM なし（node でも動く）。
import { modelLayout } from './model-layout.js?v=14';
import { sampleField, blurField } from './depth-auto/depth-field.js';

export const RELIEF = {
  cells: 42000,   // 絵を、だいたいこの数のマスに分ける（1マス = 三角2枚）。多いほど輪郭がきれいで、重い
  Z: 0.45,        // 浮き出る量が 1 の時の、手前から奥までの幅（絵の高さに対する割合）
  PIVOT: 0.12,    // この深さの所が絵の面（z = 0）。これより奥は引っ込み、手前は飛び出す
  STEP: 0.9,      // 1枚の三角の中で深さの差がこれより大きい（ほぼ全部の深さにまたがる）時だけ、奥側の高さに揃えて平らにする。ふつうの段差は引き伸ばして残す（平らにすると、黒い欠片がチェッカーのように浮く）
  SMOOTH: 1.8,    // 段差の形をなめらかにする量（マス。0 = しない）。横から見た時の、段差のギザギザ（のこぎりの歯）を抑える
  OPEN: 1,        // 手前に出た細い線（髪の毛・電線など。幅がこのマス数×2 より細い物）を、まわりの深さに沈める（0 = しない）。細い線は欠片が隣と食い違い、しま模様のちらつきになる
  MIN: 0.2, MAX: 1.6,
};
// 人物だけを立体にする（2026-11-18）: 切り抜いた人物の形の中だけで浮き彫りを作る。高さ = 奥行き（人物の中で 0〜1 に広げる）と、ふくらみ（ふちから中へ丸く）を混ぜる
export const PERSON = {
  PUFF: 0.5,      // ふくらみの混ぜる割合（初めの値）
  BASE: 0.3,      // ふちに残す厚み（ふくらみの高さに対する割合）。0 にすると、ふちで高さが 0 へ落ちて、横から見た時に絵が引き伸ばされる
  CELLS: 42000,   // 人物の中に、だいたいこの数のマスを置く（絵ぜんぶのマスはこれより多くなる）
  MAX_CELLS: 110000,
};

/** 深さの「開く」処理（小さい方へ → 大きい方へ。半径 r マス）: 手前に出た細い線や点が消える。太い物の形はそのまま */
export function openHeights(d, w, h, r = RELIEF.OPEN) {
  if (!(r >= 1)) return d;
  const pass = (src, grow) => {
    const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let m = src[y * w + x];
      for (let i = -r; i <= r; i++) { const v = src[y * w + Math.min(w - 1, Math.max(0, x + i))]; m = grow ? Math.max(m, v) : Math.min(m, v); }
      tmp[y * w + x] = m;
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let m = tmp[y * w + x];
      for (let i = -r; i <= r; i++) { const v = tmp[Math.min(h - 1, Math.max(0, y + i)) * w + x]; m = grow ? Math.max(m, v) : Math.min(m, v); }
      out[y * w + x] = m;
    }
    return out;
  };
  return pass(pass(d, false), true);
}

export function cleanReliefAmount(value, fallback = 1) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(RELIEF.MAX, Math.max(RELIEF.MIN, n)) : fallback;
}

/** 中から外へのいちばん近い距離（マス。3-4 の面取り距離 ÷ 3）。inside の外は 0。絵のふちは「外」にしない（絵で切れた体が、そこで細くならないように） */
export function insideDistance(inside, w, h) {
  const BIG = 1e9, d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = inside[i] ? BIG : 0;
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? BIG : d[y * w + x]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (!d[i]) continue; d[i] = Math.min(d[i], at(x - 1, y) + 3, at(x, y - 1) + 3, at(x - 1, y - 1) + 4, at(x + 1, y - 1) + 4); }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) { const i = y * w + x; if (!d[i]) continue; d[i] = Math.min(d[i], at(x + 1, y) + 3, at(x, y + 1) + 3, at(x + 1, y + 1) + 4, at(x - 1, y + 1) + 4); }
  let top = 0; for (let i = 0; i < w * h; i++) if (d[i] < BIG) top = Math.max(top, d[i]);
  for (let i = 0; i < w * h; i++) d[i] = (d[i] >= BIG ? top || 1 : d[i]) / 3;   // no outside at all: one flat value
  return d;
}
/** 外の所を、いちばん近い中の値で埋める（となりへ順に広げる）。中が無ければそのまま */
export function fillOutside(values, inside, w, h) {
  const out = Float32Array.from(values), seen = new Uint8Array(w * h), queue = new Int32Array(w * h); let head = 0, tail = 0;
  for (let i = 0; i < w * h; i++) if (inside[i]) { seen[i] = 1; queue[tail++] = i; }
  while (head < tail) {
    const i = queue[head++], x = i % w, y = (i - x) / w;
    for (const n of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) if (n >= 0 && !seen[n]) { seen[n] = 1; out[n] = out[i]; queue[tail++] = n; }
  }
  return out;
}
/**
 * 人物の形の高さ（0〜1、w×h）。depth: 奥行き（0 = 奥、1 = 手前）、inside: 人物の中なら 1。
 * 奥行きは人物の中の 3〜97 % で 0〜1 に広げ、ふくらみ（ふちで BASE、中ほど 1。丸い断面）と puff の割合で混ぜる。外は近い中の値で埋める
 */
export function personHeights(depth, inside, w, h, puff = PERSON.PUFF) {
  const vals = []; for (let i = 0; i < w * h; i++) if (inside[i]) vals.push(depth[i]);
  if (!vals.length) return new Float32Array(w * h);
  vals.sort((a, b) => a - b);
  const lo = vals[Math.floor(vals.length * .03)], hi = vals[Math.min(vals.length - 1, Math.floor(vals.length * .97))], span = Math.max(1e-6, hi - lo);
  const dist = insideDistance(inside, w, h), inner = []; for (let i = 0; i < w * h; i++) if (inside[i]) inner.push(dist[i]);
  inner.sort((a, b) => a - b); const far = Math.max(1, inner[Math.min(inner.length - 1, Math.floor(inner.length * .99))]);
  const p = Math.min(1, Math.max(0, Number.isFinite(puff) ? puff : PERSON.PUFF)), out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (!inside[i]) continue;
    const r = Math.min(1, dist[i] / far), round = Math.sqrt(Math.max(0, 1 - (1 - r) * (1 - r)));
    out[i] = (1 - p) * Math.min(1, Math.max(0, (depth[i] - lo) / span)) + p * (PERSON.BASE + (1 - PERSON.BASE) * round);
  }
  return fillOutside(out, inside, w, h);
}

/** 絵の縦横比に合わせた、マスの数（横 cols × 縦 rows） */
export function reliefGrid(aspect, cells = RELIEF.cells) {
  const a = Number.isFinite(aspect) && aspect > 0.05 ? aspect : 1;
  const cols = Math.max(8, Math.round(Math.sqrt(cells * a))), rows = Math.max(8, Math.round(cols / a));
  return { cols, rows };
}

/**
 * 浮き彫りの形のデータを作る。
 *   field: {w, h, data}（奥行きマップ。0〜1・行は上から下）　place: 絵の長方形（世界の長さ。{x: 左, y: 上, w, h}。app.js の uSize から）
 *   mask: {w, h, data}（人物の濃さ 0〜1。切り抜き）を渡すと、人物の形の中だけで作る（puff: ふくらみの割合 0〜1）
 *   返すのは model-layout.js の形（target, uv, cell, part …）に relief（作った時の設定）を足した物
 */
export function createReliefShape(field, place, { amount = 1, cells = RELIEF.cells, mask = null, puff = PERSON.PUFF } = {}) {
  if (!field || !field.data || !(field.w > 1) || !(field.h > 1) || field.data.length !== field.w * field.h) throw new Error('奥行きマップが読み取れませんでした。');
  if (!place || !(place.w > 0) || !(place.h > 0)) throw new Error('絵の大きさが分かりませんでした。');
  const person = !!(mask && mask.data && mask.w > 1 && mask.h > 1 && mask.data.length === mask.w * mask.h);
  let share = 1;
  if (person) { let n = 0; for (let i = 0; i < mask.data.length; i++) if (mask.data[i] > .5) n++; share = n / mask.data.length; if (share < .002) throw new Error('人物の形が見つかりませんでした（切り抜きが空です）。'); }
  const amt = cleanReliefAmount(amount), { cols, rows } = reliefGrid(place.w / place.h, person ? Math.min(PERSON.MAX_CELLS, PERSON.CELLS / share) : cells), W = cols + 1;
  const d = new Float32Array(W * (rows + 1)), m = person ? new Uint8Array(W * (rows + 1)) : null;
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
    d[j * W + i] = sampleField(field.data, field.w, field.h, i / cols, j / rows);
    if (person) m[j * W + i] = sampleField(mask.data, mask.w, mask.h, i / cols, j / rows) > .5 ? 1 : 0;
  }
  const smooth = v => (RELIEF.SMOOTH > 0 ? blurField(v, W, rows + 1, RELIEF.SMOOTH) : v);
  // person: the depth is smoothed first, then shaped inside the person (the silhouette stays sharp: it is where the cells stop)
  const e = person ? personHeights(smooth(d), m, W, rows + 1, puff) : smooth(openHeights(d, W, rows + 1));
  const x = i => place.x + (i / cols) * place.w, y = j => place.y - place.h + (j / rows) * place.h;   // j = 0 は絵の下（v = 0）
  const zOf = v => (v - RELIEF.PIVOT) * amt * RELIEF.Z * place.h;
  const keep = (i, j) => !person || m[j * W + i] + m[j * W + i + 1] + m[(j + 1) * W + i] + m[(j + 1) * W + i + 1] >= 2;   // person: a cell stays when at least half its corners are in the person
  let count = 0; for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) if (keep(i, j)) count++;
  const tri = new Float64Array(count * 18);
  let o = 0, flat = 0;
  const put = (i, j, z) => { tri[o++] = x(i); tri[o++] = y(j); tri[o++] = z; };
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    if (!keep(i, j)) continue;
    const a = e[j * W + i], b = e[j * W + i + 1], c = e[(j + 1) * W + i], f = e[(j + 1) * W + i + 1];
    // modelLayout の並べ方（欠片1つ = 三角2枚: [0,0][1,0][0,1] と [1,0][1,1][0,1]）と同じ向き
    for (const t of [[[i, j, a], [i + 1, j, b], [i, j + 1, c]], [[i + 1, j, b], [i + 1, j + 1, f], [i, j + 1, c]]]) {
      const lo = Math.min(t[0][2], t[1][2], t[2][2]), cut = Math.max(t[0][2], t[1][2], t[2][2]) - lo > RELIEF.STEP;
      if (cut) flat++;
      for (const [ti, tj, tv] of t) put(ti, tj, zOf(cut ? lo : tv));
    }
  }
  const data = modelLayout(tri);
  // modelLayout は大きさと中心をそろえてしまうので、絵の上の本当の位置（世界の長さ）に戻す
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < tri.length; i++) { const k = i % 3; lo[k] = Math.min(lo[k], tri[i]); hi[k] = Math.max(hi[k], tri[i]); }
  const c = lo.map((v, k) => (v + hi[k]) / 2), t = data.target, sc = data.scale;
  for (let i = 0; i < t.length; i += 3) { t[i] = t[i] / sc + c[0]; t[i + 1] = t[i + 1] / sc + c[1]; t[i + 2] = t[i + 2] / sc + c[2]; }
  data.scale = 1;
  data.relief = { amount: amt, cols, rows, flattened: flat, person, puff: person ? Math.min(1, Math.max(0, puff)) : null, cells: count };
  return data;
}

/** 浮き出る量を、作り直さずに変える（高さは量に比例なので、いまの量との比で z を掛けるだけ） */
export function setReliefAmount(data, amount) {
  if (!data?.relief) return false;
  const next = cleanReliefAmount(amount), k = next / data.relief.amount;
  if (k === 1) return false;
  const t = data.target;
  for (let i = 2; i < t.length; i += 3) t[i] *= k;
  data.relief.amount = next;
  return true;
}

const ease = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const unit = v => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
const wholeWindow = w => ease(.46, .54, w) * (1 - ease(.66, .72, w));   // 立体が出来上がっている間だけ 1（前後はなめらかに 0）
const orbit = w => 2 * Math.PI * (w - .45) / .30;                        // その間にちょうど1周する角度
/**
 * 浮き彫りが立体になっている間（立体の時間 w が .46〜.74。motion.js の warpTime）の、左右にゆっくり1往復する角度（ラジアン）。
 * 立体の形は絵を通して見せるだけなので、止まったままだと奥行きが分からない。amount 0〜1 が大きさ（1 = 左右に 0.45 ラジアン、約 26 度）
 */
export function reliefSwing(w, amount = .6) {
  return (.45 * unit(amount) * Math.sin(orbit(w)) * wholeWindow(w)) || 0;   // || 0: no -0
}
/**
 * 同じ間の、上下に振る角度（ラジアン）。左右の振りから 1/4 周ずらしてあるので、左右の端では水平、まん中で一番傾く。
 * 左右と合わせると、写真の立体を見ながら頭をゆるく回すような「楕円の軌跡」になる。amount 0〜1 が大きさ（1 = 0.30 ラジアン、約 17 度）
 */
export function reliefTilt(w, amount = .5) {
  return (-.30 * unit(amount) * Math.cos(orbit(w)) * wholeWindow(w)) || 0;
}
