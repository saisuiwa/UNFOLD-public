// 写真の奥行きを作る（2026-11-11）の、画面の側。ボタンを押した時だけ、絵を奥行きを作る係（depth-worker.js）に渡す。
// 絵はこのブラウザの中で見るだけ。初めての時だけ、推定の仕組み（約 DEPTH.mb MB）を Hugging Face から読み込む（あとは Cache Storage に残る）。
import {DEPTH, workingSize} from './depth-model.js';

/** 推定の仕組みを、もう読み込んであるか（transformers.js の Cache Storage） */
export async function depthModelCached(host = 'https://huggingface.co/') {
  try {
    const c = await caches.open('transformers-cache');
    for (const f of DEPTH.files) if (!await c.match(`${host}${DEPTH.model}/resolve/main/${f}`)) return false;
    return true;
  } catch { return false; }
}

/** 絵（canvas）を、モデルに見せる大きさの RGBA にする */
export function depthPixels(canvas) {
  const {width, height} = workingSize(canvas.width, canvas.height);
  const c = document.createElement('canvas'); c.width = width; c.height = height;
  const x = c.getContext('2d', {willReadFrequently: true});
  x.imageSmoothingQuality = 'high'; x.drawImage(canvas, 0, 0, width, height);
  return {pixels: x.getImageData(0, 0, width, height).data, width, height};
}

/**
 * 絵（canvas）の奥行きマップを作る。返すのは {done: Promise<{w, h, data}>, cancel()}。
 *   on: {load(loaded, total), run()}（読み込みの進み、推定をはじめた）　host: モデルの置き場所（試験用。ふつうは Hugging Face）
 *   done は、止めた時は null になる。失敗したら理由つきで reject する
 */
export function makeDepth(canvas, {on = {}, host = null} = {}) {
  const {pixels, width, height} = depthPixels(canvas);
  const worker = new Worker(new URL('./depth-worker.js', import.meta.url), {type: 'module'});
  let finish;
  const done = new Promise((resolve, reject) => {
    finish = {resolve, reject};
    worker.onmessage = ({data}) => {
      if (data.type === 'load') on.load?.(data.loaded, data.total);
      else if (data.type === 'run') on.run?.();
      else if (data.type === 'error') { worker.terminate(); reject(new Error(data.message)); }
      else if (data.type === 'done') { worker.terminate(); resolve({w: data.width, h: data.height, data: data.depth, ms: data.ms}); }
    };
    worker.onerror = e => { worker.terminate(); reject(new Error(e.message || '奥行きを作る係を動かせませんでした。')); };
  });
  worker.postMessage({type: 'run', pixels, width, height, ...(host ? {host} : {})}, [pixels.buffer]);
  return {done, cancel() { worker.terminate(); finish.resolve(null); }};
}
