// Camera work of the sequence. The global 「ゆっくりズーム」 (Ken Burns) moves every picture the same slow way; a picture may also carry its own
// camera (`slide.cam`) — e.g. start far zoomed in (past the edges) and settle back to the normal size when the picture arrives.
//
// cam = { zoom?: [from, to], x?: [from, to], y?: [from, to], roll?: [from, to], ease?, sec? }
//   zoom: 1 = the normal framing, 2 = twice as close.  x, y: shift as a fraction of the picture's width / height.  roll: tilt in degrees.
//   ease: how the move runs (smooth | out | in | linear).  sec: the move takes this many seconds after the picture arrives (0 / none = until it leaves).
// A channel that is not set stays neutral (zoom 1, x 0, y 0, roll 0).

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => (a === b || t <= 0 ? a : t >= 1 ? b : a + (b - a) * t);

// [min, max, neutral]
export const CAM_RANGES = { zoom: [0.5, 4, 1], x: [-1, 1, 0], y: [-1, 1, 0], roll: [-30, 30, 0] };
export const CAM_CHANNELS = Object.keys(CAM_RANGES);
export const CAM_EASES = [['smooth', 'なめらか'], ['out', 'はじめ速く・おわりゆっくり'], ['in', 'はじめゆっくり・おわり速く'], ['linear', '一定']];

export function easeP(name, p) {
  const t = clamp(p, 0, 1);
  if (name === 'out') return 1 - (1 - t) ** 3;
  if (name === 'in') return t ** 3;
  if (name === 'linear') return t;
  return t * t * (3 - 2 * t);
}

// A picture's camera as it comes out of a file (or anywhere else not to be trusted): known channels only, [from, to] real numbers inside their
// ranges, a known ease, a sensible `sec`. Returns a fresh object, or undefined when nothing is left.
export function cleanCam(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const out = {};
  for (const k of CAM_CHANNELS) {
    const v = Object.hasOwn(raw, k) ? raw[k] : undefined;
    if (Array.isArray(v) && v.length === 2 && v.every(n => typeof n === 'number' && Number.isFinite(n))) {
      const [lo, hi] = CAM_RANGES[k];
      out[k] = [clamp(v[0], lo, hi), clamp(v[1], lo, hi)];
    }
  }
  if (!Object.keys(out).length) return undefined;
  if (typeof raw.ease === 'string' && CAM_EASES.some(([e]) => e === raw.ease) && raw.ease !== 'smooth') out.ease = raw.ease;
  if (typeof raw.sec === 'number' && Number.isFinite(raw.sec) && raw.sec > 0) out.sec = Math.min(60, raw.sec);
  return out;
}

// where the camera is, p = 0..1 through the move
export function camValues(cam, p) {
  const t = easeP(cam?.ease, p), out = {};
  for (const k of CAM_CHANNELS) {
    const v = cam?.[k];
    out[k] = v ? lerp(v[0], v[1], t) : CAM_RANGES[k][2];
  }
  return out;
}

// the two ends of each channel for the editor (a channel that is not set shows its neutral value twice)
export const camEnds = (cam, k) => cam?.[k] ?? [CAM_RANGES[k][2], CAM_RANGES[k][2]];

// ready-made moves for the editor
export const CAM_PRESETS = [
  ['ゆっくり寄る', { zoom: [1, 1.15] }],
  ['ゆっくり引く', { zoom: [1.15, 1] }],
  ['ドンと引く（はみ出す大きさから戻る）', { zoom: [2.2, 1], ease: 'out', sec: 1.6 }],
  ['ドンと寄る（はみ出すほど寄る）', { zoom: [1, 2.2], ease: 'in' }],
  ['左から右へ流れる', { zoom: [1.12, 1.12], x: [-0.05, 0.05] }],
  ['右から左へ流れる', { zoom: [1.12, 1.12], x: [0.05, -0.05] }],
  ['上から下へ流れる', { zoom: [1.12, 1.12], y: [0.05, -0.05] }],
  ['ゆっくり傾く', { zoom: [1.15, 1.15], roll: [-3, 3] }],
  ['動かさない', { zoom: [1, 1] }],
];

// The Ken Burns every picture without its own camera has: slowly in or out (alternating) and a drift sideways. k = the global amount.
// i = the picture's number, p = 0..1 through the time it is shown. x is in world units (the way it always was).
export function legacyKenBurns(i, p, k) {
  const d = i % 2 ? -1 : 1;
  return { zoom: 1 + k * .12 * (d > 0 ? p : 1 - p), x: k * .18 * (p - .5) * (i % 4 < 2 ? 1 : -1) };
}

// When picture i is on screen as a whole: from when it arrives (the middle of the ◆ before it — later when that ◆ keeps the solid the first
// picture) to when it starts to break up (a little into the ◆ after it). lay = {transitions:[{start,end}], total}, trs = the ◆ settings.
export function camLife(i, n, lay, trs) {
  const tIn = i > 0 ? lay.transitions[i - 1] : null, tOut = i < n - 1 ? lay.transitions[i] : null;
  const late = i > 0 && trs[i - 1]?.lateSwap === true && trs[i - 1]?.shape !== 'none';
  return {
    arrive: tIn ? tIn.start + (tIn.end - tIn.start) * (late ? .76 : .5) : 0,
    leave: tOut ? tOut.start + (tOut.end - tOut.start) * .3 : lay.total,
  };
}

// how far through its move a picture's camera is at time sec
export function lifeProgress(sec, life, cam) {
  const span = cam?.sec > 0 ? cam.sec : life.leave - life.arrive;
  return span > 0 ? clamp((sec - life.arrive) / span, 0, 1) : 1;
}

// from picture a's camera to picture b's: 0 = a, 1 = b
export function mixCam(a, b, w) {
  const out = {};
  for (const k of CAM_CHANNELS) out[k] = lerp(a[k], b[k], w);
  return out;
}
