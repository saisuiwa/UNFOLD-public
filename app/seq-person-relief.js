// シーケンスの「人物の立体」（2026-11-18）: ◆の形の1つ。前の画像に入れた人物の切り抜きの形の中だけを浮き彫りにする（relief-shape.js の人物だけ）。
// 人物を抜いた絵（cleanPlate）はその場に残り、立体になった人物は次の画像の色に入れ替わって、平らに戻ると次の画像になる。
// 奥行きは、画像ごとに作った時だけ使う（作らなければ、ふくらみだけの丸い形）。ここは DOM なしで動く計算と、canvas との受け渡し。
import { reliefSwing, reliefTilt, PERSON } from './relief-shape.js?v=2';

export const PERSON_SHAPE = 'person';
export const PERSON_LABEL = '人物の立体（今の画像の人物）';

/** ふくらみの割合（0〜1）。奥行きが無い時は、ふくらみだけで形を作る（1） */
export function personPuff(tr, hasDepth) {
  if (!hasDepth) return 1;
  const n = Number(tr?.puff);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : PERSON.PUFF;
}

/**
 * シーケンスの立体の時間 w（sequence-core.js の warpTime。立体が出来上がっているのは .45〜.60）を、1枚モードの浮き彫りの時間（.45〜.75 で1周）に直す。
 * 立体の間に、左右へ1往復・上下へゆるく傾く（写真の立体は止まっていると奥行きが見えない）
 */
export const seqReliefTime = w => .45 + (w - .45) * 2;
export const personSwing = (w, amount = .6) => reliefSwing(seqReliefTime(w), amount);
export const personTilt = (w, amount = .5) => reliefTilt(seqReliefTime(w), amount);

/** 画像から、長い辺 long の {w, h, data}（0〜1）を読む。channel: 3 = 透明度（切り抜き）、0 = 赤（奥行きの絵） */
export function canvasField(source, channel = 3, long = 512, doc = globalThis.document) {
  const W = source.naturalWidth || source.width, H = source.naturalHeight || source.height;
  if (!(W > 0) || !(H > 0)) return null;
  const k = Math.min(1, long / Math.max(W, H)), w = Math.max(2, Math.round(W * k)), h = Math.max(2, Math.round(H * k));
  const c = doc.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true }); x.imageSmoothingQuality = 'high'; x.drawImage(source, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data, data = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) data[i] = d[i * 4 + channel] / 255;
  return { w, h, data };
}

/** 奥行き {w, h, data}（0 = 奥、1 = 手前）を、白黒の絵（canvas）にする。保存・切り抜きの位置合わせ（fitCanvas）に使う */
export function fieldCanvas(field, doc = globalThis.document) {
  const c = doc.createElement('canvas'); c.width = field.w; c.height = field.h;
  const x = c.getContext('2d'), img = x.createImageData(field.w, field.h);
  for (let i = 0; i < field.w * field.h; i++) { const v = Math.round(Math.min(1, Math.max(0, field.data[i])) * 255); img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
  x.putImageData(img, 0, 0);
  return c;
}

/** 奥行きが無い時の、平らな奥行き（ふくらみだけで形を作る） */
export const flatField = () => ({ w: 2, h: 2, data: new Float32Array(4).fill(.5) });

/** 中の割合（切り抜きが空でないか）。field.data の .5 より濃い所 */
export function fieldShare(field) {
  if (!field?.data?.length) return 0;
  let n = 0; for (let i = 0; i < field.data.length; i++) if (field.data[i] > .5) n++;
  return n / field.data.length;
}
