// 写真の奥行きを作る（2026-11-11）: 絵1枚から、手前・奥の深さを、このブラウザの中で推定する（Depth Anything V2 Small。transformers.js）。
// 絵はどこにも送らない。読み込むのは、推定の仕組み（モデル）だけ。初めての時だけ Hugging Face から読み込んで、あとはブラウザの Cache Storage に残る。
// 聞き取り（lyric-auto）と同じ transformers.js の入れ物（lyric-auto/vendor）を使う。DOM なし。

/** 推定の仕組み: Depth Anything V2 Small の 8bit 版（onnx/model_quantized.onnx。27MB）。mb は初めての時に読み込む大きさ。
 *  size: モデルに見せる絵の長い辺（画素）。Depth Anything が決めた大きさで、これより大きくしても細かくならずに遅くなるだけ */
export const DEPTH = {
  model: 'onnx-community/depth-anything-v2-small', dtype: 'q8', mb: 27, size: 518,
  files: ['config.json', 'preprocessor_config.json', 'onnx/model_quantized.onnx'],
};

/** モデルに見せる大きさ（長い辺が size、縦横比はそのまま。14 の倍数にはモデルの前処理が合わせる） */
export function workingSize(width, height, size = DEPTH.size) {
  const long = Math.max(width, height);
  const k = Math.min(1, size / long);   // 小さい絵はのばさない
  return { width: Math.max(14, Math.round(width * k)), height: Math.max(14, Math.round(height * k)) };
}
