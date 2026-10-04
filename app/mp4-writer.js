// Minimal MP4 muxer for WebCodecs H.264 (+ AAC) chunks — frame-accurate export, plays in QuickTime / iPhone / editors.
// The whole file is built in memory with the index (moov) first, so players can start right away.
const te = new TextEncoder();

function box(type, ...parts) {
  let len = 8;
  for (const p of parts) len += p.length;
  const out = new Uint8Array(len), v = new DataView(out.buffer);
  v.setUint32(0, len); out.set(te.encode(type), 4);
  let o = 8;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
const full = (type, version, flags, ...parts) => box(type, u8(version, flags >> 16, flags >> 8, flags), ...parts);
const u8 = (...b) => new Uint8Array(b.map(x => x & 0xff));
function u16(...n) { const b = new Uint8Array(n.length * 2), v = new DataView(b.buffer); n.forEach((x, i) => v.setUint16(i * 2, x)); return b; }
function u32(...n) { return u32s(n); }
function u32s(n) { const b = new Uint8Array(n.length * 4), v = new DataView(b.buffer); n.forEach((x, i) => v.setUint32(i * 4, x)); return b; }   // tables can be long: no spreading
const zeros = n => new Uint8Array(n);
const MATRIX = u32(0x10000, 0, 0, 0, 0x10000, 0, 0, 0, 0x40000000);

export class MP4Writer {
  // audio (optional): {sampleRate, channels} — its AudioSpecificConfig arrives with the first AAC chunk's metadata
  constructor({ width, height, fps = 30, audio = null }) {
    Object.assign(this, { width, height, fps, audio });
    this.tracks = { 1: [], 2: [] };
    this.avcC = null; this.asc = null;
  }
  addChunk(chunk, track = 1, meta) {
    const data = new Uint8Array(chunk.byteLength);
    chunk.copyTo(data);
    const desc = meta?.decoderConfig?.description;
    if (desc) { const d = new Uint8Array(ArrayBuffer.isView(desc) ? desc.buffer.slice(desc.byteOffset, desc.byteOffset + desc.byteLength) : desc); if (track === 1) this.avcC ||= d; else this.asc ||= d; }
    this.tracks[track].push({ ts: chunk.timestamp, dur: chunk.duration || 0, key: chunk.type === 'key', data });
  }
  finish() {
    if (!this.avcC) throw new Error('H.264の設定情報を受け取れませんでした。');
    const video = this.tracks[1].sort((a, b) => a.ts - b.ts);
    const vEnd = video.length ? video.at(-1).ts + (video.at(-1).dur || 1e6 / this.fps) : 0;
    const audio = this.audio && this.asc ? this.tracks[2].filter(s => s.ts < vEnd).sort((a, b) => a.ts - b.ts) : [];
    const tracks = [{ id: 1, kind: 'video', samples: video, timescale: this.fps * 1000 }];
    if (audio.length) tracks.push({ id: 2, kind: 'audio', samples: audio, timescale: this.audio.sampleRate });
    for (const t of tracks) {
      t.durs = t.samples.map((s, i) => {
        const next = t.samples[i + 1];
        const us = s.dur || (next ? next.ts - s.ts : t.kind === 'video' ? 1e6 / this.fps : 1024 / this.audio.sampleRate * 1e6);
        return Math.max(1, Math.round(us * t.timescale / 1e6));
      });
      t.duration = t.durs.reduce((a, b) => a + b, 0);
    }
    const ftyp = box('ftyp', te.encode('isom'), u32(512), te.encode('isomiso2avc1mp41'));
    // moov's size does not depend on the offsets inside it: build once to measure, then again with real offsets
    const moovAt = base => {
      let o = base;
      for (const t of tracks) { t.offsets = t.samples.map(s => { const at = o; o += s.data.length; return at; }); }
      return this.moov(tracks);
    };
    const probe = moovAt(0);
    const mdatSize = tracks.reduce((n, t) => n + t.samples.reduce((m, s) => m + s.data.length, 0), 0) + 8;
    if (ftyp.length + probe.length + mdatSize > 0xffffffff) throw new Error('動画が大きすぎてMP4にできません（4GBまで）。短くするか画質を下げてね。');
    const moov = moovAt(ftyp.length + probe.length + 8);
    const mdatHead = new Uint8Array(8); new DataView(mdatHead.buffer).setUint32(0, mdatSize); mdatHead.set(te.encode('mdat'), 4);
    return new Blob([ftyp, moov, mdatHead, ...tracks.flatMap(t => t.samples.map(s => s.data))], { type: 'video/mp4' });
  }
  moov(tracks) {
    const movieMs = Math.max(...tracks.map(t => Math.round(t.duration / t.timescale * 1000)));
    const mvhd = full('mvhd', 0, 0, u32(0, 0, 1000, movieMs, 0x10000), u16(0x100), zeros(10), MATRIX, zeros(24), u32(tracks.length + 1));
    return box('moov', mvhd, ...tracks.map(t => this.trak(t)));
  }
  trak(t) {
    const isVideo = t.kind === 'video';
    const ms = Math.round(t.duration / t.timescale * 1000);
    const tkhd = full('tkhd', 0, 3, u32(0, 0, t.id, 0, ms), zeros(8), u16(0, 0, isVideo ? 0 : 0x100, 0), MATRIX,
      u32(isVideo ? this.width * 0x10000 : 0, isVideo ? this.height * 0x10000 : 0));
    const mdhd = full('mdhd', 0, 0, u32(0, 0, t.timescale, t.duration), u16(0x55c4, 0));   // language "und"
    const hdlr = full('hdlr', 0, 0, u32(0), te.encode(isVideo ? 'vide' : 'soun'), zeros(12), te.encode(isVideo ? 'VideoHandler\0' : 'SoundHandler\0'));
    const head = isVideo ? full('vmhd', 0, 1, zeros(8)) : full('smhd', 0, 0, zeros(4));
    const dinf = box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1)));
    return box('trak', tkhd, box('mdia', mdhd, hdlr, box('minf', head, dinf, this.stbl(t))));
  }
  stbl(t) {
    const isVideo = t.kind === 'video';
    const entry = isVideo
      ? box('avc1', zeros(6), u16(1), zeros(16), u16(this.width, this.height), u32(0x480000, 0x480000, 0), u16(1), zeros(32), u16(0x18, 0xffff), box('avcC', this.avcC))
      : box('mp4a', zeros(6), u16(1), zeros(8), u16(this.audio.channels, 16, 0, 0), u32(this.audio.sampleRate * 0x10000), this.esds());
    const runs = [];   // stts: run-length of sample durations
    for (const d of t.durs) { const last = runs.at(-1); if (last && last[1] === d) last[0]++; else runs.push([1, d]); }
    const parts = [
      full('stsd', 0, 0, u32(1), entry),
      full('stts', 0, 0, u32(runs.length), u32s(runs.flat())),
      full('stsc', 0, 0, u32(1, 1, 1, 1)),   // one sample per chunk keeps the offsets table simple
      full('stsz', 0, 0, u32(0, t.samples.length), u32s(t.samples.map(s => s.data.length))),
      full('stco', 0, 0, u32(t.offsets.length), u32s(t.offsets)),
    ];
    if (isVideo) { const keys = t.samples.flatMap((s, i) => s.key ? [i + 1] : []); parts.splice(2, 0, full('stss', 0, 0, u32(keys.length), u32s(keys))); }
    return box('stbl', ...parts);
  }
  esds() {
    const desc = (tag, ...parts) => { const body = parts.reduce((a, p) => [...a, ...p], []); return [tag, 0x80, 0x80, 0x80, body.length, ...body]; };
    const dsi = desc(0x05, [...this.asc]);
    const dcd = desc(0x04, [0x40, 0x15, 0, 0, 0], [...u32(0, 0)], dsi);   // AAC, audio stream
    const es = desc(0x03, [0, 0, 0], dcd, desc(0x06, [0x02]));
    return full('esds', 0, 0, new Uint8Array(es));
  }
}
