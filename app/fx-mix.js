// How the look (the effects: bloom, neon, glitch, …) at a moment is worked out in the sequence.
// The global look is the base. A picture may carry its own settings, and so may a ◆ (a change from one picture to the next):
//  - a picture that is simply shown has its own look (what it does not set stays global);
//  - across a ◆ the look goes from the first picture's to the next one's, around the middle (where the pictures swap);
//  - the ◆'s own settings take over while it breaks up or is solid (env: 0 = not at all, 1 = fully), and what it does not set stays what the pictures say.
// the ends are exactly the end values (no rounding left over), and two equal values stay exactly what they are
const lerp = (a, b, t) => (a === b || t <= 0 ? a : t >= 1 ? b : a + (b - a) * t);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// 0 while the first picture is still there, 1 once the next one is, in between around the middle of the ◆ (u: 0..1 through the ◆)
export const pictureWeight = u => smooth(.35, .65, u);

// from / to: the settings of the picture shown (and, inside a ◆, of the next one) — objects or null. trFx: the ◆'s own settings or null.
// late: the next picture takes over late (lateSwap), so its look does too.
export function mixFx(keys, { global, from = null, to = null, trFx = null, u = 0, env = 0, late = false }) {
  const w = to ? (late ? smooth(.72, .80, u) : pictureWeight(u)) : 0;   // late: the ◆ keeps the solid the first picture (see swapCurve), so the look follows the same timing
  const out = {};
  for (const k of keys) {
    const a = from?.[k] ?? global[k];
    const base = to ? lerp(a, to?.[k] ?? global[k], w) : a;
    out[k] = lerp(base, trFx?.[k] ?? base, env);
  }
  return out;
}

// the settings of a picture or ◆ as they come out of a file (or anywhere else not to be trusted): known settings only, real numbers, 0..1.
// Returns a fresh object, or undefined when nothing is left.
export function cleanFx(raw, keys) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const out = {};
  for (const k of keys) {
    const v = Object.hasOwn(raw, k) ? raw[k] : undefined;
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = Math.min(1, Math.max(0, v));
  }
  return Object.keys(out).length ? out : undefined;
}

// While a picture breaks up, its tiles are mixed up (so the solid does not read as the picture); a ◆ can turn that off with mixTiles: false
// and then the picture stays as it is on the shape (a world map becomes a real globe). Only a real `false` counts; no setting = mixed up.
export const concealAmount = (tr, curve) => (tr?.mixTiles === false ? 0 : curve);

// When the next picture takes over from the first. Usually in the middle of the solid (the curve it is given); a ◆ can ask for it to wait
// until the solid has come apart (lateSwap: true), so the solid stays the first picture: a world map stays a globe while it is solid.
// Only a real `true` counts.
export const swapCurve = (tr, u, curve) => (tr?.lateSwap === true ? smooth(.72, .80, u) : curve);
