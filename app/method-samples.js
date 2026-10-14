// Starting points for the editor: ready-made methods, the code a new method starts with, and the text to give an AI chat.
import { LIMITS } from './method-guard.js';

export const NEW_METHOD_SOURCE = `// p: 画像の中の位置、amount: 崩れ具合（0 で元の絵、大きいほどよく崩れる）
// 戻り値: vec3(x, y, 奥行き)
vec3 userMethod(vec2 p, float amount) {
  vec2 q = p;
  q.y += sin(p.x * 4. + uTime * 2.) * .3 * amount;   // 波打つ
  return vec3(q, 0.);
}`;

// How the samples are grouped (the preset select in the editor, the samples page). Every sample has one of these as its `category`.
export const SAMPLE_GROUPS = [['method', '崩れ方'], ['graphic', 'グラフィックモーション']];

// key: lower-case letters, digits and "-". name: shown in the select (up to 12 characters). symbol: one character for the tile.
// desc: one line for the samples page. added: the day it was added (YYYY-MM-DD, Japan time); the samples page shows the newest first.
// poster (optional): the amount (0.05 to 0.8) at which the still picture of the samples page is taken (0.45 if left out; pick the moment the method is easiest to read).
// source: the userMethod code; its first line is a comment that says what it does.
export const SAMPLES = [
  { key: 'petals', name: '花びらが舞う', symbol: '花', category: 'method', desc: '粒が花びらになって、風に揺れながら手前へ舞い上がります。', added: '2026-10-04', source: `// 粒が花びらになり、風に揺れながら手前へ舞う
vec3 userMethod(vec2 p, float amount) {
  vec2 c = partC(), l = p - c;
  float delay = (c.x / uSize.x + .5) * .22 + ph(1.) * .16;
  float e = smoothstep(delay, delay + .4, amount);
  float spin = e * (4. + ph(2.) * 6. + uTime * (1. + ph(3.) * 2.));
  vec2 leaf = rot(spin) * (l * mix(vec2(1.), vec2(2.4, 3.2), e));
  leaf.x *= mix(1., cos(spin * 1.7 + ph(4.) * 6.2832), e);
  vec2 q = c + leaf + vec2(e * (1. + ph(5.) * 1.8),
    -e * e * (.4 + ph(6.)) + sin(e * 6. + ph(7.) * 6.2832 + uTime * 1.5) * .25 * e);
  gKind = 8.; gLocal = 1.;
  return vec3(q, (ph(8.) - .5) * 1.4 * e + sin(spin) * .2 * e);
}` },
  { key: 'depth-pop', name: '立体ポップ', symbol: '立', category: 'graphic', desc: 'タイルが傾きながら手前に飛び出して、奥行きが生まれます。', added: '2026-10-04', source: `// タイルが手前に飛び出す。傾きと拡縮で正投影でも奥行きが見える
vec3 userMethod(vec2 p, float amount) {
  vec2 c = (cell - .5) * uSize;
  float n = hash(cell);
  float e = smoothstep(n * .18, .65 + n * .15, amount);
  vec2 l = rot((n - .5) * e * 1.2) * (p - c) * (1. - .3 * e);
  float tilt = (hash(cell + 3.) - .5) * 2.3 * e;
  vec2 q = c * (1. + .18 * e) + vec2(l.x, l.y * cos(tilt));
  q += vec2((n - .5) * .18, (hash(cell + 7.) - .5) * .25) * e;
  return vec3(q, l.y * sin(tilt) + (.25 + n * n * 1.7) * e);
}` },
  { key: 'vortex', name: '渦に吸い込む', symbol: '渦', category: 'method', desc: '中心に近いほど強く回りながら、渦に吸い込まれます。', added: '2026-10-04', source: `// 中心に近いほど強く回して、中心へ縮める
vec3 userMethod(vec2 p, float amount) {
  float r = length(p);
  vec2 q = rot(amount * 3.4 / (r + .35)) * p * (1. - amount * .6 * exp(-r * .5));
  return vec3(q, -amount * .9 * exp(-r * r * .7));
}` },
  { key: 'wave', name: '波打つ', symbol: '波', category: 'method', desc: '縦にも横にも、ゆらゆらと波打ちます。', added: '2026-10-04', source: `// 縦と横にゆらゆら揺らす
vec3 userMethod(vec2 p, float amount) {
  vec2 q = p;
  q.x += sin(p.y * 6. + uSeed) * amount * .6;
  q.y += sin(p.x * 5. + uSeed) * amount * .48;
  return vec3(q, 0.);
}` },
  { key: 'scatter', name: 'ばらばらに飛ぶ', symbol: 'ば', category: 'method', desc: 'タイルごとに回りながら、ばらばらに散らばります。', added: '2026-10-04', source: `// タイルごとにランダムに回って散らばる（cell はタイルの位置）
vec3 userMethod(vec2 p, float amount) {
  float n = hash(cell);
  vec2 center = (cell - .5) * uSize;
  vec2 q = center + rot((n - .5) * 6.28 * amount) * (p - center) * (1. - amount * .2);
  q += vec2(n - .5, hash(cell + 5.) - .5) * 2.0 * amount;
  return vec3(q, 0.);
}` },
  { key: 'sparkle', name: 'きらめく粒', symbol: '粒', category: 'method', desc: '画像が小さな粒に分かれて、ちかちか光ります。', added: '2026-10-04', source: `// 画像が小さな粒に分かれて、ちかちか光る（partC() は粒の中心）
vec3 userMethod(vec2 p, float amount) {
  vec2 c = partC();
  vec2 l = p - c;
  vec2 q = c + l * (1. + amount * .6) + vec2(ph(1.) - .5, ph(2.) - .5) * .25 * amount;
  float z = (ph(3.) - .5) * .6 * amount;
  gKind = 4.;                       // 粒の見た目: 4 = きらめき
  gGlow = amount * (.35 + .65 * sin(uTime * (3. + ph(4.) * 5.) + ph(5.) * 6.2832)) * .9;
  gLocal = 1.;                      // 粒ごとの形を使う
  return vec3(q, z);
}` },
  { key: 'sand-fall', name: '砂になって落ちる', symbol: '砂', category: 'method', desc: '絵が細かい砂粒になって、上のほうから順にさらさらと落ちていきます。', added: '2026-10-07', poster: .28, source: `// 粒が砂になって、上の粒から順に、だんだん速く落ちていく
vec3 userMethod(vec2 p, float amount) {
  vec2 c = partC(), l = p - c;
  float top = c.y / uSize.y + .5;                          // 0 = 下、1 = 上
  float delay = (1. - top) * .3 + ph(1.) * .12;            // 上の粒ほど早く落ち始める
  float e = smoothstep(delay, delay + .3, amount);
  vec2 q = c + l * (1. - .3 * e);                          // 粒が少し小さな砂になる
  q.x += sin(e * 7. + ph(2.) * 6.2832 + uTime * 1.2) * .06 * e + (ph(3.) - .5) * .25 * e;
  q.y -= e * e * (1.2 + ph(4.) * 1.8);                     // 重さで、だんだん速く
  gKind = 2.;                                              // 粒の見た目: 2 = 丸い点
  gAlpha = 1. - .2 * e;
  gLocal = 1.;
  return vec3(q, (ph(5.) - .5) * .5 * e);
}` },
  { key: 'stripe-slide', name: 'ストライプスライド', symbol: '縞', category: 'graphic', desc: '横の帯が一本おきに左右へ、時間差でスライドして流れていきます。', added: '2026-10-07', source: `// 絵を8本の横帯に分けて、一本おきに左右へ、ずらしながら滑らせる
vec3 userMethod(vec2 p, float amount) {
  float row = floor(cell.y * 8.);                          // タイルの位置で帯を決める（帯のなかで形が崩れない）
  float side = mod(row, 2.) * 2. - 1.;                     // 帯ごとに 右(+1) と 左(-1)
  float delay = hash(vec2(row, 3.)) * .1;                  // 帯ごとに少しだけ時間差
  float e = smoothstep(delay, delay + .7, amount);
  return vec3(p.x + side * e * uSize.x, p.y, 0.);
}` },
  { key: 'diagonal-sweep', name: '斜めに掃き飛ばす', symbol: '斜', category: 'method', desc: '左上の粒から順に、くるくる回りながら左上の奥へ吹き飛ばされます。', added: '2026-10-08', poster: .3, source: `// 左上の粒から順に、回りながら左上へ吹き飛ばされる
vec3 userMethod(vec2 p, float amount) {
  vec2 c = partC(), l = p - c;
  float diag = ((c.x / uSize.x + .5) + (.5 - c.y / uSize.y)) * .5;   // 0 = 左上、1 = 右下
  float delay = diag * .35 + ph(1.) * .08;                           // 左上ほど早く動き出す
  float e = smoothstep(delay, delay + .3, amount);
  l = rot((ph(2.) - .5) * 9. * e) * l * (1. - .25 * e);              // 粒ごとにくるくる回る
  vec2 q = c + l + vec2(1., -.7) * e * e * (.9 + ph(3.) * 1.2) * uSize.x * .5;
  gKind = 2.;                                                        // 粒の見た目: 2 = 丸い点
  gAlpha = 1. - .25 * e;
  gLocal = 1.;
  return vec3(q, (ph(4.) - .5) * .4 * e);
}` },
  { key: 'curtain-open', name: 'カーテンが開く', symbol: '幕', category: 'method', desc: '縦の帯が真ん中から順に細くなりながら、左右へ開いていきます。', added: '2026-10-09', poster: .35, source: `// 絵を縦の10本の帯に分けて、真ん中の帯から順に細くしながら左右へ寄せる
vec3 userMethod(vec2 p, float amount) {
  float col = floor(cell.x * 10.);                          // タイルの位置で帯を決める
  float sc = ((col + .5) / 10. - .5) * uSize.x;             // 帯の真ん中の x
  float d = abs((col + .5) / 10. - .5) * 2.;                // 0 = 真ん中、1 = 端
  float e = smoothstep((1. - d) * .3, (1. - d) * .3 + .4, amount);
  float side = (col < 5.) ? -1. : 1.;
  float x = sc + (p.x - sc) * (1. - .8 * e) + side * e * uSize.x * (.25 + .35 * d);
  return vec3(x, p.y, e * .3);
}` },
  { key: 'radial-sweep', name: '針のように掃く', symbol: '針', category: 'method', desc: '時計の針が回るように、粒が時計回りに順にはじき飛ばされていきます。', added: '2026-10-10', poster: .3, source: `// 時計の針が一周するあいだに、針に触れた粒から外へはじき飛ばされる
vec3 userMethod(vec2 p, float amount) {
  vec2 c = partC(), l = p - c;
  float turn = atan(c.x, c.y) / 6.2832 + .5;               // 0〜1 = 真上から時計回りに一周
  float delay = turn * .4 + ph(1.) * .06;
  float e = smoothstep(delay, delay + .25, amount);
  vec2 away = normalize(c + vec2(.0001)) * e * e * (.6 + ph(2.) * .8) * uSize.y;   // 中心から外へ
  l = rot((ph(3.) - .5) * 8. * e) * l * (1. - .3 * e);
  gKind = 2.;                                              // 粒の見た目: 2 = 丸い点
  gAlpha = 1. - .3 * e;
  gLocal = 1.;
  return vec3(c + l + away, (ph(4.) - .5) * .3 * e);
}` },
  { key: 'scribble-scatter', name: '落書きになって散る', symbol: '落', category: 'method', desc: '絵が線画の落書きになって、揺れながらばらばらに散っていきます。', added: '2026-10-12', poster: 0.45, source: `// 絵が線画の落書きになって、揺れながらばらばらに散っていく
vec3 userMethod(vec2 p, float amount) {
  vec2 c = partC(), l = p - c;
  float e = smoothstep(ph(1.) * .2, .45 + ph(1.) * .3, amount);
  float a = ph(2.) * 6.2832 + uTime * (3. + ph(3.) * 4.);
  vec2 scrawl = vec2(cos(a), sin(a * 1.37)) * (.05 + .14 * ph(4.)) * e;
  vec2 drift = (vec2(ph(5.), ph(6.)) - .5) * 1.6 * e;
  vec2 q = c + rot((ph(7.) - .5) * 2.4 * e) * l * (1. + e * 1.2) + scrawl + drift;
  gKind = 9.;
  return vec3(q, (ph(8.) - .5) * .5 * e);
}` },
  { key: 'line-tangle', name: '線がぐるぐる絡む', symbol: '絡', category: 'method', desc: '線画になった粒が、渦を巻きながら中心へ絡まっていきます。', added: '2026-10-12', poster: 0.4, source: `// 線画になった粒が、渦を巻きながら中心へ絡まっていく
vec3 userMethod(vec2 p, float amount) {
  vec2 c = partC(), l = p - c;
  float r = length(c) / 3.;
  float e = smoothstep(r * .15, .5 + r * .3, amount);
  float turn = e * (3. + 2.5 * sin(r * 7. + uTime * .5)) * (1.2 - r);
  vec2 q = rot(turn) * c * (1. - .5 * e) + rot(turn * 1.5) * l * (1. + e * 1.6);
  q += vec2(sin(c.y * 6. + uTime * 2.), cos(c.x * 6. + uTime * 2.3)) * .05 * e;
  gKind = 9.;
  return vec3(q, sin(turn) * .3 * e);
}` },
  { key: 'pen-shake', name: 'ペンで殴り描き', symbol: '殴', category: 'method', desc: '絵が線画になり、ペンで殴り描きするように細かく震えます。', added: '2026-10-12', poster: 0.4, source: `// 絵が線画になり、ペンで殴り描きするように細かく震える
vec3 userMethod(vec2 p, float amount) {
  vec2 c = partC(), l = p - c;
  float e = smoothstep(0., .4, amount);
  vec2 jit = vec2(sin(c.y * 11. + uTime * 17.), cos(c.x * 11. + uTime * 13.)) * .035 * e
           + vec2(sin(uTime * 29. + c.x * 5.), cos(uTime * 31. + c.y * 5.)) * .02 * e;
  vec2 q = c + l * (1. + .9 * e) + jit;
  gKind = 9.;
  return vec3(q, 0.);
}` },
  { key: 'line-fall', name: '線画が崩れ落ちる', symbol: '崩', category: 'method', desc: '線画になった絵が、上から順に切れ落ちるように崩れていきます。', added: '2026-10-12', poster: 0.38, source: `// 線画になった絵が、上から順に切れ落ちるように崩れていく
vec3 userMethod(vec2 p, float amount) {
  vec2 c = partC(), l = p - c;
  float top = clamp(.5 - c.y / uSize.y, 0., 1.);
  float e = smoothstep(top * .35 + ph(1.) * .12, top * .35 + .38 + ph(1.) * .12, amount);
  float fall = e * e * (1.2 + ph(2.) * 1.8);
  vec2 q = c + rot((ph(3.) - .5) * 3. * e) * l + vec2((ph(4.) - .5) * .5 * e, -fall);
  gKind = 9.;
  return vec3(q, (ph(5.) - .5) * .4 * e);
}` },
  { key: 'thread-unravel', name: 'ほどけて糸になる', symbol: '糸', category: 'method', desc: '絵がほどけて、細い糸のように長く伸びて流れていきます。', added: '2026-10-12', poster: 0.4, source: `// 絵がほどけて、細い糸のように長く伸びて流れていく
vec3 userMethod(vec2 p, float amount) {
  vec2 c = partC(), l = p - c;
  float e = smoothstep(ph(1.) * .25, .5 + ph(1.) * .25, amount);
  float ang = (ph(2.) - .5) * .9 + sin(c.y * 2. + uTime) * .2;
  vec2 along = vec2(cos(ang), sin(ang)), across = vec2(-along.y, along.x);
  vec2 stretched = along * dot(l, along) * (1. + e * 5.) + across * dot(l, across) * (1. - .5 * e);
  vec2 q = c + stretched + along * e * (.4 + ph(3.) * 1.2) + vec2(0., sin(uTime * 1.5 + c.x * 2.) * .1 * e);
  gKind = 9.;
  return vec3(q, 0.);
}` },
  { key: 'color-bleed', name: '色が滲んで広がる', symbol: '滲', category: 'method', desc: '色が水に滲むように粒がぼやけて広がり、まわりと混ざります。', added: '2026-10-12', poster: 0.5, source: `// 色が水に滲むように、粒がぼやけて広がり、まわりの色と混ざっていく
vec3 userMethod(vec2 p, float amount) {
  vec2 c = partC(), l = p - c;
  float e = smoothstep(ph(1.) * .2, .5 + ph(1.) * .25, amount);
  vec2 flow = vec2(sin(c.y * 1.8 + uTime * .6), cos(c.x * 1.4 + uTime * .5)) * .15 * e;
  vec2 q = c + l * (1. + e * 3.4) + flow;
  gKind = 2.; gLocal = 1.;
  gAlpha = mix(1., .5, e);
  return vec3(q, -e * .15 * ph(2.));
}` },
  { key: 'paint-drip', name: '絵の具が垂れる', symbol: '垂', category: 'method', desc: '絵の具が溶けて、色の筋になって下へ垂れていきます。', added: '2026-10-12', poster: 0.5, source: `// 絵の具が溶けて、色の筋になって下へ垂れていく
vec3 userMethod(vec2 p, float amount) {
  vec2 c = partC(), l = p - c;
  float e = smoothstep(ph(1.) * .3, .55 + ph(1.) * .25, amount);
  float len = .3 + ph(2.) * 1.6;
  vec2 q = c + vec2(l.x * (1. - .35 * e) + sin(uTime * 1.2 + ph(3.) * 6.) * .03 * e, l.y * (1. + e * 6.) - e * len);
  gKind = 2.; gLocal = 1.;
  gAlpha = mix(1., .7, e);
  return vec3(q, 0.);
}` },
  { key: 'bleed-out', name: '中心から滲み出す', symbol: '溢', category: 'method', desc: '色が中心から外へ滲み出して、やわらかく広がっていきます。', added: '2026-10-12', poster: 0.5, source: `// 色が中心から外へ滲み出して、やわらかく広がっていく
vec3 userMethod(vec2 p, float amount) {
  vec2 c = partC(), l = p - c;
  float r = length(c);
  float e = smoothstep(r * .12, .45 + r * .12 + ph(1.) * .15, amount);
  vec2 dir = normalize(c + vec2(.001));
  vec2 q = c + dir * e * (.5 + ph(2.) * .9) + l * (1. + e * 2.8);
  gKind = 2.; gLocal = 1.;
  gAlpha = mix(1., .55, e);
  return vec3(q, 0.);
}` },
  { key: 'checker-shift', name: '市松が上下にずれる', symbol: '市', category: 'method', desc: '市松模様のマスが縮みながら、交互に上と下へずれて崩れていきます。', added: '2026-10-14', poster: .22, source: `// 絵を12×12のマスに分け、市松模様の片方は上へ、もう片方は下へ、縮みながらずらす
vec3 userMethod(vec2 p, float amount) {
  vec2 c = partC();
  vec2 id = floor((c / uSize + .5) * 12.);                    // マスの番号
  float odd = mod(id.x + id.y, 2.);                           // 市松模様の 0 / 1
  vec2 mid = ((id + .5) / 12. - .5) * uSize;                  // マスの真ん中
  float delay = hash(id) * .25;
  float e = smoothstep(delay, delay + .3, amount);
  vec2 q = mid + (p - mid) * (1. - .55 * e);                  // マスごとに縮む
  q.y += (odd * 2. - 1.) * e * uSize.y * .45;                 // 片方は上、もう片方は下
  gKind = 2.;                                                 // 粒の見た目: 2 = 丸い点
  gAlpha = 1. - .25 * e;
  gLocal = 1.;
  return vec3(q, 0.);
}` },
];

