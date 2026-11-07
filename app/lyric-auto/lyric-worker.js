// MOTION LAB（site/lab/lyric-worker.js）から写した物（2026-11-08）。直す時は、両方そろえる。
// 歌詞を曲に合わせる（自動）の、聞き取りの係（Web Worker。2026-10-31）。画面を止めずに、Whisper（transformers.js、site/lab/vendor）で曲を聞き取る。
// 曲は、このブラウザの中で聞くだけ（どこにも送らない）。読み込むのは、聞き取りの仕組み（WHISPER のモデル。初めての時だけ。あとはブラウザに残る）。
//   受け取る: {type: 'run', audio（16kHz・1ch の Float32Array）, texts（歌詞の行の文。聞き直す時の前置きに）, host?（モデルの置き場所。試験用）} / {type: 'stop'}
//   返す:     {type: 'load', loaded, total}（読み込みのバイト数）→ {type: 'listen', p}（0..1）→ {type: 'done', chars, windows, loops, stopped, ms} か {type: 'error', message}
//   vendor の作り方: @huggingface/transformers 4.3.2（Apache-2.0）の dist/transformers.web.min.js の import 2つ（"onnxruntime-web/webgpu"・"onnxruntime-common"）を
//   ./ort-1.31.0-dev.wasm.min.mjs に書き換えた物。そちらは onnxruntime-web 1.31.0-dev.20260914（MIT）の dist/ort.wasm.bundle.min.mjs（CPU だけ）と ort-wasm-simd-threaded.wasm。
//   WebGPU の版の wasm は 26〜28MB で、Cloudflare の1ファイル 25MiB を越えるので使わない
import {env, AutoProcessor, AutoTokenizer, WhisperForConditionalGeneration} from './vendor/transformers-4.3.2.min.js';
import {listenSong, WHISPER} from './lyric-listen.js';
import {lyricsBefore} from './lyric-align.js';

env.allowLocalModels = false;
env.backends.onnx.wasm.wasmPaths = {wasm: new URL('./vendor/ort-wasm-simd-threaded.wasm', import.meta.url).href};   // 実行の仕組み（wasm）も、このサイトの物を使う（つなぎの JS は ort の中に入っている）
env.backends.onnx.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;

let whisper = null, stopping = false;
async function load(host) {
  if (whisper) return whisper;
  if (host) env.remoteHost = host;
  const files = new Map();
  const progress_callback = x => {
    if (x.status !== 'progress' && x.status !== 'done') return;
    const f = files.get(x.file) || {loaded: 0, total: 0};
    if (x.total) f.total = x.total;
    f.loaded = x.status === 'done' ? f.total : x.loaded ?? f.loaded;
    files.set(x.file, f);
    let loaded = 0, total = 0;
    for (const v of files.values()) { loaded += v.loaded; total += v.total; }
    postMessage({type: 'load', loaded, total});
  };
  const [processor, tokenizer, model] = await Promise.all([
    AutoProcessor.from_pretrained(WHISPER.model, {progress_callback}),
    AutoTokenizer.from_pretrained(WHISPER.model, {progress_callback}),
    WhisperForConditionalGeneration.from_pretrained(WHISPER.model, {dtype: WHISPER.dtype, device: 'wasm', progress_callback}),
  ]);
  return (whisper = {processor, tokenizer, model});
}

self.onmessage = async ({data}) => {
  if (data?.type === 'stop') { stopping = true; return; }
  if (data?.type !== 'run') return;
  stopping = false;
  try {
    const w = await load(data.host);
    const t0 = performance.now();
    postMessage({type: 'listen', p: 0});
    const texts = Array.isArray(data.texts) ? data.texts.map(String) : [];
    const r = await listenSong(w, data.audio, {onProgress: p => postMessage({type: 'listen', p}), stop: () => stopping, prompt: texts.length ? (_, heard) => lyricsBefore(texts, heard) : null});
    postMessage({type: 'done', ...r, ms: Math.round(performance.now() - t0)});
  } catch (e) {
    postMessage({type: 'error', message: String(e?.message || e)});
  }
};
