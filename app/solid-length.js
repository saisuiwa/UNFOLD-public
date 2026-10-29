// 「立体の長さ」 (solid length, 0..1): how long the picture stays a whole solid. 0 is the original timing.
// The change keeps its length and its ends: the solid starts forming and is gone again at the same moments as before. Only inside that
// span the forming and the falling apart get quicker (down to 40 % of their time at 100 %), and the time saved goes to the whole solid —
// so the solid's own movement (立体の動き), its turn and the picture swap on it are seen for longer.
// It works on the solid's time (after 「ぐちゃぐちゃの長さ」 has moved it later). pts = [forming starts, whole from, whole until, gone by]
// in the curves' own time: the sequence uses [.20, .45, .60, .86], the single clip [.32, .53, .70, .94].
const clamp01 = x => Math.max(0, Math.min(1, Number(x) || 0));
const ramp = len => 1 - 0.6 * clamp01(len);   // how much of their time the forming and the falling apart keep

// real solid time w -> the curves' time (the whole-solid span runs slower, the two ramps faster)
export function stretchSolid(w, len, [p0, a, b, p3]) {
  const r = ramp(len);
  if (r === 1 || w <= p0 || w >= p3) return w;
  const a2 = p0 + (a - p0) * r, b2 = p3 - (p3 - b) * r;
  if (w < a2) return p0 + (w - p0) / r;
  if (w < b2) return a + (w - a2) * (b - a) / (b2 - a2);
  return b + (w - b2) / r;
}

// the inverse: the curves' time -> real solid time (to find where a phase of the curves falls on the timeline)
export function unstretchSolid(v, len, [p0, a, b, p3]) {
  const r = ramp(len);
  if (r === 1 || v <= p0 || v >= p3) return v;
  const a2 = p0 + (a - p0) * r, b2 = p3 - (p3 - b) * r;
  if (v < a) return p0 + (v - p0) * r;
  if (v < b) return a2 + (v - a) * (b2 - a2) / (b - a);
  return b2 + (v - b) * r;
}
