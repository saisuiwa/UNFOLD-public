// The surface pack — 焦げ穴と炎, インクのにじみ, 水彩の溶け出し, 凍結と霜, 電撃で消失, 酸の侵食, 絵の具の垂れ落ち, 紙が風化する — as methods that are
// there from the start in the single-image page and the sequence page (they used to be samples of the method workshop that had to be added first).
// They are image code (the same code as the workshop samples, image-surface-presets.js), registered under fixed ids with `bundled: true`:
//  - listed after the built-in methods, without the blue "added" frame;
//  - never written to the browser's method library (method-library.js skips them), so there is nothing to keep in step;
//  - when a project uses one, its code goes into the file like any custom method, and another computer maps it back by the code (method-project.js).
import { registerCustom } from './method-registry.js';
import { SURFACE_METHOD_PRESETS } from './image-surface-presets.js';

const EN = {
  'surface-burn': 'BURN', 'surface-ink': 'INK SOAK', 'surface-watercolor': 'WATERCOLOR', 'surface-frost': 'FROST',
  'surface-electric': 'ELECTRIC', 'surface-acid': 'ACID', 'surface-drip': 'PAINT RUN', 'surface-weather': 'WEATHERED',
};
// the built-in 絵の具が垂れる (drip) is another method; this one drips down over the surface
const NAMES = { 'surface-drip': '絵の具の垂れ落ち' };

export const bundledImageMethodIds = () => SURFACE_METHOD_PRESETS.map(p => `im-${p.key}`);

export function registerBundledImageMethods() {
  for (const p of SURFACE_METHOD_PRESETS) {
    registerCustom({ id: `im-${p.key}`, name: NAMES[p.key] || p.name, symbol: p.symbol, code: p.code, bundled: true, en: EN[p.key] || '' });
  }
}
