// Builds app/guide/samples.html (the samples page) from the samples in app/: the method / graphic samples of the editor and the text motions of the lyrics.
// The previews (app/guide/samples/<id>.jpg and .mp4) come from tools/make_sample_previews.mjs.
//   node tools/build_guide_samples.mjs           write the page
//   node tools/build_guide_samples.mjs --check   write nothing; exit 1 if the page on disk is not what the samples say (the daily check uses this)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { GROUPS, catalog, previewFiles, sizeOf } from './lib/samples-catalog.mjs';

const OUT = fileURLToPath(new URL('../app/guide/samples.html', import.meta.url));
const esc = text => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const SYMBOLS = { text: '文', codetext: '文', effect: '✦' };

const items = catalog().map((item, order) => ({ ...item, order })).sort((a, b) => b.added.localeCompare(a.added) || a.order - b.order);   // newest day first; within a day the groups keep their order
const latest = items.reduce((day, item) => (item.added > day ? item.added : day), '0000-00-00');
const FIRST_BATCH = '2026-10-04';                      // what was there when this page was made is never "new"
const isNew = item => item.added > FIRST_BATCH && (Date.parse(`${latest}T00:00:00Z`) - Date.parse(`${item.added}T00:00:00Z`)) / 864e5 < 3;   // within 3 days of the newest one
const groupLabel = Object.fromEntries(GROUPS);
const day = text => `${Number(text.slice(5, 7))}/${Number(text.slice(8))}`;

const card = item => {
  const files = previewFiles(item.id);
  const media = sizeOf(files.jpg) && sizeOf(files.mp4)
    ? `<div class="shot" data-clip="./samples/${item.id}.mp4" role="button" tabindex="0" aria-label="${esc(item.name)}の動きを再生">
        <img src="./samples/${item.id}.jpg" alt="${esc(item.name)}の途中の絵" loading="lazy" width="480" height="270">
      </div>`
    : '<div class="shot none">プレビュー準備中</div>';
  const code = item.source ? `<details><summary>コードを見る</summary><pre><code>${esc(item.source)}</code></pre><button class="btn small" type="button" data-copy>コードをコピー</button></details>` : '';
  const way = { image: 'メソッド工房の「画像・立体・物理」のサンプルから選びます。', codetext: 'メソッド工房の「文字モーション」のサンプルから選びます。', effect: 'メソッド工房の「エフェクト」のサンプルから選びます（文字の後ろや周りに重なる装飾です）。', text: `歌詞の行の「動き」で「${esc(item.name)}」を選びます。` }[item.group];
  const how = (way ? `<p class="how">${way}</p>` : '') + code;
  return `    <article class="method" data-cat="${item.group}">
      ${media}
      <div class="body">
        <h3><i aria-hidden="true">${esc(item.symbol || SYMBOLS[item.group] || '◆')}</i>${esc(item.name)}${isNew(item) ? '<span class="new">NEW</span>' : ''}<small>${esc(item.key.toUpperCase())}</small></h3>
        <p>${esc(item.desc)}</p>
        ${how}
        <span class="tag">${groupLabel[item.group]}</span><span class="when">${day(item.added)} 追加</span>
      </div>
    </article>`;
};

const chips = GROUPS.map(([key, label]) => `<li><button class="chip" type="button" data-filter="${key}" aria-pressed="false">${esc(label)}<small>${items.filter(i => i.group === key).length}</small></button></li>`).join('');
const total = items.length;

