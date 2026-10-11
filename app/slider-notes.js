// 「粒の細かさ」と「タイルの細かさ」のスライダーが、どの崩れ方に効くか（と、効かない理由）を言葉にする。
// 動かして変わらないと「壊れた？」と思うので、スライダーの下に、いまの組み合わせに効くかを出す。
//   粒で動く方法（part を使う）  ← 粒の細かさ（面の細かい形＝追加したGLB・文字・輪郭のときだけ）
//   タイルで動く方法（tcell を使う）← タイルの細かさ（どの形でも）
//   それ以外は、画像全体をなめらかに動かす方法（くしゃくしゃ・ねじれ・波打ち…）で、どちらも効かない。
// どの方法がどれかは motion.js の breakAt の中身で決まる（tools/test/slider-notes.test.mjs が突き合わせる）。
import { BASE_TILES, tilesAcross } from './tile-size.js';
import { isCustomKey, methodLabel } from './method-registry.js';

export const GRAIN_METHODS = ['dust', 'sparkle', 'burst', 'swarm', 'rain', 'snow', 'bubbles', 'halftone', 'galaxy', 'tornado', 'wind', 'petals', 'scrawl', 'tangle', 'penshake', 'linefall', 'thread', 'bleed', 'drip', 'seep'];
export const TILE_METHODS = ['scatter', 'shatter', 'melt', 'shred', 'mosaic', 'confetti', 'blinds', 'flip', 'glitch'];
export const SMOOTH_METHODS = ['crumple', 'twist', 'wave', 'peel', 'fold', 'vortex', 'ripple', 'line'];
const names = keys => keys.map(k => methodLabel(k)).join('・');

// 自作メソッドは partC() を使えるので、粒はコード次第（効くことがある）として数える。タイル（tcell）は読めないので効かない。
export const usesGrain = key => GRAIN_METHODS.includes(key) || isCustomKey(key);
export const usesTiles = key => TILE_METHODS.includes(key);
const either = (use, { method, method2 = '' }) => use(method) || (!!method2 && use(method2));

// ◆ 1つに効くか。粒は、面の細かい形（追加したGLB・文字・輪郭）のときだけ。タイルはどの形でも。
export const grainReaches = item => !!item.shapeHasGrain && either(usesGrain, item);
export const tilesReach = item => either(usesTiles, item);

const WHY_GRAIN_METHOD = `粒で崩す方法（${names(GRAIN_METHODS)}）だけに効きます。ばらばら・砕けるなどは「タイルの細かさ」で変えられます。くしゃくしゃ・ねじれ・波打ちなど（${names(SMOOTH_METHODS)}）は全体がなめらかに動くので、どちらの設定も効きません。`;
const WHY_GRAIN_SHAPE = '効くのは、面の細かい形（追加したGLB・文字・輪郭）だけです。球やハートなどの標準の形は、もともと粒が決まっています。';
const WHY_TILE_METHOD = `タイルで動く方法（${names(TILE_METHODS)}）だけに効きます。塵・雪などの粒の方法は「粒の細かさ」で変えられます。くしゃくしゃ・ねじれ・波打ちなど（${names(SMOOTH_METHODS)}）は全体がなめらかに動くので、どちらの設定も効きません。`;

const tileLabel = slider => { const n = tilesAcross(slider); return `タイル ${n}×${n}${n === BASE_TILES ? '・標準' : ''}`; };

// シーケンス用：全部の◆のうち、いくつに効くか。items = [{ method, method2, shapeHasGrain }]
export function grainSequenceNote(items) {
  const hit = items.filter(grainReaches).length;
  if (!items.length) return { reach: 0, total: 0, text: WHY_GRAIN_METHOD + WHY_GRAIN_SHAPE };
  if (hit === 0) return { reach: 0, total: items.length, text: `いまは、効く◆が1つもありません。${items.some(i => either(usesGrain, i)) ? WHY_GRAIN_SHAPE : WHY_GRAIN_METHOD}` };
  return { reach: hit, total: items.length, text: `いまのシーケンスでは、◆${items.length}個のうち${hit}個に効きます。${hit < items.length ? '残りは、粒で崩す方法ではないか、標準の形なので変わりません。' : ''}` };
}
export function tileSequenceNote(items, slider) {
  const hit = items.filter(tilesReach).length;
  if (!items.length) return { reach: 0, total: 0, text: WHY_TILE_METHOD };
  if (hit === 0) return { reach: 0, total: items.length, text: `いまは、効く◆が1つもありません。${WHY_TILE_METHOD}` };
  return { reach: hit, total: items.length, text: `いまのシーケンスでは、◆${items.length}個のうち${hit}個に効きます（${tileLabel(slider)}）。${hit < items.length ? '残りは、タイルで動く方法ではないので変わりません。' : ''}` };
}

// 1枚モード用：いまの崩れ方と形の組み合わせに効くか
export function grainSingleNote({ method, shapeHasGrain }) {
  if (!usesGrain(method)) return { reach: 0, text: `いまの崩れ方（${methodLabel(method)}）には効きません。` + WHY_GRAIN_METHOD };
  if (!shapeHasGrain) return { reach: 0, text: `いまの形には効きません。` + WHY_GRAIN_SHAPE };
  return { reach: 1, text: `いまの組み合わせ（${methodLabel(method)}）に効きます。` };
}
export function tileSingleNote({ method }, slider) {
  if (!usesTiles(method)) return { reach: 0, text: `いまの崩れ方（${methodLabel(method)}）には効きません。` + WHY_TILE_METHOD };
  return { reach: 1, text: `いまの崩れ方（${methodLabel(method)}）に効きます（${tileLabel(slider)}）。` };
}
