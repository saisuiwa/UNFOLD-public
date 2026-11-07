// MOTION LAB（site/lab/lyric-align.js）から写した物（2026-11-08）。直す時は、両方そろえる。
// 歌詞を曲に合わせる（自動。2026-10-31）: 聞き取った字（lyric-listen.js。[{ch, t}] 曲の秒）を、歌詞の行の字に突き合わせて、
// 行の始まり・終わりと、字ごとの歌の時刻（sung。sync.js が言葉の切れ目・歌合わせ・カラオケに使う）を出す。純関数（node でテストできる）。
//   突き合わせ: かなはひらがなに、英数字は半角の小文字に、漢数字は数字にそろえて、同じ字の最長の並び（LCS）を取る。
//   聞き違い（「開く」と「ひらく」など）の字は、同じ行の前後の合った字の間に割る。合った字の少ない行は、前後の行の間に並べる（合わせられなかった行として数える）。

/** 歌わない字（記号）。時刻は、行の中の前の字と同じにする（sync.js の sunoLines と同じ） */
const MARK = /[!?！？、。，．,.・…「」『』（）()〜~♪:：;；"'“”‘’\-－―/／]/;
const KANJI_NUM = {'〇': '0', '零': '0', '一': '1', '二': '2', '三': '3', '四': '4', '五': '5', '六': '6', '七': '7', '八': '8', '九': '9'};
const r3 = v => Math.round(v * 1000) / 1000;
export const LAG = .2;

/** 突き合わせに使う形（記号・空白は null） */
export function charKey(ch) {
  if (!ch || /\s/.test(ch) || MARK.test(ch)) return null;
  let c = ch.normalize('NFKC');   // 全角の英数字 → 半角、半角カナ → 全角
  if (!c || MARK.test(c)) return null;
  const code = c.codePointAt(0);
  if (code >= 0x30a1 && code <= 0x30f6) c = String.fromCodePoint(code - 0x60);   // カタカナ → ひらがな
  return KANJI_NUM[c] ?? c.toLowerCase();
}

/** 行の文の、sung に数える字（空白と改行の印「/」を除く）。work.js の letters と同じ数え方 */
export const lineLetters = text => [...String(text ?? '').replace(/\//g, '').replace(/\s/g, '')];

/**
 * a と b の最長共通部分列の組（[i, j] の並び）。どちらも数千字までの想定（表は a.length × b.length バイト）
 */
export function lcsPairs(a, b) {
  const n = a.length, m = b.length, W = m + 1;
  if (!n || !m) return [];
  let prev = new Uint16Array(W), cur = new Uint16Array(W);
  const dir = new Uint8Array((n + 1) * W);   // 1 = 斜め（合った）、2 = 上、3 = 左
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (a[i - 1] != null && a[i - 1] === b[j - 1]) { cur[j] = prev[j - 1] + 1; dir[i * W + j] = 1; }
      else if (prev[j] >= cur[j - 1]) { cur[j] = prev[j]; dir[i * W + j] = 2; }
      else { cur[j] = cur[j - 1]; dir[i * W + j] = 3; }
    }
    [prev, cur] = [cur, prev];
  }
  const out = [];
  for (let i = n, j = m; i > 0 && j > 0;) {
    const d = dir[i * W + j];
    if (d === 1) { out.push([i - 1, j - 1]); i--; j--; }
    else if (d === 2) i--;
    else j--;
  }
  return out.reverse();
}

/**
 * 合った組から、信じられる物だけ残す: 2字以上続けて合った所（歌詞の隣の字が、聞いた字の隣と合った）は残す。
 * 1字だけ合った所は、前後の残した組の時刻の間に入っていて、聞いた字の並びも前後の組の間にある時だけ残す（遠くの「の」「を」に飛びつかない）
 */
export function trustPairs(pairs, heardT) {
  const run = pairs.map((p, k) => {
    const prev = pairs[k - 1], next = pairs[k + 1];
    return (prev && prev[0] === p[0] - 1 && prev[1] === p[1] - 1) || (next && next[0] === p[0] + 1 && next[1] === p[1] + 1);
  });
  const kept = pairs.filter((_, k) => run[k]);
  const out = [];
  let a = -1;
  pairs.forEach((p, k) => {
    if (run[k]) { out.push(p); a = kept.indexOf(p); return; }
    const before = kept[a], after = kept[a + 1], t = heardT[p[1]];
    if ((!before || (heardT[before[1]] <= t && p[1] - before[1] <= 2 * (p[0] - before[0]) + 2)) && (!after || (t <= heardT[after[1]] && after[1] - p[1] <= 2 * (after[0] - p[0]) + 2)) && (before || after)) out.push(p);
  });
  // 時刻が戻る組（窓の切れ目のずれ）は外す
  const mono = [];
  for (const p of out) { if (mono.length && heardT[p[1]] < heardT[mono.at(-1)[1]] - .05) continue; mono.push(p); }
  return mono;
}

/**
 * 歌詞の行（[{text}]）に、聞き取った字（[{ch, t}]）を合わせる。
 * 返すのは {lines: [{s, e, sung, hit, n}]（入れた行と同じ順。s・e は秒、sung は字ごとの歌い始め。合わせられなかった行は s・e・sung が null）, matched（合わせた行の数）, letters, hits}
 *   minHit: 行の字のうち、合った字がこの割合より少ない行は、合わせられなかった行（ただし 2字以上合えば、短い行でも合わせる）
 *   duration: 曲の長さ（行の終わりは越えない）
 *   lag: 聞き取りの時刻を、この秒だけ前へ（Whisper の字の時刻は、歌い始めより少し遅れる。Suno の時刻と比べた3曲で、真ん中 0.12〜0.30 秒）
 */
export function alignLyrics(lines, heard, {minHit = .3, duration = Infinity, lag = LAG} = {}) {
  const lyric = [];   // 歌詞の字 {line, k, key}
  lines.forEach((l, li) => lineLetters(l.text).forEach((ch, k) => lyric.push({line: li, k, key: charKey(ch)})));
  const hk = heard.map(h => charKey(h.ch)), ht = heard.map(h => Math.max(0, h.t - lag));
  const keys = lyric.map(x => x.key);
  const heardIdx = hk.flatMap((k, j) => k == null ? [] : [j]);   // 記号を除いた、聞いた字
  const pairs = trustPairs(lcsPairs(keys, heardIdx.map(j => hk[j])).map(([i, j]) => [i, heardIdx[j]]), ht);
  const at = new Map(pairs.map(([i, j]) => [i, j]));
  // 字の長さのふつう（続けて合った字の間の秒の、真ん中）
  const gaps = [];
  for (let k = 1; k < pairs.length; k++) if (pairs[k][0] === pairs[k - 1][0] + 1 && lyric[pairs[k][0]].line === lyric[pairs[k - 1][0]].line) gaps.push(ht[pairs[k][1]] - ht[pairs[k - 1][1]]);
  gaps.sort((a, b) => a - b);
  const step = Math.min(.5, Math.max(.12, gaps.length ? gaps[gaps.length >> 1] : .25));
  const out = lines.map((l, li) => {
    const idx = lyric.flatMap((x, i) => x.line === li ? [i] : []), n = idx.length;
    const hits = idx.filter(i => at.has(i)), sungN = idx.filter(i => lyric[i].key != null).length;
    if (!n || hits.length < 2 && !(hits.length === 1 && sungN === 1) || hits.length < minHit * sungN) return {s: null, e: null, sung: null, hit: hits.length, n};
    const T = idx.map(i => at.has(i) ? ht[at.get(i)] : null);
    // 合った字の間は割る、外側は字の長さのふつうで前・後ろへ
    const known = T.flatMap((t, k) => t == null ? [] : [k]);
    for (let k = 0; k < n; k++) {
      if (T[k] != null) continue;
      const p = known.findLast(q => q < k), q = known.find(q => q > k);
      T[k] = p === undefined ? T[q] - step * (q - k) : q === undefined ? T[p] + step * (k - p) : T[p] + (T[q] - T[p]) * (k - p) / (q - p);
    }
    idx.forEach((i, k) => { if (lyric[i].key == null && k) T[k] = T[k - 1]; });   // 記号は、前の字の時刻
    const last = known.at(-1), lastHeard = at.get(idx[last]);
    const sungEnd = ht.slice(lastHeard + 1).find(t => t > ht[lastHeard]) ?? ht[lastHeard] + step;   // 最後に合った字を歌い終わる頃（次に聞こえた字）
    return {s: T[0], e: null, sung: T, hit: hits.length, n, lastEnd: Math.min(sungEnd, ht[lastHeard] + 1) + step * (n - 1 - last)};
  });
  // 前の行より前に始まる行（聞き違いの組）は、合わせられなかった行に
  let prevS = -Infinity;
  for (const o of out) { if (o.s == null) continue; if (o.s < prevS + .05) { Object.assign(o, {s: null, sung: null}); continue; } prevS = o.s; }
  // 合わせられなかった行: 前後の合わせた行の間に、字の数で割って並べる（間が広すぎる時は、前の行の後に、字の長さのふつうで詰める）
  for (let i = 0; i < out.length;) {
    if (out[i].s != null) { i++; continue; }
    let j = i;
    while (j < out.length && out[j].s == null) j++;
    const prev = out[i - 1], next = out[j], letters = out.slice(i, j).map(o => Math.max(1, o.n)), total = letters.reduce((a, b) => a + b, 0);
    const from = prev ? Math.max(prev.sung.at(-1) + step, prev.lastEnd) : null, to = next ? next.s - step : null;
    const want = total * step * 1.6;
    let a, b;
    if (from != null && to != null) { a = from; b = to - a > want * 2 ? a + want : to; }
    else if (from != null) { a = from; b = Math.min(duration, a + want); }
    else if (to != null) { b = to; a = Math.max(0, b - want); }
    else { i = j; continue; }   // どの行も合わなかった
    if (!(b > a)) { i = j; continue; }
    let c = a;
    for (let k = i; k < j; k++) {
      const len = (b - a) * letters[k - i] / total, n = out[k].n;
      out[k].s = c;
      out[k].sung = Array.from({length: n}, (_, q) => c + len * .85 * q / Math.max(1, n));
      out[k].lastEnd = c + len;
      out[k].guess = true;
      c += len;
    }
    i = j;
  }
  // 行の終わり: 最後の字を歌い終わる頃から少し後、次の行の始まりの少し前まで。字の時刻は、行の中に詰める（増えていく順）
  out.forEach((o, i) => {
    if (o.s == null) return;
    const next = out.slice(i + 1).find(x => x.s != null)?.s ?? duration;
    o.e = Math.max(o.s + .2, Math.min(next - .01, Math.max(o.sung.at(-1) + .1, Math.min(o.lastEnd + .5, next - .05))));
    let low = o.s;
    o.sung = o.sung.map(t => (low = Math.min(o.e - .02, Math.max(low, t))));
  });
  const res = out.map(o => o.s == null ? {s: null, e: null, sung: null, hit: o.hit, n: o.n} : {s: r3(o.s), e: r3(o.e), sung: o.sung.map(r3), hit: o.hit, n: o.n, ...(o.guess ? {guess: true} : {})});
  return {lines: res, matched: res.filter(o => o.s != null && !o.guess).length, letters: lyric.length, hits: pairs.length};
}

/**
 * 聞き直す時の前置き（Whisper の prompt）: それまでに聞いた字で最後に合った行までの、歌詞の数行。まだどの行も合っていなければ ''（前置きなし）。
 * 前置きは「前に歌った言葉」として読まれ、同じ書き方（カタカナ・漢字）に寄る。まだ歌っていない行を入れると、その行を聞こえたことにしてしまう（試した曲の頭で、33 秒からの行を 0〜27 秒に書いた）
 */
export function lyricsBefore(texts, heard, {lines = 4} = {}) {
  const got = heard.length ? alignLyrics(texts.map(text => ({text})), heard, {lag: 0}).lines : [];
  const last = got.findLastIndex(l => l.s != null && !l.guess);
  return last < 0 ? '' : texts.slice(Math.max(0, last + 1 - lines), last + 1).join(' ');
}

/** 合わせた結果を、作品の行に（合わせた行は s・e と字の時刻 sung、前後の間に並べた行は s・e だけ。合わなかった行は元のまま） */
export function applyAligned(lines, got) {
  return lines.map((l, i) => {
    const g = got.lines[i];
    if (!g || g.s == null) return l;
    const {sung: _, ...rest} = l;
    return {...rest, s: g.s, e: g.e, ...(g.guess ? {} : {sung: g.sung})};
  });
}

/** 合わせた結果のお知らせ */
export function alignNote(got) {
  const n = got.lines.length, guess = got.lines.filter(l => l.guess).length, miss = got.lines.filter(l => l.s == null).length;
  if (!got.matched) return '歌が聞き取れなかったので、時刻は変えていません（歌のない曲・歌詞と違う曲かも）。';
  return `${n} 行のうち ${got.matched} 行を、聞こえた歌に合わせました（字ごとの歌の時刻つき）。` +
    (guess ? `${guess} 行は聞き取れなかったので、前後の行の間に並べた仮の時刻です。` : '') + (miss ? `${miss} 行は時刻を変えていません。` : '') +
    'タイムラインの箱を引っぱって直せます。元に戻すで、前の時刻に戻せます。';
}