const page = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>UNFOLD サンプル集 — 自作メソッドと文字の動き</title>
<meta name="description" content="UNFOLDの自作メソッド（GLSL・JavaScriptの画像メソッド）と、歌詞の文字の動き（コードモーション・かんたん設定）のサンプル${total}個を、動く見本で紹介します。毎日増えます。">
<link rel="stylesheet" href="./guide.css?v=2">
</head>
<body>
<header class="top"><div class="top-in">
  <a class="brand" href="../"><b>◈</b>UNFOLD</a>
  <nav aria-label="ページ">
    <a href="./">説明</a>
    <a href="./methods.html">メソッド集</a>
    <a href="./samples.html" aria-current="page">サンプル集</a>
    <a href="./motions.html">モーション集</a>
    <a href="./glb.html">GLB置き場</a>
  <a href="../lyric-sync/index.html">歌詞タイミング</a>
  <a href="../workshop.html">メソッド工房</a></nav>
  <span class="spacer"></span>
  <a class="btn small" href="../">1枚モード</a>
  <a class="btn small lime" href="../sequence.html">シーケンス</a>
</div></header>

<main>
  <div class="eyebrow">SAMPLES</div>
  <h1 style="font-size:clamp(28px,4.4vw,42px);margin:8px 0 14px">サンプル集</h1>
  <p class="lede">自作メソッド（GLSL・JavaScriptの画像メソッド）と、歌詞の文字の動き（コードモーション・かんたん設定）のサンプルです。毎日少しずつ増えます（いまは <b>${total}個</b>、最後に増えたのは ${day(latest)}）。カードにマウスを載せる（スマホはタップ）と動きます。</p>
  <p class="note"><b>崩れ方・グラフィック（GLSL）</b>：「1枚モード」の「ぐちゃぐちゃにする」か、シーケンスの崩れ方の最後にある「＋自作メソッド」を開き、「GLSLで作る」を選んで、「プリセット…」から選ぶとコードが入ります。<br><b>画像・立体・物理（JavaScript）</b>と<b>文字モーション（コード）</b>：<a href="../workshop.html">メソッド工房</a>のサンプルブロックから選びます。コードを書き換えて、自分のメソッドとして追加できます。<br><b>文字の動き（かんたん設定）</b>：シーケンスの「05 歌詞・曲」で歌詞の行を開き、「動き」から選びます。</p>

  <section style="margin-top:34px">
    <ul class="chips" aria-label="分類で絞り込む">
      <li><button class="chip" type="button" data-filter="all" aria-pressed="true">すべて<small>${total}</small></button></li>
      ${chips}
    </ul>
    <div class="mgrid" id="mgrid">
${items.map(card).join('\n')}
    </div>
  </section>
</main>
<footer>
  <a href="../">1枚モード</a> ・ <a href="../sequence.html">シーケンス</a> ・ <a href="./">説明</a> ・ <a href="./methods.html">メソッド集</a> ・ <a href="./glb.html">GLB置き場</a>
  <p style="margin-top:10px">© 2026 UNFOLD</p>
</footer>
<script src="./preview-play.js?v=1" type="module"></script>
<script>
// filter chips
const chips = [...document.querySelectorAll('.chip')];
chips.forEach(c => c.addEventListener('click', () => {
  chips.forEach(x => x.setAttribute('aria-pressed', String(x === c)));
  const f = c.dataset.filter;
  document.querySelectorAll('.method').forEach(m => { m.hidden = f !== 'all' && m.dataset.cat !== f; });
}));
// copy the code of a card
document.addEventListener('click', async e => {
  const button = e.target.closest('[data-copy]'); if (!button) return;
  const text = button.parentElement.querySelector('pre').textContent;
  try { await navigator.clipboard.writeText(text); button.textContent = 'コピーしました'; } catch { button.textContent = 'コピーできませんでした（コードを選んでコピーしてください）'; }
  setTimeout(() => { button.textContent = 'コードをコピー'; }, 2200);
});
</script>
</body>
</html>
`;

if (process.argv.includes('--check')) {
  const same = existsSync(OUT) && readFileSync(OUT, 'utf8') === page;
  console.log(same ? 'samples.html is up to date' : 'samples.html is out of date: run  node tools/build_guide_samples.mjs');
  process.exit(same ? 0 : 1);
}
writeFileSync(OUT, page);
console.log(`wrote ${OUT} (${total} samples, ${page.length} bytes)`);
