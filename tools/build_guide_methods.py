# Builds app/guide/methods.html from the list below (the clips in app/guide/methods/ come from the sequence page: 2 pictures, shape 'none', flow 'reveal').
# Run:  python3 tools/build_guide_methods.py
import html, os
OUT = os.path.join(os.path.dirname(__file__), '..', 'app', 'guide', 'methods.html')
CATS = [('paper', '紙・タイルの崩れ'), ('particle', '粒（パーティクル）'), ('motion', 'モーション')]
M = [  # key, label, symbol, en, category, description
 ('crumple','くしゃくしゃ','▱','CRUMPLE','paper','紙を丸めるように、くしゃっと波打ちながら崩れます。いちばん基本の動き。'),
 ('scatter','ばらばら','⠿','SCATTER','paper','絵がタイルに分かれて、それぞれ回りながら散らばります。'),
 ('twist','ねじれ','〰','TWIST','paper','絵全体がひねられたようにねじれて、崩れます。'),
 ('wave','波打ち','≋','WAVE','paper','縦にも横にも、ゆらゆらと波打ちます。'),
 ('shatter','砕ける','✦','SHATTER','paper','ガラスが割れるように、破片になって飛び散ります。'),
 ('peel','めくれ','◸','PEEL','paper','紙をめくるように、端からはがれていきます。'),
 ('melt','とける','⌇','MELT','paper','縦の帯に分かれて、とろけるように落ちていきます。'),
 ('fold','折りたたみ','⋀','FOLD','paper','紙を折りたたむように、畳まれて消えます。'),
 ('shred','シュレッダー','⦀','SHRED','paper','シュレッダーにかけたように、細い短冊になって落ちます。'),
 ('mosaic','モザイク','▦','MOSAIC','paper','四角いモザイクに分かれて、次の絵と入れ替わります。'),
 ('vortex','渦に吸い込み','◌','VORTEX','paper','渦を巻いて、中心に吸い込まれていきます。'),
 ('confetti','星とハート','☆♡','CONFETTI','paper','星やハートの紙吹雪になって舞い上がります。'),
 ('dust','塵になる','⁘','DUST','particle','細かい粒の塵になって、さらさらと消えます。'),
 ('sparkle','きらめき','✧','SPARKLE','particle','きらきら光る粒になって、ほどけます。'),
 ('burst','爆発','✺','BURST','particle','中心から弾けるように、勢いよく飛び散ります。'),
 ('swarm','群れ','⟳','SWARM','particle','粒が群れのようにまとまって、うねりながら動きます。'),
 ('rain','雨','⫶','RAIN','particle','雨のように、粒が上から降り注ぎます。'),
 ('snow','雪','❄','SNOW','particle','雪のように、粒がふわふわと舞い落ちます。'),
 ('bubbles','泡','○','BUBBLES','particle','泡になって、ぷかぷか浮かび上がります。'),
 ('halftone','網点','⠶','HALFTONE','particle','印刷の網点のような細かいドットに分かれます。'),
 ('galaxy','銀河','✦','GALAXY','particle','銀河のように、粒が渦を巻いて広がります。'),
 ('tornado','竜巻','⌇','TORNADO','particle','竜巻のように、粒が巻き上がります。'),
 ('wind','風で飛ぶ','≈','WIND','particle','風に吹かれて、粒になって飛ばされていきます。'),
 ('petals','花びらが舞う','❀','PETALS','particle','花びらになって、ひらひら舞い上がります。'),
 ('ripple','波紋','◎','RIPPLE','motion','水の波紋のように、輪になってゆがみが広がります。'),
 ('blinds','ブラインド','☰','BLINDS','motion','ブラインドのように、細い帯がくるっと回って切り替わります。'),
 ('flip','タイル反転','◧','FLIP','motion','タイルがパタパタと裏返って、次の絵になります。'),
 ('glitch','グリッチ','▚','GLITCH','motion','デジタルノイズのように、ずれて乱れます。'),
 ('line','線で描かれる','✎','LINE DRAW','motion','線で描かれていくように、次の絵が現れます。'),
]
assert len(M) == 29
cat_label = dict(CATS)
cards = []
for key, label, sym, en, cat, desc in M:
    cards.append(f'''    <article class="method" data-cat="{cat}">
      <div class="shot" data-clip="./methods/{key}.mp4" role="button" tabindex="0" aria-label="{html.escape(label)}の動きを再生">
        <img src="./methods/{key}.jpg" alt="{html.escape(label)}の途中の絵" loading="lazy" width="400" height="224">
      </div>
      <div class="body">
        <h3><i aria-hidden="true">{sym}</i>{html.escape(label)}<small>{en}</small></h3>
        <p>{html.escape(desc)}</p>
        <span class="tag">{cat_label[cat]}</span>
      </div>
    </article>''')
