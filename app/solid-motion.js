// 「立体の動き」: how the solid moves while it is whole — sways, floats, hops, shivers… on top of the usual turn.
// It moves the solid as one piece (tilt, position, squash and stretch) and is weighted by how far the solid has formed, so it fades in as the
// picture becomes the solid and is gone again by the time the picture is back: the flat picture is never moved. kind 'none' = as before.
//
// value = { kind: 'none' | one of SOLID_MOTIONS, amount: 0.2–2 (1 = as designed) }
// The rhythm counts beats: the ◆'s tempo in a sequence, a fixed 120 BPM in the single clip. Every motion swings around rest (no full turns),
// so a half-formed solid only moves half as far and nothing jumps.

export const SOLID_MOTIONS = [
  ['sway', 'ゆらゆら'], ['float', 'ふわふわ'], ['boing', 'ぽよん'], ['hop', 'ぴょんぴょん'], ['shiver', 'ぶるぶる'], ['pendulum', 'ぶらんこ'],
  ['figure8', '8の字に飛ぶ'], ['heartbeat', 'ドキドキ'], ['lookaround', 'きょろきょろ'], ['flutter', 'ひらひら舞う'], ['approach', 'ぐいっと寄る'], ['jelly', 'ぷるぷる'],
];
const IDS = SOLID_MOTIONS.map(([id]) => id);
export const SINGLE_BEAT_SEC = 0.5;

// the motions that suit a shape best, first one first; 🎲 picks among these (shapes not listed: any motion)
const SUITS = {
  'c-ghost': ['sway', 'float', 'flutter'], 'c-bat': ['figure8', 'float', 'flutter'], 'c-black-cat': ['hop', 'lookaround', 'boing'],
  'c-pumpkin': ['boing', 'hop', 'jelly'], 'c-candy-bucket': ['pendulum', 'boing', 'hop'], 'c-skull': ['shiver', 'lookaround', 'jelly'],
  'c-broom': ['flutter', 'figure8', 'sway'], 'c-cauldron': ['jelly', 'boing', 'shiver'], 'c-witch-hat': ['flutter', 'float', 'hop'],
  'c-tombstone': ['shiver', 'sway', 'boing'],
  heart: ['heartbeat', 'boing'], 'c-hearts': ['heartbeat', 'float'], 'c-balloons': ['float', 'sway'], 'c-icecream': ['jelly', 'boing'],
  'c-snowman': ['sway', 'hop'], 'c-macarons': ['boing', 'hop'], 'c-donut': ['boing', 'jelly'], pegasus: ['figure8', 'float'], human: ['lookaround', 'hop'],
};

const clampNum = (x, lo, hi, d) => typeof x === 'number' && Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d;
export function cleanSolidMotion(value) {
  const x = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {kind: IDS.includes(x.kind) ? x.kind : 'none', amount: Math.round(clampNum(x.amount, 0.2, 2, 1) * 100) / 100};
}

export const suggestSolidMotions = shape => SUITS[shape] ?? [];

// 🎲: a motion for this shape that is not the current one (one that suits the shape when it has any)
export function pickSolidMotion(shape, current = 'none', random = Math.random) {
  const suits = suggestSolidMotions(shape), pool = (suits.length > 1 || (suits.length && suits[0] !== current) ? suits : IDS).filter(id => id !== current);
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}

const TAU = Math.PI * 2, BOTTOM = -1.5, TOP = 1.7;
const frac = x => x - Math.floor(x);
const bump = (d, c, w) => Math.exp(-(((d - c) / w) ** 2));
// squash / stretch that keeps the volume: stretch y by sy, x and z follow
const squash = sy => ({sx: 1 / Math.sqrt(sy), sy, sz: 1 / Math.sqrt(sy)});

// the raw pose of a motion b beats (s seconds) in: tilt rx ry rz (radians, world axes), shift x y z, scale sx sy sz around pivot y
const POSES = {
  sway: b => ({rz: 0.2 * Math.sin(TAU * b / 2), pivot: BOTTOM}),
  float: b => { const ph = TAU * b / 4; return {y: 0.22 * Math.sin(ph), rz: 0.05 * Math.sin(ph + 1.2), rx: 0.04 * Math.sin(ph + 0.5)}; },
  boing: b => { const d = frac(b); return {...squash(1 - 0.16 * Math.exp(-5 * d) * Math.cos(3 * Math.PI * d)), pivot: BOTTOM}; },
  hop: b => { const d = frac(b), air = 4 * d * (1 - d), land = bump(d, 0, 0.07) + bump(d, 1, 0.07); return {y: 0.42 * air, ...squash(1 - 0.14 * land + 0.06 * air), pivot: BOTTOM}; },
  shiver: (b, s) => ({x: 0.025 * (Math.sin(TAU * 9.3 * s) + 0.6 * Math.sin(TAU * 14.1 * s + 1)), y: 0.012 * Math.sin(TAU * 13 * s),
    rz: 0.035 * (Math.sin(TAU * 11.7 * s + 0.3) + 0.5 * Math.sin(TAU * 17.3 * s))}),
  pendulum: b => ({rz: 0.32 * Math.sin(TAU * b / 2), pivot: TOP}),
  figure8: b => { const ph = TAU * b / 4; return {x: 0.55 * Math.sin(ph), y: 0.2 * Math.sin(2 * ph), rz: -0.18 * Math.cos(ph), ry: 0.25 * Math.sin(ph)}; },
  heartbeat: b => { const d = frac(b), k = 1 + 0.1 * (bump(d, 0, 0.06) + bump(d, 1, 0.06) + 0.7 * bump(d, 0.2, 0.06)); return {sx: k, sy: k, sz: k}; },
  lookaround: b => { const ph = TAU * b / 4; return {ry: 0.55 * Math.tanh(3 * Math.sin(ph)) / Math.tanh(3), y: 0.03 * Math.sin(2 * ph)}; },
  flutter: b => { const ph = TAU * b / 4; return {ry: 0.9 * Math.sin(ph), x: 0.15 * Math.sin(ph), y: 0.18 * Math.sin(2 * ph), rz: 0.12 * Math.sin(ph + 0.8)}; },
  approach: b => { const k = 0.5 - 0.5 * Math.cos(TAU * b / 4), sc = 1 + 0.25 * k; return {z: 0.6 * k, sx: sc, sy: sc, sz: sc}; },
  jelly: b => { const d = frac(b); return {...squash(1 + 0.12 * Math.exp(-3.5 * d) * Math.sin(TAU * 3 * d)), pivot: BOTTOM}; },
};

