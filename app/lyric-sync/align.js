// Pure helpers for the lyric timing app (index.html): split the lyrics, read the ElevenLabs forced alignment answer,
// and give every lyric line its start time. No network and no DOM here, so tools/test/lyric-sync.test.mjs can test it.

const SECTION = /^\s*[\[【（(]\s*([^\]】）)]+?)\s*[\]】）)]\s*$/;
const KNOWN = {intro: 'intro', verse: 'verse', 'a': 'verse', 'aメロ': 'verse', 'bメロ': 'prechorus', prechorus: 'prechorus', 'pre-chorus': 'prechorus',
  chorus: 'chorus', 'サビ': 'chorus', hook: 'chorus', bridge: 'bridge', 'ブリッジ': 'bridge', instrumental: 'instrumental', inst: 'instrumental', '間奏': 'instrumental',
  outro: 'outro', 'アウトロ': 'outro', 'イントロ': 'intro'};

// Lines like "[Chorus]" are headings, not lyrics. Everything else with text is a lyric line.
export function parseLyricLines(text) {
  const lines = [];
  let kind = '';
  for (const raw of String(text).split(/\r?\n/)) {
    const heading = raw.match(SECTION);
    if (heading) { const key = heading[1].trim().toLowerCase().replace(/\s*\d+$/, ''); kind = KNOWN[key] || ''; continue; }
    if (!raw.trim()) continue;
    lines.push({t: raw.trim(), k: kind});
  }
  return lines;
}

// What is sent for alignment: the lyric text without UNFOLD's marks ("/" = line break on screen, "*word*" = emphasis).
export function plainText(line) { return line.replace(/[\/／*＊]/g, ''); }
export function spokenChars(line) { return [...plainText(line).replace(/\s/g, '')]; }
export function alignmentText(lines) { return lines.map(l => plainText(l.t)).join('\n'); }

// The answer may carry per-character times, per-word times, or both. Returns [{c, s, e}] for every character without spaces.
export function characterTimeline(answer) {
  const chars = (answer.characters || []).filter(x => x && typeof x.text === 'string' && !/^\s*$/.test(x.text));
  if (chars.length) return chars.map(x => ({c: x.text, s: Number(x.start), e: Number(x.end)}));
  const out = [];
  for (const w of answer.words || []) {
    const letters = [...String(w.text || '').replace(/\s/g, '')];
    if (!letters.length) continue;
    const s = Number(w.start), e = Number(w.end);
    letters.forEach((c, i) => out.push({c, s: s + (e - s) * i / letters.length, e: s + (e - s) * (i + 1) / letters.length}));
  }
  return out;
}

// Give each line the time of its first character. When the answer has a different number of characters than the lyrics
// (the service may normalise numbers or symbols), positions are scaled so the lines still come out in order.
export function lineTimes(lines, answer) {
  const timeline = characterTimeline(answer);
  if (!timeline.length) throw new Error('時刻が返ってきませんでした。');
  const counts = lines.map(l => spokenChars(l.t).length), total = counts.reduce((a, b) => a + b, 0);
  const scale = total ? timeline.length / total : 1;
  let before = 0;
  return lines.map((l, i) => {
    const first = Math.min(timeline.length - 1, Math.round(before * scale));
    const last = Math.min(timeline.length - 1, Math.max(first, Math.round((before + counts[i]) * scale) - 1));
    before += counts[i];
    return {t: l.t, k: l.k, s: Math.max(0, timeline[first].s), e: Math.max(timeline[first].s, timeline[last].e), exact: timeline.length === total,
      chars: timeline.length === total ? timeline.slice(first, last + 1) : null};
  });
}

export function fixOrder(rows) {      // times never go backwards, and a line never ends after the next one starts
  const out = rows.map(r => ({...r}));
  for (let i = 1; i < out.length; i++) if (out[i].s < out[i - 1].s) out[i].s = out[i - 1].s;
  for (let i = 0; i < out.length - 1; i++) if (out[i].e > out[i + 1].s) out[i].e = out[i + 1].s;
  return out;
}

