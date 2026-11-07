// MOTION LAB（site/lab/auto-sync.js）から写した物（2026-11-08）。直す時は、両方そろえる。
// 歌詞を曲に合わせる（自動。2026-10-31）の、画面の側。ボタンを押した時だけ、曲を聞き取りの係（lyric-worker.js）に渡し、
// 聞こえた字を歌詞の行に合わせる（lyric-align.js）。曲を入れるたびには動かさない（聞き取りの仕組みが大きく、聞くのに時間がかかるので）。
// 曲はこのブラウザの中で聞くだけ。初めての時だけ、聞き取りの仕組み（約 WHISPER.mb MB）を Hugging Face から読み込む（あとは Cache Storage に残る）。
import {RATE, WHISPER} from './lyric-listen.js';
import {alignLyrics, applyAligned, alignNote} from './lyric-align.js';

/** 曲（AudioBuffer）を、Whisper の聞く形（16kHz・1ch）に */
export async function whisperAudio(buffer) {
  const ctx = new OfflineAudioContext(1, Math.ceil(buffer.duration * RATE), RATE), src = ctx.createBufferSource();
  src.buffer = buffer; src.connect(ctx.destination); src.start();
  return (await ctx.startRendering()).getChannelData(0).slice();
}

/** 聞き取りの仕組みを、もう読み込んであるか（transformers.js の Cache Storage） */
export async function modelCached(host = 'https://huggingface.co/') {
  try {
    const c = await caches.open('transformers-cache');
    for (const f of WHISPER.files) if (!await c.match(`${host}${WHISPER.model}/resolve/main/${f}`)) return false;
    return true;
  } catch { return false; }
}

const mb = b => (b / 1e6).toFixed(0);
/**
 * 「歌詞を曲に合わせる（自動）」のボタン。getBuffer() → 曲の AudioBuffer、getLines() → 作品の行、apply(新しい行, 結果) で作品に入れる、say(文) でお知らせ。
 * host: 聞き取りの仕組みの置き場所（試験用。ふつうは Hugging Face）
 */
export function autoSyncButton({getBuffer, getLines, apply, say, host = null}) {
  const btn = document.createElement('button');
  const idle = '歌詞を曲に合わせる（自動）';
  btn.type = 'button'; btn.textContent = idle; btn.id = 'auto-sync';
  btn.title = `曲の歌を、このブラウザの中で聞き取って（Whisper）、歌詞の行の始まり・終わりと、字ごとの歌の時刻を付けます。曲はどこにも送りません。初めての時だけ、聞き取りの仕組み（約 ${WHISPER.mb}MB）を読み込みます`;
  let worker = null, busy = false;   // busy: 押してから終わるまで（曲を 16kHz にしている間も、もう一度押すと止める）
  const stop = msg => { worker?.terminate(); worker = null; busy = false; btn.textContent = idle; delete btn.dataset.busy; if (msg) say(msg); };
  btn.addEventListener('click', async () => {
    if (busy) { stop('止めました（時刻は変えていません）。'); return; }
    const buffer = getBuffer(), lines = getLines();
    if (!buffer) { say('先に曲を入れてね（曲のファイルを選ぶか、画面に落とす）。'); return; }
    if (!lines.some(l => l.text.trim())) { say('先に歌詞を入れてね（1行ずつ）。'); return; }
    const cached = await modelCached(host || undefined);
    const ask = `全部の行の時刻を、曲の歌を聞き取って付け直します（元に戻すで戻せます）。曲はこのブラウザの中で聞くだけで、どこにも送りません。曲の長さと同じくらいから、その数倍の時間がかかります。` +
      (cached ? '' : `\n\n初めてなので、聞き取りの仕組み（約 ${WHISPER.mb}MB）を Hugging Face から読み込みます。次からは、このブラウザに残ります。`);
    if (!confirm(ask)) return;
    busy = true; btn.textContent = '止める'; btn.dataset.busy = '';   // 動いている間は、色を抜く（index.html の #auto-sync[data-busy]）
    say('曲を聞く準備をしています…');
    let audio;
    try { audio = await whisperAudio(buffer); } catch (e) { stop('曲を聞く形にできませんでした: ' + (e.message || e)); return; }
    if (!busy) return;   // 準備の間に止めた
    const t0 = performance.now();
    worker = new Worker(new URL('./lyric-worker.js', import.meta.url), {type: 'module'});
    worker.onmessage = ({data}) => {
      if (data.type === 'load') say(`聞き取りの仕組みを読み込んでいます… ${mb(data.loaded)} / ${mb(data.total)} MB${cached ? '' : '（初めての時だけ）'}`);
      else if (data.type === 'listen') say(`曲を聞いています… ${Math.round(data.p * 100)}%`);
      else if (data.type === 'error') stop('聞き取りで失敗しました: ' + data.message);
      else if (data.type === 'done') {
        const now = getLines(), got = alignLyrics(now.map(l => ({text: l.text})), data.chars, {duration: buffer.duration});   // 聞いている間に直した歌詞にも合わせる
        stop();
        if (got.matched) apply(applyAligned(now, got), got);
        say(alignNote(got) + `（聞き取り ${((performance.now() - t0) / 1000).toFixed(0)} 秒）`);
      }
    };
    worker.onerror = e => stop('聞き取りの係を動かせませんでした: ' + (e.message || e));
    worker.postMessage({type: 'run', audio, texts: lines.map(l => l.text), ...(host ? {host} : {})}, [audio.buffer]);
  });
  return btn;
}
