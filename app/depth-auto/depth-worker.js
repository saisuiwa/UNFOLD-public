// 写真の奥行きを作る係（Web Worker。2026-11-11）。画面を止めずに、Depth Anything V2 Small（transformers.js、lyric-auto/vendor）で絵の深さを推定する。
// 絵はこのブラウザの中で見るだけ（どこにも送らない）。読み込むのは推定の仕組み（モデル）だけ。初めての時だけ。あとはブラウザに残る。
//   受け取る: {type: 'run', pixels（RGBA の Uint8ClampedArray）, width, height, host?（モデルの置き場所。試験用）}
//   返す:     {type: 'load', loaded, total}（読み込みのバイト数）→ {type: 'run'}（推定をはじめた）→ {type: 'done', width, height, depth（Float32Array、0 = 奥・1 = 手前、行は上から下）, ms} か {type: 'error', message}
import {env, AutoProcessor, AutoModelForDepthEstimation, RawImage} from '../lyric-auto/vendor/transformers-4.3.2.min.js';
import {DEPTH} from './depth-model.js';
import {normalizeField, blurField} from './depth-field.js';

env.allowLocalModels = false;
env.backends.onnx.wasm.wasmPaths = {wasm: new URL('../lyric-auto/vendor/ort-wasm-simd-threaded.wasm', import.meta.url).href};
env.backends.onnx.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;

let loaded = null;
async function load(host) {
  if (loaded) return loaded;
  if (host) env.remoteHost = host;
  const files = new Map();
  const progress_callback = x => {
    if (x.status !== 'progress' && x.status !== 'done') return;
    const f = files.get(x.file) || {loaded: 0, total: 0};
    if (x.total) f.total = x.total;
    f.loaded = x.status === 'done' ? f.total : x.loaded ?? f.loaded;
    files.set(x.file, f);
    let l = 0, t = 0;
    for (const v of files.values()) { l += v.loaded; t += v.total; }
    postMessage({type: 'load', loaded: l, total: t});
  };
  const [processor, model] = await Promise.all([
    AutoProcessor.from_pretrained(DEPTH.model, {progress_callback}),
    AutoModelForDepthEstimation.from_pretrained(DEPTH.model, {dtype: DEPTH.dtype, device: 'wasm', progress_callback}),
  ]);
  return (loaded = {processor, model});
}

self.onmessage = async ({data}) => {
  if (data?.type !== 'run') return;
  try {
    const {processor, model} = await load(data.host);
    const t0 = performance.now();
    postMessage({type: 'run'});
    const image = new RawImage(new Uint8ClampedArray(data.pixels), data.width, data.height, 4).rgb();
    const inputs = await processor(image);
    const out = await model(inputs);
    const d = out.predicted_depth, w = d.dims.at(-1), h = d.dims.at(-2);
    // 大きいほど手前。0〜1 に直して、髪の毛のような細い線がまわりの深さに溶けるくらい、ほんの少しぼかす
    const depth = blurField(normalizeField(d.data), w, h, .8);
    postMessage({type: 'done', width: w, height: h, depth, ms: Math.round(performance.now() - t0)}, [depth.buffer]);
  } catch (e) {
    postMessage({type: 'error', message: String(e?.message || e)});
  }
};
