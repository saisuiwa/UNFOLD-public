// Which characters a TrueType font really has: its cmap table, read without any library.
// A motion that mixes several fonts (the 切り貼り文字 motions) must not ask a font for a glyph it lacks, so the runtime tells the motion which of
// the pool's fonts cover each character of the lyric (api.fontsFor).
// fontCoverage(arrayBuffer) -> has(codePoint): boolean. Formats 4 and 12 (every font bundled with UNFOLD); anything else is "not covered".
export function fontCoverage(buffer) {
  try {
    const v = new DataView(buffer), size = v.byteLength;
    const tag = o => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
    const numTables = v.getUint16(4);
    let cmap = -1;
    for (let i = 0; i < numTables; i++) {
      const o = 12 + i * 16;
      if (o + 16 > size) break;
      if (tag(o) === 'cmap') { cmap = v.getUint32(o + 8); break; }
    }
    if (cmap < 0 || cmap + 4 > size) return () => false;
    const subs = [];
    for (let i = 0, n = v.getUint16(cmap + 2); i < n; i++) {
      const o = cmap + 4 + i * 8;
      subs.push({ platform: v.getUint16(o), encoding: v.getUint16(o + 2), offset: cmap + v.getUint32(o + 4) });
    }
    // the full Unicode table first, then the 16-bit one
    const rank = s => (s.platform === 3 && s.encoding === 10 ? 0 : s.platform === 0 && s.encoding >= 4 ? 1 : s.platform === 3 && s.encoding === 1 ? 2 : s.platform === 0 ? 3 : 9);
    const sub = subs.filter(s => rank(s) < 9).sort((a, b) => rank(a) - rank(b))[0];
    if (!sub) return () => false;
    const off = sub.offset, format = v.getUint16(off);
    if (format === 12) {
      const groups = v.getUint32(off + 12), base = off + 16;
      return cp => {
        let lo = 0, hi = groups - 1;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1, g = base + mid * 12, start = v.getUint32(g), end = v.getUint32(g + 4);
          if (cp < start) hi = mid - 1;
          else if (cp > end) lo = mid + 1;
          else return v.getUint32(g + 8) + (cp - start) > 0;
        }
        return false;
      };
    }
    if (format === 4) {
      const segX2 = v.getUint16(off + 6), seg = segX2 / 2;
      const ends = off + 14, starts = ends + segX2 + 2, deltas = starts + segX2, ranges = deltas + segX2;
      return cp => {
        if (cp > 0xffff) return false;
        for (let i = 0; i < seg; i++) {
          if (v.getUint16(ends + i * 2) < cp) continue;
          const start = v.getUint16(starts + i * 2);
          if (start > cp) return false;
          const delta = v.getInt16(deltas + i * 2), ro = v.getUint16(ranges + i * 2);
          if (ro === 0) return ((cp + delta) & 0xffff) !== 0;
          const at = ranges + i * 2 + ro + (cp - start) * 2;
          if (at + 2 > size) return false;
          const gid = v.getUint16(at);
          return gid !== 0 && ((gid + delta) & 0xffff) !== 0;
        }
        return false;
      };
    }
  } catch { /* a broken font file: nothing is covered */ }
  return () => false;
}
