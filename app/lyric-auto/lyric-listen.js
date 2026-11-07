// MOTION LAB（site/lab/lyric-listen.js）から写した物（2026-11-08）。直す時は、両方そろえる。
// 歌を聞き取る（2026-10-31）: 曲の声を Whisper（transformers.js）で 30 秒ずつ聞き取り、聞こえた字と、その字を歌い始めた時刻（曲の秒）を返す。
// 時刻は、聞き取った字（トークン）が音のどこを見ていたか（cross-attention の DTW）から出る。歌詞の行への割り当ては lyric-align.js。
// model・processor・tokenizer を外から渡すので、ブラウザ（lyric-worker.js）でも node（測る道具）でも同じ流れで動く。DOM なし。
//   進め方は OpenAI の Whisper と同じ: 30 秒の窓を聞いて、最後の区切りが閉じていなければ、その区切りの頭から次の窓を始める。

export const RATE = 16000;   // Whisper が聞く音（16kHz・1ch）
/** 聞き取りの仕組み: Whisper small（多言語。字ごとの時刻のための cross-attention つき）の 8bit 版。base 以下は歌の日本語をほとんど聞き取れなかった。
 *  mb は初めての時に読み込む大きさ（Hugging Face から。あとはブラウザの Cache Storage に残る） */
export const WHISPER = {model: 'onnx-community/whisper-small_timestamped', dtype: {encoder_model: 'q8', decoder_model_merged: 'q8'}, mb: 250,
  files: ['onnx/encoder_model_quantized.onnx', 'onnx/decoder_model_merged_quantized.onnx']};
const WIN = 30, STEP = .02;   // 窓の秒、時刻の刻み（タイムスタンプ1つ = 0.02 秒）

/** トークンの並び（1窓ぶん）から、同じ短いまとまり（1〜6 トークン）が 4 回より多く続く所を切る（歌の無い所で、同じ言葉をくり返し聞き取ってしまう） */
export function cutLoops(ids, {unit = 6, times = 4} = {}) {
  for (let i = 0; i < ids.length; i++) {
    for (let u = 1; u <= unit && i + u * (times + 1) <= ids.length; u++) {
      let k = 1;
      while (i + (k + 1) * u <= ids.length && ids.slice(i + k * u, i + (k + 1) * u).every((v, j) => v === ids[i + j])) k++;
      if (k > times) return {ids: ids.slice(0, i + u), cut: true};
    }
  }
  return {ids, cut: false};
}

/**
 * 1窓ぶんの出力（init のあとのトークンと、その時刻）を、区切り（[開始, 字…, 終了]）に分けて、次の窓の始まりを決める。
 * tsBegin: タイムスタンプの最初のトークン番号。textEnd: これより小さい番号が字のトークン。返すのは {pieces: [{id, t}]（窓の頭からの秒）, consumed（窓の頭から進める秒）}
 */
export function readWindow(ids, times, {tsBegin, textEnd, winSec = WIN}) {
  const isTs = id => id >= tsBegin;
  const pairs = [];
  for (let i = 0; i + 1 < ids.length; i++) if (isTs(ids[i]) && isTs(ids[i + 1])) pairs.push(i + 1);
  const lastText = ids.findLastIndex(id => id < textEnd);
  const singleEnd = lastText >= 0 && lastText + 1 < ids.length && isTs(ids[lastText + 1]) && !(lastText + 2 < ids.length && isTs(ids[lastText + 2]));
  let keep = ids.length, consumed = winSec;
  if (pairs.length && !singleEnd) {   // 最後の区切りが閉じていない: その区切りの頭から、次の窓で聞き直す
    const at = pairs.at(-1);
    keep = at;
    consumed = (ids[at] - tsBegin) * STEP;
  }
  const pieces = [];
  for (let i = 0; i < keep; i++) if (ids[i] < textEnd) pieces.push({id: ids[i], t: times[i], next: times[i + 1] ?? times[i]});
  return {pieces, consumed: consumed > 1 ? consumed : winSec};   // 1 秒より進まない時は、窓ごと進める（同じ所を聞き続けない）
}

/**
 * トークンを字に。日本語の字は 2 トークンにまたがることがある（UTF-8 の途中で切れる）ので、文字にできるまでつなぐ。
 * 1つのまとまりに字がいくつかある時は、そのまとまりの始まりから次のまとまりの始まりまでに等しく割る。返すのは [{ch, t}]（空白は除く）
 */
