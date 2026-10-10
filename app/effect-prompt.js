// The text to copy for an AI when the workshop's "エフェクト" shelf is open: the normal text-motion request plus what an effect needs.
import {codeMotionPrompt} from './code-motion-presets.js';
const GUIDE=`【エフェクトとして作る場合】文字そのものの動きではなく、文字の後ろや周りに重ねる装飾（シェーダー、キーキャップの枠、リングなど）を作ってください。文字はcreateTextで一緒に出し、登場と退場のあいだ装飾も同じ時間で出入りさせます。
- 画面いっぱいの板（new THREE.PlaneGeometry(width,height)）にTHREE.ShaderMaterialを貼り、scene.addする（z=-10、renderOrder=-1で文字の後ろに）。fragmentShaderには#define・uniform・main()・gl_FragColorを書いてよい。ShadertoyのmainImage形式も、main()から呼べばそのまま使える。
- 画面全体を塗らず、不透明にする範囲は画面の半分以下にし、画面の端に近づけない（楕円・帯・パネルなどでマスクし、模様の濃さを不透明度にする）。
- GLSLのループはfor (int i=0;i<定数;i++)の形で64回以内。whileは使わない。時刻はupdate(t)のtをuniformで渡す（Math.random・Date.nowは使わない）。
- 日本語は空白がなく、maxWidthだけでは折り返せません。createTextに overflowWrap:'break-word' と、長さがそろうよう計算した maxWidth を指定し、長い歌詞（20文字以上・2行）でも画面に収めてください。
- 色は api.accent（強調色）を使うと歌詞の配色に合います。`;
export function effectPrompt(){return codeMotionPrompt().replace('\n参考:',`\n${GUIDE}\n参考:`)}
