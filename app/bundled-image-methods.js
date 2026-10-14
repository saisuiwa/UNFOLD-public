// The methods that ship with the app although they began as samples of the method workshop (they used to have to be added first). Three packs:
//  - the surface pack — 焦げ穴と炎, インクのにじみ, 水彩の溶け出し, 凍結と霜, 電撃で消失, 酸の侵食, 絵の具の滴り, 紙が風化する — image code (image-surface-presets.js);
//  - the tile / physics / surface-art image code (BUNDLED_IMAGE_PICKS below): the same code as the workshop samples and examples;
//  - the GLSL samples that are not a built-in method already (BUNDLED_GLSL_PICKS below).
// They are registered under fixed ids with `bundled: true`:
//  - listed after the built-in methods, without the blue "added" frame;
//  - never written to the browser's method library (method-library.js skips them), so there is nothing to keep in step;
//  - when a project uses one, its code goes into the file like any custom method, and another computer maps it back by the code (method-project.js).
import { registerCustom, CUSTOM_PREFIX } from './method-registry.js';
import { SURFACE_METHOD_PRESETS } from './image-surface-presets.js';
import { IMAGE_METHOD_PRESETS } from './image-method-presets.js';
import { WORKSHOP_EXAMPLES } from './workshop-examples.js';
import { SAMPLES } from './method-samples.js';
import { IMAGE_RUNTIME } from './image-method-format.js';

const EN = {
  'surface-burn': 'BURN', 'surface-ink': 'INK SOAK', 'surface-watercolor': 'WATERCOLOR', 'surface-frost': 'FROST',
  'surface-electric': 'ELECTRIC', 'surface-acid': 'ACID', 'surface-drip': 'PAINT RUN', 'surface-weather': 'WEATHERED',
};
// the built-in 絵の具が垂れる (drip) is another method; this one drips down over the surface
const NAMES = { 'surface-drip': '絵の具の滴り' };

// image code that is not a surface effect: [id key, the workshop sample's name, the caption under the tile]
export const BUNDLED_IMAGE_PICKS = [
  ['tile-bounce', 'タイルが落ちて跳ねる', 'TILE BOUNCE'], ['explode-return', '爆発して元へ戻る', 'EXPLODE'], ['tile-text-collide', '画像片と文字がぶつかる', 'TILES + TEXT'],
  ['tile-vortex', '渦に巻かれるタイル', 'TILE VORTEX'], ['shatter-reborn', '爆砕と再誕', 'SHATTER'], ['ripple-tilt', '波紋で傾くタイル', 'RIPPLE TILT'],
  ['domino-fall', 'ドミノのように倒れる', 'DOMINO'], ['melt-drip', 'とろけて垂れるタイル', 'MELT TILES'],
];
// surface art from the workshop's examples (image code for the "立体化なし" mode): [id key, name, symbol, caption]
export const BUNDLED_EXAMPLE_PICKS = [
  ['kintsugi', '金継ぎ陶片', '金', 'KINTSUGI'], ['water-lens', '水滴レンズ', '滴', 'WATER LENS'], ['woven-photo', '織り写真', '織', 'WOVEN'], ['silver-foil', '銀箔うねり', '箔', 'SILVER FOIL'],
];
// GLSL samples (their key in method-samples.js) that no built-in method already is: [sample key, the caption under the tile]
export const BUNDLED_GLSL_PICKS = [
  ['depth-pop', 'DEPTH POP'], ['sand-fall', 'SAND FALL'], ['stripe-slide', 'STRIPE SLIDE'], ['diagonal-sweep', 'DIAGONAL'], ['curtain-open', 'CURTAIN'], ['radial-sweep', 'RADIAL SWEEP'],
];

const imageCode = (source, params) => ({ version: 1, runtime: IMAGE_RUNTIME, source, params });
function bundledList() {
  const out = [];
  for (const p of SURFACE_METHOD_PRESETS) out.push({ id: `im-${p.key}`, name: NAMES[p.key] || p.name, symbol: p.symbol, code: p.code, en: EN[p.key] || '' });
  for (const [key, name, en] of BUNDLED_IMAGE_PICKS) {
    const p = IMAGE_METHOD_PRESETS.find(x => x.name === name);
    if (p) out.push({ id: `im-${key}`, name: p.name, symbol: p.symbol, code: p.code, en });
  }
  for (const [key, name, symbol, en] of BUNDLED_EXAMPLE_PICKS) {
    const x = WORKSHOP_EXAMPLES.find(d => d.kind === 'image' && d.name === name);
    if (x) out.push({ id: `im-${key}`, name: x.name, symbol, code: imageCode(x.source, x.params), en });
  }
  for (const [key, en] of BUNDLED_GLSL_PICKS) {
    const s = SAMPLES.find(x => x.key === key);
    if (s) out.push({ id: `${CUSTOM_PREFIX}b-${key}`, name: s.name, symbol: s.symbol, vertex: s.source, en });
  }
  return out;
}

export const bundledImageMethodIds = () => bundledList().filter(m => m.id.startsWith('im-')).map(m => m.id);
export const bundledMethodIds = () => bundledList().map(m => m.id);

export function registerBundledImageMethods() {
  for (const m of bundledList()) registerCustom({ ...m, bundled: true });
}
export const registerBundledMethods = registerBundledImageMethods;
