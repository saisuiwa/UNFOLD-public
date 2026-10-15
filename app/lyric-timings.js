// Lyric timing files (JSON / LRC / SRT) -> [{s, e?, t, k?}]. No DOM and no three.js here, so the lyric timing page can use it too;
// lyric-mv.js re-exports these for the sequence page.
// SRT: "HH:MM:SS,mmm --> HH:MM:SS,mmm" (a "." for the comma and a missing hour are tolerated, so a WebVTT-style cue reads too)
const SRT_CUE = /(?:(\d+):)?(\d{1,2}):(\d{1,2})[,.](\d{1,3})\s*-->\s*(?:(\d+):)?(\d{1,2}):(\d{1,2})[,.](\d{1,3})/;
const srtSeconds = (h, m, s, ms) => Number(h || 0) * 3600 + Number(m) * 60 + Number(s) + Number('0.' + ms);
const SRT_ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&nbsp;': ' ', '&quot;': '"', '&#39;': "'" };
function parseSrt(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/), out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = SRT_CUE.exec(lines[i]);
    if (!m) continue;
    const s = srtSeconds(m[1], m[2], m[3], m[4]), e = srtSeconds(m[5], m[6], m[7], m[8]), parts = [];
    for (i++; i < lines.length && lines[i].trim(); i++) {
      if (SRT_CUE.test(lines[i])) break;                                            // the next cue came without a blank line
      if (/^\d+$/.test(lines[i].trim()) && SRT_CUE.test(lines[i + 1] || '')) break; // …and this is its index number
      const body = lines[i].replace(/<\/?[a-z][^>]*>|\{\\[^}]*\}/gi, '').replace(/&(?:amp|lt|gt|nbsp|quot|#39);/g, x => SRT_ENTITIES[x]).trim();
      if (body) parts.push(body);                                                   // <i>…</i> and {\an8} are styling, not lyrics
    }
    i--;                                                                            // the blank line (or the next cue) is read by the outer loop
    if (parts.length) out.push({ s, ...(e > s ? { e } : {}), t: parts.join('/') }); // '/' is the app's in-phrase line break
  }
  return out.sort((a, b) => a.s - b.s);
}

// -> [{s, e?, t, k?}] sorted by start time
export function parseTimings(text, name = '') {
  const trimmed = text.trim();
  if (/\.srt$/i.test(name) || (!/\.(json|lrc)$/i.test(name) && !/^[[{]/.test(trimmed) && SRT_CUE.test(trimmed))) {
    const cues = parseSrt(text);
    if (!cues.length) throw new Error('字幕（SRT）の時刻つきの文字が見つかりませんでした。');
    return cues;
  }
  // an LRC file usually starts with "[" too ("[00:01.90]…" or "[ti:…]"), so a leading "[" alone doesn't mean JSON
  const looksLrc = /\.lrc$/i.test(name) || /^\[(\d+:\d+|[a-z]+:)/i.test(trimmed);
  if (/\.json$/i.test(name) || trimmed.startsWith('{') || (trimmed.startsWith('[') && !looksLrc)) {
    const d = JSON.parse(trimmed);
    const rows = Array.isArray(d) ? d : d.lines;
    if (!Array.isArray(rows)) throw new Error('JSONに歌詞の行（lines）が見つかりませんでした。');
    return rows.map(r => ({ s: Number(r.s ?? r.start ?? r.time), e: r.e ?? r.end, t: String(r.t ?? r.text ?? ''), k: r.k ?? r.kind }))
      .filter(r => Number.isFinite(r.s) && r.t.trim()).sort((a, b) => a.s - b.s);
  }
  const out = [];
  for (const line of text.split(/\r?\n/)) {             // LRC: [mm:ss.xx] text (several tags allowed)
    const tags = [...line.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
    const body = line.replace(/\[\d+:\d+(?:\.\d+)?\]/g, '').trim();
    if (!tags.length || !body) continue;
    for (const m of tags) out.push({ s: Number(m[1]) * 60 + Number(m[2]), t: body });
  }
  if (!out.length) throw new Error('タイミングを読み取れませんでした（.json か .lrc か .srt を選んでね）。');
  return out.sort((a, b) => a.s - b.s);
}
export function timingsToJSON(lines) {
  return JSON.stringify({ lines: lines.map(l => ({ s: +l.s.toFixed(2), ...(l.e != null ? { e: +Number(l.e).toFixed(2) } : {}), t: l.t, ...(l.k ? { k: l.k } : {}) })) }, null, 1);
}