// Text to paste into an AI chat: it explains what to write, and the rules the editor checks, so what comes back is likely to pass.
export const aiTemplate = () => `あなたは UNFOLD（画像が崩れて立体になるツール）の「崩れ方」を GLSL で書くアシスタントです。
次のルールを守って、userMethod 関数を1つだけ書いてください。

【関数の形】
vec3 userMethod(vec2 p, float amount) { ... }
- p: 画像の中の位置（16:9 の画像なら、横はおよそ -2.6〜2.6、縦はおよそ -1.5〜1.5）
- amount: 崩れ具合。0 のとき元の絵、大きいほどよく崩れる（おおよそ 0〜0.8）
- 戻り値: vec3(x, y, 奥行き)。p をそのまま返せば動きません。

【使える道具】
- hash(vec2): 0〜1 の乱数（同じ入力なら同じ値）
- rot(float 角度): 回転行列（mat2）。rot(a) * p のように使う
- cell: 画像を 16×16 に分けたタイルの位置（0〜1）。hash(cell) でタイルごとの乱数が作れる
- partC(): 粒（画像をさらに細かく分けた小さなかけら）の中心。p - partC() が粒の中での位置
- ph(float k): 粒ごとの乱数（k を変えると別の乱数）
- uSize（画像の大きさ）、uTime（秒）、uSeed（乱数の種）、uStrength（崩れの強さ）
- 粒の見た目: gKind に 1〜9 を入れると粒の見た目が変わる（1=星とハート 2=丸い点 3=泡 4=きらめき 5=網点 6=雨の筋 7=RGBずれ 8=花びら 9=線画（絵の輪郭だけが残る））。gAlpha（透明度 0〜1）、gGlow（光 0〜2）、gLocal = 1. で粒ごとの形を使う。

【守ること】
- ${LIMITS.maxChars} 文字以内。
- ループは userMethod の中だけで、for (int i = 0; i < 回数; i++) { ... } の形（回数は数字で1つあたり ${LIMITS.maxLoop} 回まで、入れ子も含めた合計で ${LIMITS.loopBudget} 回まで）。ループの中で i を書き換えない。
- while、do、goto、discard、main は使えない。# で始まる行（#define など）、uniform / attribute / varying / in / out の宣言、gl_ で始まる名前も使えない。
- 補助の関数を作ってもよい（ループは入れない）。名前は、上の道具（hash、rot など）と別にする。

【作りたい動き】
（ここに、作りたい崩れ方を書いてください。例: 「雷みたいにギザギザに割れる」）

【出力】
コードブロック1つだけ（説明は不要）。`;