const two = n => String(n).padStart(2, '0');
export function toLrc(rows) {
  return rows.map(r => { const m = Math.floor(r.s / 60), s = r.s - m * 60; return `[${two(m)}:${s.toFixed(2).padStart(5, '0')}]${r.t}`; }).join('\n') + '\n';
}
// The JSON UNFOLD reads in "歌詞を選択（LRC/JSON）": { lines: [{ s, t, k }] }
export function toJson(rows) {
  return JSON.stringify({lines: rows.map(r => ({s: +r.s.toFixed(2), e: +r.e.toFixed(2), t: r.t, ...(r.k ? {k: r.k} : {})}))}, null, 1);
}

// POST /v1/forced-alignment (multipart: file, text). baseUrl lets a proxy stand in for api.elevenlabs.io later.
export async function requestAlignment({file, text, apiKey, baseUrl = 'https://api.elevenlabs.io', fetchImpl = fetch}) {
  const body = new FormData();
  body.append('file', file, file.name || 'song.mp3');
  body.append('text', text);
  const res = await fetchImpl(`${baseUrl.replace(/\/+$/, '')}/v1/forced-alignment`, {method: 'POST', headers: {'xi-api-key': apiKey}, body});
  if (!res.ok) {
    let detail = '';
    try { detail = JSON.stringify((await res.json()).detail ?? ''); } catch { /* not JSON */ }
    throw new Error(`ElevenLabs から ${res.status} が返りました。${detail.slice(0, 200)}`);
  }
  return res.json();
}

// ---- editing after the times are known (kanji, cutting a line in two, joining) ------------------------------------

// Cut a line at `caret` (a position in row.t). The second part starts at the time of its first character when the line still has
// its per-character times (the text has not been reworded yet); otherwise at the same share of the line's length.
export function splitRow(row, caret) {
  const head = row.t.slice(0, caret).trimEnd(), tail = row.t.slice(caret).trimStart();
  if (!head || !tail) return [row];
  const before = spokenChars(head).length, total = spokenChars(row.t).length;
  const usable = row.chars && row.chars.length === total && before > 0 && before < total;
  const at = usable ? row.chars[before].s : row.s + (row.e - row.s) * (before / total);
  const first = {...row, t: head, e: Math.min(row.e, usable ? row.chars[before - 1].e : at), chars: usable ? row.chars.slice(0, before) : null};
  const second = {...row, t: tail, s: at, chars: usable ? row.chars.slice(before) : null};
  return [first, second];
}

// Join a line with the one before it.
export function mergeRows(previous, row) {
  const chars = previous.chars && row.chars ? [...previous.chars, ...row.chars] : null;
  return {...previous, t: `${previous.t} ${row.t}`, e: Math.max(previous.e, row.e), exact: previous.exact && row.exact, chars};
}

// Replace the display text of every line with text that came back from an AI (kana -> kanji). The line count must stay the same.
export function applyRewritten(rows, text) {
  const lines = String(text).split(/\r?\n/).map(l => l.trim()).filter(l => l && !SECTION.test(l));
  if (lines.length !== rows.length) throw new Error(`行の数が違います（いまの歌詞は ${rows.length} 行、貼った歌詞は ${lines.length} 行）。見出しの行（[Verse] など）は数えません。`);
  return rows.map((r, i) => ({...r, t: lines[i], chars: spokenChars(lines[i]).length === (r.chars?.length ?? -1) ? r.chars : null}));
}

// The request to paste into an AI chat to turn the kana lyrics into kanji without touching the line breaks.
export function kanjiRequest(rows) {
  return `次の歌詞の、ひらがな・カタカナを、自然な漢字かな交じりに直してください。
- 1行ずつ、同じ順番・同じ行数で返してください（行を増やしたり減らしたり、まとめたりしないでください）。
- 言葉の意味や、歌詞の順番は変えないでください。
- 行の中の / や *強調* の印はそのまま残してください。
- 出力は、直した歌詞だけをコードブロック1つに入れてください（説明は不要です）。

${rows.map(r => r.t).join('\n')}`;
}