chips = ''.join(f'<li><button class="chip" type="button" data-filter="{k}" aria-pressed="false">{html.escape(l)}<small>{sum(1 for m in M if m[4]==k)}</small></button></li>' for k, l in CATS)
page = f'''<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>UNFOLD メソッド集 — 29種類の崩れ方</title>
<meta name="description" content="UNFOLDの崩れ方（メソッド）29種類を、動く見本で紹介します。自作メソッドの作り方も。">
<link rel="stylesheet" href="./guide.css?v=2">
</head>
<body>
<header class="top"><div class="top-in">
  <a class="brand" href="../"><b>◈</b>UNFOLD</a>
  <nav aria-label="ページ">
    <a href="./">説明</a>
    <a href="./methods.html" aria-current="page">メソッド集</a>
    <a href="./samples.html">サンプル集</a>
    <a href="./motions.html">モーション集</a>
    <a href="./glb.html">GLB置き場</a>
  <a href="../workshop.html">メソッド工房</a></nav>
  <span class="spacer"></span>
  <a class="btn small" href="../">1枚モード</a>
  <a class="btn small lime" href="../sequence.html">シーケンス</a>
</div></header>

<main>
  <div class="eyebrow">METHODS</div><p class="note"><a class="btn lime" href="../workshop.html">＋ メソッド工房で作る・試す</a>　コード、参照画像、色パレットをひとつの画面で。</p>
  <h1 style="font-size:clamp(28px,4.4vw,42px);margin:8px 0 14px">メソッド集</h1>
  <p class="lede">絵が崩れる動き（メソッド）は、標準で <b>29種類</b>。どれも同じ2枚の絵（港の油絵 → ネオンの街）で動かした見本です。カードにマウスを載せる（スマホはタップ）と動きます。</p>
  <p class="note">使うときは、1枚モードの「ぐちゃぐちゃにする」、またはシーケンスの◆を選んだ「崩れ方」から選びます。立体になる前の、崩れていく部分の動きです。</p>

  <section style="margin-top:34px">
    <ul class="chips" aria-label="分類で絞り込む">
      <li><button class="chip" type="button" data-filter="all" aria-pressed="true">すべて<small>29</small></button></li>
      {chips}
    </ul>
    <div class="mgrid" id="mgrid">
{chr(10).join(cards)}
    </div>
  </section>

  <section id="custom">
    <h2><small>CUSTOM</small>自作メソッドを作る</h2>
    <div class="two">
      <div>
        <p>メソッド一覧の最後の「＋自作メソッド」で、自分の崩れ方を作れます。書くのは短い GLSL のコードだけ。<b>p</b>（絵の中の位置）と <b>amount</b>（崩れ具合：0 で元の絵、大きいほどよく崩れる）を受け取って、動かした位置を返します。</p>
        <ul class="list">
          <li>左にコード、右に<b>プレビュー</b>。書き方のチェックと試し描画つき</li>
          <li>サンプルから始められます。「AIに頼むひな形をコピー」で、チャットAIに作ってもらうこともできます</li>
          <li>危ない書き方は保存前に止まり、重すぎると自動で止まります</li>
          <li>作ったメソッドは <code>.unfoldmethod</code> ファイルにして人に渡せます（受け取った人は確認してから有効にします）</li>
        </ul>
      </div>
      <div>
        <p style="margin-bottom:6px;color:var(--muted);font-size:13px">例：渦に吸い込む（標準のサンプルより）</p>
<pre>// 中心に近いほど強く回して、中心へ縮める
vec3 userMethod(vec2 p, float amount) {{
  float r = length(p);
  vec2 q = rot(amount * 3.4 / (r + .35)) * p
         * (1. - amount * .6 * exp(-r * .5));
  return vec3(q, -amount * .9 * exp(-r * r * .7));
}}</pre>
        <a class="btn lime" href="../sequence.html">シーケンスで試す</a>
      </div>
    </div>
  </section>
</main>
<footer>
  <a href="../">1枚モード</a> ・ <a href="../sequence.html">シーケンス</a> ・ <a href="./">説明</a> ・ <a href="./samples.html">サンプル集</a> ・ <a href="./glb.html">GLB置き場</a>
  <p style="margin-top:10px">© 2026 UNFOLD</p>
</footer>
<script src="./preview-play.js?v=1" type="module"></script>
<script>
// filter chips
const chips = [...document.querySelectorAll('.chip')];
chips.forEach(c => c.addEventListener('click', () => {{
  chips.forEach(x => x.setAttribute('aria-pressed', String(x === c)));
  const f = c.dataset.filter;
  document.querySelectorAll('.method').forEach(m => {{ m.hidden = f !== 'all' && m.dataset.cat !== f; }});
}}));
</script>
</body>
</html>
'''
open(OUT, 'w', encoding='utf-8').write(page)
print('wrote', os.path.abspath(OUT), len(page))