// rotation matrix of world-axis tilts applied x, then y, then z (R = Rz·Ry·Rx), as rows
function rotation(rx, ry, rz) {
  const [cx, sx, cy, sy, cz, sz] = [Math.cos(rx), Math.sin(rx), Math.cos(ry), Math.sin(ry), Math.cos(rz), Math.sin(rz)];
  return [[cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx], [sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx], [-sy, cy * sx, cy * cx]];
}
function quaternion(m) {
  const t = m[0][0] + m[1][1] + m[2][2];
  if (t > 0) { const s = 0.5 / Math.sqrt(t + 1); return [(m[2][1] - m[1][2]) * s, (m[0][2] - m[2][0]) * s, (m[1][0] - m[0][1]) * s, 0.25 / s]; }
  if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) { const s = 2 * Math.sqrt(1 + m[0][0] - m[1][1] - m[2][2]); return [0.25 * s, (m[0][1] + m[1][0]) / s, (m[0][2] + m[2][0]) / s, (m[2][1] - m[1][2]) / s]; }
  if (m[1][1] > m[2][2]) { const s = 2 * Math.sqrt(1 + m[1][1] - m[0][0] - m[2][2]); return [(m[0][1] + m[1][0]) / s, 0.25 * s, (m[1][2] + m[2][1]) / s, (m[0][2] - m[2][0]) / s]; }
  const s = 2 * Math.sqrt(1 + m[2][2] - m[0][0] - m[1][1]); return [(m[0][2] + m[2][0]) / s, (m[1][2] + m[2][1]) / s, 0.25 * s, (m[1][0] - m[0][1]) / s];
}

// -> null when it does not move (none, or no solid yet), else {quaternion [x,y,z,w] to put before the solid's own turn, position, scale}.
// sec: seconds since the change began; beatSec: one beat; weight: how far the solid has formed (0–1).
export function solidMotionAt(value, sec, beatSec, weight) {
  const v = cleanSolidMotion(value), w = clampNum(weight, 0, 1, 0) * v.amount;
  if (v.kind === 'none' || w === 0) return null;
  const s = Math.max(0, clampNum(sec, 0, 1e6, 0)), p = POSES[v.kind](s / clampNum(beatSec, 0.05, 10, SINGLE_BEAT_SEC), s);
  const scale = [p.sx ?? 1, p.sy ?? 1, p.sz ?? 1].map(k => Math.max(0.3, 1 + (k - 1) * w));
  const r = rotation((p.rx ?? 0) * w, (p.ry ?? 0) * w, (p.rz ?? 0) * w), py = (p.pivot ?? 0) * scale[1];
  // turn and scale around the pivot (a point on the vertical axis) instead of the middle: shift by pivot − R·(S·pivot)
  const position = [(p.x ?? 0) * w - r[0][1] * py, (p.y ?? 0) * w + (p.pivot ?? 0) - r[1][1] * py, (p.z ?? 0) * w - r[2][1] * py];
  return {quaternion: quaternion(r), position, scale};
}

// Image-code methods draw the solid in their own worker, which only takes the solid's turn (rootQuaternion) and the camera. The shift and the
// size are handed over through the camera instead: viewing the solid moved by M is viewing it unmoved from M⁻¹·camera. The worker cannot squash
// the solid, so the size there is the average one (a squash that keeps the volume reads as a hop of the whole solid).
// camera = {projection, world} as imageCamera gives it (column-major 4×4) -> the same with the world matrix moved.
export function motionCamera(camera, motion) {
  if (!motion) return camera;
  const su = Math.cbrt(motion.scale[0] * motion.scale[1] * motion.scale[2]), w = camera.world, [px, py, pz] = motion.position;
  const out = new Array(16);
  for (let c = 0; c < 4; c++) {   // (Su⁻¹·T⁻¹)·W: each row r of the result is (W[r] − p[r]·W[3]) / su, the last row unchanged
    const x = w[c * 4], y = w[c * 4 + 1], z = w[c * 4 + 2], h = w[c * 4 + 3];
    out[c * 4] = (x - px * h) / su; out[c * 4 + 1] = (y - py * h) / su; out[c * 4 + 2] = (z - pz * h) / su; out[c * 4 + 3] = h;
  }
  return {...camera, world: out};
}
