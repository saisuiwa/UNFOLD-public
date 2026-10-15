// Timing without an API key: take rough start times (an SRT / LRC / JSON from a free "MP3 -> SRT" site, a Whisper on the PC, tap sync …)
// and move every line to the moment the voice really comes in, found from the song's own loudness in the voice band.
// Pure functions (no DOM, no network), so tools/test/lyric-snap.test.mjs can test them with a made-up signal.

export const HOP = 0.05;          // seconds between two loudness values
const STEP = 0.3;                 // a start is a rise: the next 0.3 s against the previous 0.3 s
const MIN_RISE = 3;               // dB; a smaller step is not taken as a voice coming in
const LATE_SCORE = 1.5;          // dB lost per second between a candidate and where the line is expected

function biquad(type, f0, fs) {   // RBJ cookbook, Q = 1/sqrt(2)
  const w = 2 * Math.PI * f0 / fs, cos = Math.cos(w), alpha = Math.sin(w) / (2 * Math.SQRT1_2);
  const a0 = 1 + alpha, a1 = -2 * cos / a0, a2 = (1 - alpha) / a0;
  const hp = type === 'highpass', b0 = (hp ? 1 + cos : 1 - cos) / 2 / a0, b1 = (hp ? -(1 + cos) : 1 - cos) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return x => { const y = b0 * x + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
}

export function toMono(channels) {
  if (channels.length === 1) return channels[0];
  const out = new Float32Array(channels[0].length);
  for (const c of channels) for (let i = 0; i < out.length; i++) out[i] += c[i] / channels.length;
  return out;
}

// Loudness of the voice band (about 250 Hz - 3.5 kHz) in dB: one value per HOP seconds, each from a 2 * HOP window that starts there.
export function bandEnergyDb(samples, sampleRate, {lo = 250, hi = 3500} = {}) {
  const hop = Math.max(1, Math.round(sampleRate * HOP)), blocks = Math.floor(samples.length / hop);
  const high = biquad('highpass', lo, sampleRate), low = biquad('lowpass', Math.min(hi, sampleRate * 0.45), sampleRate);
  const power = new Float64Array(blocks);
  for (let b = 0; b < blocks; b++) {
    let acc = 0;
    for (let i = b * hop, end = i + hop; i < end; i++) { const y = low(high(samples[i])); acc += y * y; }
    power[b] = acc / hop;
  }
  const db = new Float32Array(Math.max(0, blocks - 1));
  for (let i = 0; i < db.length; i++) db[i] = 10 * Math.log10((power[i] + power[i + 1]) / 2 + 1e-12);
  return db;
}

// Rows for the lyric timing page out of parseTimings' answer: every row has an end (the next start, or 4 s for the last one).
export function rowsFromTimings(cues) {
  const sorted = [...cues].sort((a, b) => a.s - b.s);
  return sorted.map((c, i) => ({t: c.t, k: c.k || '', s: c.s, exact: false, chars: null,
    e: Number.isFinite(Number(c.e)) && Number(c.e) > c.s ? Number(c.e) : (sorted[i + 1] ? sorted[i + 1].s : c.s + 4)}));
}

const mean = (a, from, to) => { let s = 0; for (let i = from; i < to; i++) s += a[i]; return s / (to - from); };
const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };

// Moves the start of every row to the loudest clear rise near its rough time, and the end to the clearest fall near its rough end.
//   lead: how much earlier than the real singing the rough times usually are (Whisper-like tools: about 0.5 s; tap sync: 0).
// A row without a clear rise keeps its rough time plus the typical move of the other rows, and comes back with exact: false.
export function snapRows(rows, db, {lead = 0.5} = {}) {
  const W = Math.round(STEP / HOP), n = db.length;
  if (n < 2 * W + 2) return {rows: rows.map(r => ({...r, exact: false})), clear: 0, weak: rows.length};
  const rise = new Float32Array(n), quietest = new Float32Array(n);
  for (let i = W; i + W <= n; i++) { rise[i] = mean(db, i, i + W) - mean(db, i - W, i); quietest[i] = Math.min(...db.subarray(i - W, i)); }
  const floor = median(db) - 25;             // a rise out of near silence is the recording starting, not a voice
  const at = t => Math.max(W, Math.min(n - W, Math.round(t / HOP)));
  const best = (from, to, pick) => {
    let found = null;
    for (let i = at(from), end = at(to); i <= end; i++) {
      const score = pick(i);
      if (score !== null && (!found || score > found.score)) found = {t: i * HOP, score, i};
    }
    return found;
  };
  const starts = [], clear = [];
  rows.forEach((r, k) => {
    const center = r.s + lead, floorT = k && starts[k - 1] !== null ? starts[k - 1] + 1 : 0;
    const from = r.s - 0.7, to = r.s + lead + 0.8;
    const hit = best(Math.max(from, floorT), to, i =>
      rise[i] >= MIN_RISE && quietest[i] >= floor ? rise[i] - LATE_SCORE * Math.abs(i * HOP - center) : null);
    const atEdge = hit && (Math.abs(hit.t - to) <= 2 * HOP || Math.abs(hit.t - from) <= 2 * HOP);   // the rise wanted is beyond the search: the rough time was too far off
    starts.push(hit && !atEdge ? hit.t : null); clear.push(!!hit && !atEdge);
  });
  const moves = starts.map((s, k) => (s === null ? null : s - rows[k].s)).filter(m => m !== null);
  const typical = moves.length >= 3 ? Math.max(-1, Math.min(1, median(moves))) : 0;
  const out = rows.map((r, k) => ({...r, s: starts[k] ?? Math.max(0, r.s + typical), exact: clear[k], chars: null}));
  for (let k = 1; k < out.length; k++) if (out[k].s < out[k - 1].s + 0.3) out[k].s = out[k - 1].s + 0.3;
  out.forEach((r, k) => {
    const next = out[k + 1]?.s, e0 = (rows[k].e ?? next ?? rows[k].s + 4) + (r.s - rows[k].s);
    const fall = best(e0 - 0.6, e0 + 1.0, i => (rise[i] <= -MIN_RISE ? -rise[i] - LATE_SCORE * Math.abs(i * HOP - e0) : null));
    let e = fall ? fall.t : e0;
    if (next !== undefined) e = Math.min(e, next - 0.05);
    r.e = Math.max(r.s + 0.3, e);
  });
  const clearCount = clear.filter(Boolean).length;
  return {rows: out, clear: clearCount, weak: rows.length - clearCount};
}
