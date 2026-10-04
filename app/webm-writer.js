// Minimal WebM (Matroska) muxer for WebCodecs VP8/VP9 chunks — frame-accurate export, no realtime recording.
const te = new TextEncoder();

function idBytes(id) {
  const out = [];
  let v = id;
  while (v > 0) { out.unshift(v & 0xff); v = Math.floor(v / 256); }
  return out;
}
function sizeBytes(n) {                       // always 8-byte vint (0x01 marker)
  const out = [0x01];
  for (let i = 6; i >= 0; i--) out.push(Math.floor(n / 2 ** (8 * i)) & 0xff);
  return out;
}
function concat(parts) {
  let len = 0;
  for (const p of parts) len += p.length;
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
function el(id, payload) {
  const body = payload instanceof Uint8Array ? payload : concat(payload);
  return concat([new Uint8Array(idBytes(id)), new Uint8Array(sizeBytes(body.length)), body]);
}
function uint(id, v) {
  const b = [];
  let x = v;
  do { b.unshift(x & 0xff); x = Math.floor(x / 256); } while (x > 0);
  return el(id, new Uint8Array(b));
}
function float(id, v) {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setFloat64(0, v);
  return el(id, b);
}
const str = (id, s) => el(id, te.encode(s));

export class WebMWriter {
  // audio (optional): {sampleRate, channels, codecPrivate: Uint8Array OpusHead}
  constructor({ width, height, codec = 'V_VP9', fps = 30, audio = null }) {
    Object.assign(this, { width, height, codec, fps, audio });
    this.blocks = [];
    this.lastMs = 0;
  }
  addChunk(chunk, track = 1) {
    const data = new Uint8Array(chunk.byteLength);
    chunk.copyTo(data);
    const ms = Math.round(chunk.timestamp / 1000);
    this.blocks.push({ track, ms, key: track === 2 || chunk.type === 'key', data });
    if (track === 1) this.lastMs = Math.max(this.lastMs, ms + 1000 / this.fps);
  }
  finish() {
    const ebml = el(0x1A45DFA3, [uint(0x4286, 1), uint(0x42F7, 1), uint(0x42F2, 4), uint(0x42F3, 8),
      str(0x4282, 'webm'), uint(0x4287, 4), uint(0x4285, 2)]);
    const info = el(0x1549A966, [uint(0x2AD7B1, 1000000), str(0x4D80, 'UNFOLD sequence'), str(0x5741, 'UNFOLD sequence'),
      float(0x4489, this.lastMs)]);
    const entries = [el(0xAE, [uint(0xD7, 1), uint(0x73C5, 1), uint(0x83, 1), str(0x86, this.codec),
      uint(0x23E383, Math.round(1e9 / this.fps)),
      el(0xE0, [uint(0xB0, this.width), uint(0xBA, this.height)])])];
    if (this.audio) {
      entries.push(el(0xAE, [uint(0xD7, 2), uint(0x73C5, 2), uint(0x83, 2), str(0x86, 'A_OPUS'),
        el(0x63A2, this.audio.codecPrivate), uint(0x56AA, 6500000), uint(0x56BB, 80000000),
        el(0xE1, [float(0xB5, this.audio.sampleRate), uint(0x9F, this.audio.channels)])]));
    }
    const tracks = el(0x1654AE6B, entries);
    // interleave both tracks by time; a new cluster at each video keyframe (or every 5 s)
    const blocks = this.blocks.filter(b => b.track === 1 || b.ms < this.lastMs).sort((a, b) => a.ms - b.ms || a.track - b.track);
    const clusters = [];
    let cur = null;
    for (const b of blocks) {
      if (!cur || (b.track === 1 && b.key && b.ms !== cur.t0) || b.ms - cur.t0 > 5000) { cur = { t0: b.ms, parts: [] }; clusters.push(cur); }
      const rel = b.ms - cur.t0;
      const head = new Uint8Array([0x80 | b.track, (rel >> 8) & 0xff, rel & 0xff, b.key ? 0x80 : 0x00]);
      cur.parts.push(el(0xA3, [head, b.data]));
    }
    const segment = el(0x18538067, [info, tracks, ...clusters.map(c => el(0x1F43B675, [uint(0xE7, c.t0), ...c.parts]))]);
    return new Blob([ebml, segment], { type: 'video/webm' });
  }
}

// OpusHead for Matroska CodecPrivate (used when the encoder does not hand us one)
export function opusHead(channels, sampleRate, preSkip = 312) {
  const b = new Uint8Array(19), v = new DataView(b.buffer);
  b.set(new TextEncoder().encode('OpusHead'));
  b[8] = 1; b[9] = channels; v.setUint16(10, preSkip, true); v.setUint32(12, sampleRate, true); v.setInt16(16, 0, true); b[18] = 0;
  return b;
}
