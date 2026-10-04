// 「タイルの細かさ」：タイルで動く崩れ方（ばらばら・砕ける・とける・シュレッダー・モザイク・星とハート・ブラインド・タイル反転・グリッチ）の
// タイルを、画像を n×n に分けたものにする。標準は 16×16（今までと同じ）。小さい n ＝ 大きなタイル（荒々しい）、大きい n ＝ 細かいタイル。
// 形そのものは変わらない。三角形ごとに「どのタイルに入るか」を決めて、そのタイルの中心を頂点属性 tcell（x, y = 中心、z = n）として渡す。
// 属性がない形（試し描画など）や n が 16 のときは、シェーダーが今までの cell と 16 に戻るので、絵は今までと同じ。
export const BASE_TILES = 16, MIN_TILES = 4, MAX_TILES = 64;

// スライダー（0〜1、真ん中が標準）→ 画像の横（縦）を何枚に分けるか。0 → 4、0.5 → 16、1 → 64（真ん中を軸に、4倍ずつ）
export function tilesAcross(slider) {
  const f = typeof slider === 'number' && Number.isFinite(slider) ? Math.min(1, Math.max(0, slider)) : .5;   // a file's odd value (null, text) means the standard
  return Math.round(BASE_TILES * Math.pow(MAX_TILES / BASE_TILES, (f - .5) * 2));
}

// uv: 三角形3頂点ぶんずつ（6個の数）。n が標準（16）なら null（属性を付けない）。
// 返り値：頂点ごとに [タイル中心x, タイル中心y, n]（同じ三角形の3頂点は必ず同じ値）
export function tileCells(uv, n) {
  if (!Number.isInteger(n) || n < 1 || n === BASE_TILES) return null;
  const tris = uv.length / 6, out = new Float32Array(tris * 9);
  for (let t = 0; t < tris; t++) {
    const o = t * 6;
    const gx = Math.min(n - 1, Math.max(0, Math.floor((uv[o] + uv[o + 2] + uv[o + 4]) / 3 * n)));
    const gy = Math.min(n - 1, Math.max(0, Math.floor((uv[o + 1] + uv[o + 3] + uv[o + 5]) / 3 * n)));
    const cx = (gx + .5) / n, cy = (gy + .5) / n;
    for (let j = 0; j < 3; j++) { const k = t * 9 + j * 3; out[k] = cx; out[k + 1] = cy; out[k + 2] = n; }
  }
  return out;
}

// 形（BufferGeometry）に tcell を付け直す。THREE は呼び出し側のもの（このモジュールは three に依存しない）。
export function applyTiles(THREE, geometry, n) {
  const cells = tileCells(geometry.getAttribute('uv').array, n);
  if (cells) geometry.setAttribute('tcell', new THREE.BufferAttribute(cells, 3));
  else if (geometry.getAttribute('tcell')) geometry.deleteAttribute('tcell');
}