export function piecesToChars(pieces, decode) {
  const out = [];
  let group = [];
  const flush = (end) => {
    if (!group.length) return;
    const text = decode(group.map(p => p.id)), chars = [...text].filter(c => !/\s/.test(c)), a = group[0].t, b = Math.max(a, end);
    chars.forEach((ch, k) => out.push({ch, t: Math.round((a + (b - a) * k / chars.length) * 1000) / 1000}));
    group = [];
  };
  for (let i = 0; i < pieces.length; i++) {
    group.push(pieces[i]);
    if (!decode(group.map(p => p.id)).includes('�') || group.length >= 4) flush(pieces[i + 1]?.t ?? pieces[i].next);
  }
  flush(pieces.at(-1)?.next ?? 0);
  return out;
}

/** 聞き直す時の決め方: 1回目は前置きなしで、いちばん確かな字。くり返しになった窓だけ、前置き（それまでの歌詞）を付けて聞き直し、だめなら少し揺らして。
 *  前置きをいつも付けると、伴奏だけの所で歌詞らしい言葉を作ってしまい、くり返す行（サビ）が別の所に合ってしまった */
const TRIES = [{}, {prompt: true}, {do_sample: true, temperature: .4, top_k: 0}];

/**
 * 曲（16kHz・1ch の Float32Array）を聞き取る。whisper = {model, processor, tokenizer}（transformers.js）。
 * onProgress(0..1)、stop() が true を返したら止める（途中までを返す）。prompt(秒, それまでに聞いた字) → 聞き直す時の前置き（それまでの歌詞。無ければ ''）。
 * 同じ言葉のくり返しになった窓は、聞き直す（それでもくり返す時は、くり返しの前までを使って、くり返しの始まりから次の窓）。
 * 返すのは {chars: [{ch, t}]（曲の秒）, windows（聞いた窓の数）, loops（くり返しを切った窓の数）, stopped}
 */
export async function listenSong(whisper, audio, {onProgress = () => {}, stop = () => false, prompt = null, maxNew = 200, log = null} = {}) {
  const {model, processor, tokenizer} = whisper;
  const [sot, ja, tr, prev, eot, tsBegin] = tokenizer.convert_tokens_to_ids(['<|startoftranscript|>', '<|ja|>', '<|transcribe|>', '<|startofprev|>', '<|endoftext|>', '<|0.00|>']), textEnd = eot;
  const decode = ids => tokenizer.decode(ids, {skip_special_tokens: true});
  const chars = [];
  let seek = 0, windows = 0, loops = 0;
  while (seek < audio.length - RATE * .5) {
    if (stop()) return {chars, windows, loops, stopped: true};
    const win = audio.subarray(seek, seek + WIN * RATE), off = seek / RATE, winSec = Math.min(WIN, win.length / RATE);
    const {input_features} = await processor(win);
    let best = null;
    for (const {prompt: withPrompt, ...t} of TRIES) {
      const before = withPrompt ? (prompt ? tokenizer.encode(' ' + prompt(off, chars), {add_special_tokens: false}).slice(-200) : []) : [];
      if (withPrompt && !before.length) continue;
      const init = [...(before.length ? [prev, ...before] : []), sot, ja, tr];
      const out = await model.generate({inputs: input_features, decoder_input_ids: init, return_timestamps: true, return_token_timestamps: true,
        num_frames: Math.floor(win.length / 320), max_new_tokens: maxNew, ...t});
      const seq = out.sequences.tolist()[0].map(Number).slice(init.length), times = out.token_timestamps.tolist()[0].slice(init.length);
      const {ids, cut} = cutLoops(seq.at(-1) === eot ? seq.slice(0, -1) : seq);
      const text = ids.filter(id => id < textEnd).length;
      if (!best || (best.cut && !cut) || (best.cut === cut && text > best.text)) best = {ids, times, cut, text};
      if (!cut || stop()) break;
    }
    const {ids, times, cut} = best;
    if (cut) loops++;
    let {pieces, consumed} = readWindow(ids, times, {tsBegin, textEnd, winSec});
    if (cut) {   // くり返しの前までを使って、くり返しが始まった所（最後のタイムスタンプ）から次の窓
      const lastTs = ids.findLast(id => id >= tsBegin);
      consumed = Math.min(winSec, Math.max(2, lastTs == null ? 0 : (lastTs - tsBegin) * STEP));
      pieces = pieces.filter(p => p.t < consumed + .5);
    }
    const got = piecesToChars(pieces.map(p => ({...p, t: p.t + off, next: p.next + off})), decode);
    chars.push(...got);
    log?.({at: off, consumed, cut, text: got.map(c => c.ch).join(''), raw: decode(ids)});
    windows++;
    seek += Math.round(consumed * RATE);
    onProgress(Math.min(1, seek / audio.length));
  }
  return {chars, windows, loops, stopped: false};
}
