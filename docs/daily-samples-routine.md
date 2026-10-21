# 毎日のサンプル追加ルーティン（手順書）

毎日1回、次を追加して、検証が全部通ったときだけ `main` に入れます。

| 作者の呼び方 | 何か | どこに足すか | 1日の数 | プレビューのid |
|---|---|---|---|---|
| メソッド | 画像の崩れ方（GLSL）。工房のサンプル | `app/method-samples.js` の `SAMPLES`（`category: 'method'`） | 1（**2026-10-18 からは当面なし**。足すなら最大1） | `method-<key>` |
| グラフィックモーション | 画像・立体・物理（JavaScript）。工房のサンプル | `app/image-method-daily.js` の `DAILY_IMAGE_METHODS` | 1（**2026-10-18 からは当面なし**。足すなら最大1） | `image-<key>` |
| カット割りの部品 | STUDIO のおまかせ「✂ カット割り」が組み合わせる部品（登場・保持・退場・加工・背景・カメラ・画面効果・つなぎ・物の世界） | `app/studio/cuts/daily-parts.js` の `DAILY_CUT_PARTS` | **約8（6〜12）**（2026-10-18 から。ゲートが日付で切り替わる） | `cut-<軸>-<key>` |

**2026-10-17 の変更（テキストモーションの見直し）**：作者は、UNFOLD の文字の動きが、よくあるリリックビデオらしさにならない理由を見直していました。結論は「1本の中にレイアウト・登場・保持・退場・装飾が全部入った**丸ごとのスクリプト**（`code-motion-daily.js` のテキストモーション）ではなく、**小さな部品をカットごとに掛け合わせる**」です（記録：`docs/lyric-cuts-2026-10-17.md`）。その仕組み（STUDIO のカット割り）が 2026-10-17 に公開されたので、作者の指示「**当面はカット割の部品を大量に作成していきたい**」により、2026-10-18 から**テキストモーション（`DAILY_CODE_MOTIONS`）とエフェクト（`shelf:'effect'`）は足さず**、代わりにカット割りの部品を毎日たくさん足します。部品の数は掛け算で効く（部品が増えるほど、おまかせの組み合わせが一気に増える）ので、数を優先します。部品は 2026-10-18 の終わりで189個（作者と Claude が見本をたくさん読んで 103 個から増やした）＋毎日の分（よく作り込まれたリリックビデオ制作ツールでは、同じ分け方で約860ある）。

**部品作りの考え方は `docs/cut-parts-concept.md`、作る候補は `docs/cut-parts-wishlist.md`**（2026-10-18 から。下の ③ の前に必ず読む）。

以前の GLSL の `category: 'graphic'`、かんたん設定の文字の動き（`TEXT_MOTIONS`）、テキストモーションとエフェクト（`DAILY_CODE_MOTIONS`）は**そのまま残しますが、新しくは足しません**。

公開サイト（Cloudflare）は**自動では変わりません**。作者が手動でアップロードします（`docs/公開手順_Cloudflare.md`）。ルーティンがするのは「`main` に検証済みのソースを足す」ところまでです。

## 0. 許可の範囲

作者（2026-10-07）から：「毎日3つ（各1つ）。`main` にプッシュする前に確認して、壊れていなければプッシュしてよい。16:30頃（日本時間）。」
作者（2026-10-17）から：「当面はカット割の部品を大量に作成していきたい」。→ メソッド1・グラフィックモーション1・カット割りの部品 約8（6〜12）。さらに同日、「メソッド、グラフィックモーションも当面はなしでカット割り部品だけでいい」。→ **2026-10-18 からは、カット割りの部品 約8（6〜12）だけ**（メソッドとグラフィックモーションは当面作らない。ゲートも、部品6個以上があればよい形に直した。足すとしても、それぞれ最大1）。プッシュの許可（ゲートが全部 PASS なら `main` へ）はそのまま。

- `node tools/verify_daily.mjs --expect-new=<今日>` が **全部 PASS** したときだけ `main` にプッシュしてよい。
- 落ちたまま、またはゲートを緩めて通した状態では、`main` にプッシュしない（下の「失敗したとき」）。
- 許可されているのは、この手順にある追加と、そのための生成物（プレビュー、ページ、ログ、`?v=`）だけ。

## 1. 準備

```sh
git fetch origin main
git checkout -B daily-samples origin/main        # main の最新から始める
TZ=Asia/Tokyo date +%F                           # 今日の日付（日本時間）。以下 <今日>
node tools/verify_daily.mjs                      # 手を入れる前に全部PASSか確認（落ちるなら、その原因をまず報告して止まる）
```

いまあるサンプルの一覧（似たものを作らないため）：

```sh
node -e "import('./tools/lib/samples-catalog.mjs').then(m=>console.table(m.catalog().map(({id,name,desc,added})=>({id,name,desc,added}))))"
node -e "Promise.all([import('./app/image-method-presets.js'),import('./app/code-motion-presets.js')]).then(([a,b])=>{console.log(a.IMAGE_METHOD_PRESETS.map(p=>p.name));console.log(b.CODE_MOTION_PRESETS.map(p=>p.name))})"
```

2つ目はMacで作られたものも含む、工房に出る全部の名前です（名前の重複はテストが落とします）。

カット割りの部品の、軸ごとの数と名前（**少ない軸から**足す。同じ動きを作らない）：

```sh
node -e "Promise.all(['glyphs','parts','worlds'].map(f=>import('./app/studio/cuts/'+f+'.js'))).then(([g,p,w])=>{const t={...g.GLYPH_GROUPS,...p.GROUPS,world:w.WORLD};for(const [a,o] of Object.entries(t))console.log(a,Object.keys(o).length,Object.values(o).map(x=>x.name).join(' / '))})"
```**標準の37種類**（2026-10-12に8種類を足して29→37）の崩れ方は `tools/build_guide_methods.py` の先頭の表にあるので、GLSLでは同じ動きを避けてください。`docs/daily-samples-log.md` も読んで、過去の日と同じ発想を繰り返さないでください。

## 2. 作る

### ① メソッド（GLSL）

`app/method-samples.js` の `SAMPLES` の**末尾**に1つ足します（`category` はいつも `'method'`）。

```js
  { key: 'sand-fall', name: '砂になって落ちる', symbol: '砂', category: 'method', desc: '絵が細かい砂粒になって、上のほうから順にさらさらと落ちていきます。', added: '<今日>', poster: .28, source: `// 一行目に、何をするかを書く
vec3 userMethod(vec2 p, float amount) {
  ...
}` },
```

- `key`：小文字・数字・`-`、頭は英字。他と重複しない。`name`：2〜12文字。`symbol`：1文字。
- `desc`：10〜60文字で「。」で終わる、1文。`added`：今日の日付。`source`：1行目は `//` のコメント。
- `poster`（省略できる）：サンプル集の静止画を撮る崩れ具合（0.05〜0.8、省略時 0.45）。動きの特徴がいちばん分かる瞬間を選ぶ（例：上から順に崩れる動きは 0.28 くらいの、まだ絵が残っているとき）。
- 書き方のルールと使える道具（`hash` `rot` `partC()` `ph()` `cell` `uTime` `gKind` `gGlow` …、8000文字・ループ上限）は `app/method-samples.js` の `aiTemplate()` にまとまっています。既存のサンプルを手本にしてください。
- 検証は「何も映らない」「元の絵と変わらない」も**失敗**扱いです。`amount` が 0.45 くらいのとき、はっきり絵が変わっているものにしてください。重すぎる（標準の一番重いメソッドの4倍超）と失敗します。ループは少なく。
- 帯やタイルごとに動かすときは `p.y` ではなく `cell`（タイルの位置）で分ける。`p.y` だと境目の三角形が引き伸ばされます。

### ② グラフィックモーション（JavaScriptの画像メソッド）

`app/image-method-daily.js` の `DAILY_IMAGE_METHODS` の**末尾**に1つ足します（Macで作られた `image-method-presets.js` などは触りません）。この配列は `IMAGE_METHOD_PRESETS` の末尾につながって、工房の「画像・立体・物理」とメソッドのエディタのサンプルに出ます。

```js
 {key:'tile-vortex',name:'渦に巻かれるタイル',symbol:'渦',desc:'タイルが渦を巻いて中心へ寄り、また元の絵へ戻ります。',added:'<今日>',poster:1.8,
  code:{version:1,runtime:IMAGE_RUNTIME,params:{columns:14,gravity:4,bounce:.5,seed:7,returnMode:'reverse',label:'UNFOLD',font:'gothic'},source:`// 1行目に、何をするかを書く
const {createImageTiles,THREE,size}=api;
const tiles=createImageTiles();
const half=size.width*.5;
return {update(frame){
 const e=Math.min(1,frame.amount/.8);
 for(const piece of tiles){
  const x=piece.home.x,y=piece.home.y,r=Math.hypot(x,y)/half;
  const turn=e*(3.4/(r+.5)),c=Math.cos(turn),s=Math.sin(turn),pull=1-.5*e*(1-r*.35);
  piece.mesh.position.set((x*c-y*s)*pull,(x*s+y*c)*pull,0);
  piece.mesh.rotation.set(0,0,turn);
  piece.mesh.scale.setScalar(1-.3*e);
 }
}};`}}
```

- 項目：`key`（小文字・数字・`-`）／`name`（2〜20文字、工房に出る全サンプルで重複しない）／`symbol`（1文字）／`desc`（10〜60文字で「。」で終わる）／`added`／`poster`（省略できる。6秒のクリップの何秒目の絵を静止画にするか、0〜5.9、省略時 1.8）／`code`。
- `code.params` は決まった項目だけ：`columns`(2〜24)・`gravity`(0〜20)・`bounce`(0〜1)・`seed`(0〜999999)・`returnMode`(`'reverse'`か`'assemble'`)・`label`(100文字まで)・`font`(同梱の書体キー)。`previewShape` は**書かない**（`'none'` は質感エフェクト8種専用で、Macのテストが数えています）。
- 書き方は `docs/image-code-methods.md` の「コードAPI」が正です。要点：`api` を引数に持つ関数の**本体**を書く。使えるのは `THREE` `Text` `gsap` `RAPIER` `scene` `root` `size` `images` `createImagePlane` `createImageTiles({columns,rows})`（`{mesh,home,width,height,index}` の配列）`createText` `params` `random()` `physics.bind/floor/at` `returnTime` `assemble` `smooth`。返り値は `{timeline, physicsTime, update(frame), beforeStep, afterStep, dispose}` で、`timeline`・`update`・`physics.bind` のどれかが必要。
- `frame.amount`（0〜0.8、強さと時間の包絡）で効果を決めて、`amount` が戻ったら元の位置へ戻る作りにする。画像Aから画像Bへの切り替えは基盤がします（コードでは触らない）。
- **同じ時刻は同じ絵に**：`update` は `frame` から位置を直接決める（`+=` で積まない）。`Date.now` `Math.random`（乱数は作成時に `random()`）`setInterval` `requestAnimationFrame` `fetch` は使わない。GSAPは `paused:true`。物体・文字・材質は作成時に1回作って使い回す。単体テストがこれらの語を弾きます。
- 上限：物体1024個・文字メッシュ150個・コード32000文字。タイルは `columns` 12〜14が目安（重いと工房のプレビューが遅くなる）。
- ゲートの基準：実行でエラーが出ない／1.8秒の時点で元の絵と**2000画素以上**違う／クリップ中に5種類以上の違う絵／1フレーム5秒以内。

### ③ カット割りの部品（2026-10-18 から。テキストモーションの代わり）

`app/studio/cuts/daily-parts.js` の `DAILY_CUT_PARTS` の**末尾**に、その日の日付のコメント（`// ---- <今日>`）を付けて、**約8個（最低6・最大12）**足します。足した部品は、手で作った部品の表（`glyphs.js` の登場・保持・退場・加工、`parts.js` の背景・カメラ・画面効果・つなぎ、`worlds.js` の物の世界）の末尾に**自動でつながり**、STUDIO のおまかせ「✂ カット割り」が、ほかの部品と同じように雰囲気（`tags`）と出やすさ（`w`）で選びます。サンプル集の「カット割りの部品」の棚にも出ます。

**手で書くコードは `daily-parts.js` だけ**です（`kit.js` の道具は使うだけ。`glyphs.js` `parts.js` `worlds.js` `compose.js` `layer.js` `plan.js` などカット割りの本体は変えない）。手で書き足す文書は、ログと、`docs/cut-parts-wishlist.md` の「作った」の表（作った候補をそこへ移す）。このほか、下の手順のスクリプトが作る物（`app/guide/samples/` のプレビューの JPG・MP4 と `app/guide/samples.html`）は、作り直してコミットしてよい（ゲートが「ページが最新か」を見ます）。

#### 作るものの決め方（2026-10-18 から）
1. `docs/cut-parts-concept.md` を読む（軸・動きの型・見本の読み方・エンジンにある道具・組み合わせの事故）。
2. `docs/cut-parts-wishlist.md` から選ぶ。**★ を優先**し、⚙ は作らない（本体に仕組みが要る）。1つの候補は1つの部品とは限らない（向き・強さ違いを別の部品にしてよいが、動きが重なるものは作らない）。
3. 候補にない動きを思いついたら作ってよい。その時も、軸と動きの型で「既存のどれとも違う」と言えること。
4. 作ったら、候補の行を「作った」の表へ移す（日付・軸・キー・名前）。部品の `words` には、その候補の言い方を入れる（言葉辞典が「ある」に変わる）。

#### どの軸を、いくつ
- 2026-10-17 から**装飾（`deco`）の軸**ができた（作者の依頼。リリックビデオでは装飾の種類がとても多く、UNFOLD でいちばん足りない軸）。当面は毎日1〜3個を装飾にする（2026-10-18 で21個）。
- 1日に**4つ以上の軸**にまたがるように。上の「軸ごとの数」で**少ない軸から**埋める（目安：登場・退場・保持・つなぎ・背景・カメラを多めに、画面効果は1日1〜2個、加工は今ある見た目の組み合わせなので1日1個まで、物の世界は週に1個まで）。
- 既存の部品（手で作ったもの・過去の日の分）と**同じ動き・同じ名前は作らない**。名前が違っても、動きが同じなら作り直す。
- リリックビデオでよく使われる考え方（字ごと・語ごとの時間差、短いカット（0.5〜1.5秒）でも成り立つ、カットの頭で強く・終わりで静か）を参考に、**自分で考えて自分の式で書く**（他の作品のコードは写さない）。

#### 1つの部品の形
```js
 {axis:'enter',key:'centerOut',name:'真ん中から広がる',desc:'全部の字が行の真ん中に重なって現れ、元の位置へ広がります。',added:'<今日>',words:['広がる','真ん中から','中央から出る'],
  tags:['pop','graphic','impact','emotional'],w:1,fast:true,inDur:D=>clamp(D*.32,.15,.4),plan:r=>({k:.6+r()*.4}),
  glyph(g,i,n,p,E,P){const e=inOutCubic(p),mid=(E.bbox.x0+E.bbox.x1)/2,s=lerp(.6,1,outBack(p,1.4));return {dx:(mid-g.cx)*(1-e)*P.k,sx:s,sy:s,a:clamp(p*3)};}},
```
- `axis`：`enter` `hold` `exit` `treat` `bg` `cam` `fx` `trans` `world` のどれか。
- `key`：英字で始まる英数字（camelCase、例 `riseAway`）。**同じ軸の部品と重ならない**（重なると表につながらず、テストが落とす）。
- `name`：日本語2〜12文字（同じ軸に同じ名前がない）。**プレビューでは、この名前が、この部品で動く**（「真ん中から広がる」は、その言葉が真ん中から広がる）。
- `desc`：10〜60文字で「。」で終わる1文。`added`：今日。`tags`：合う雰囲気（`calm` `pop` `glitch` `graphic` `emotional` `impact` から1つ以上）。`w`：出やすさ 0.8〜1.4（ふつうは 1）。
- `words`（2026-10-22 から必ず付ける）：**言い方**を1〜4個（1つ12文字まで、同じ言い方を重ねない）。人がこの動きを頼む時のふつうの言い方（例：ブラインドが降りる部品なら `['ブラインド','降りる','シャッター']`）。非公開の部品ラボの言葉辞典が、この言い方で部品を引き、辞典の「まだない表現」と言い方が合えば「ある」に変わる。`docs/cut-parts-wishlist.md` の候補から作った時は、その候補の言い方を必ず入れる。ほかのアプリや作品の名前は入れない。
- `poster`（省略できる）：サンプル集の静止画を撮る時刻（行が始まって何秒後か、0.05〜3.0）。省略すると、部品が動いている真ん中（登場なら登場の半ば、退場なら退場の半ば、つなぎなら切り替わりの半ば）を自動で選ぶ。
- 道具は `kit.js` から import 済み：`clamp` `lerp` `fract` `smooth` `bell` `outCubic` `inCubic` `inOutCubic` `outExpo` `outBack` `bounceOut` `spring` `hash` `sign` `pickW` `local`（字ごとの時間差）`rgba` `mixHex` `luma` `contrast` `TAU` `DEG`。足りなければ、ファイルの先頭の import に足す。

#### 軸ごとの形（手で作った部品が手本：`glyphs.js` / `parts.js` / `worlds.js` の同じ軸を読む）
| 軸 | 形 | 決まり（テストとゲートが見る） |
|---|---|---|
| 登場 `enter` | `inDur(D,n,P)`→秒、`plan(r)`→P、`glyph(g,i,n,p,E,P)`→`{dx,dy,sx,sy,rot,a,blur,hide}` か `item(it,p,E,P)` | `p` は登場の間 0→1。**p=1 で字は元どおり**（ずれ・回転・ぼけ 0、大きさ・不透明度 1）。まだ出ない字は `{hide:true}`。登場の長さは `clamp(D*.3,.13,.4)` くらい（短いカットで長すぎない）。短いカット（0.7秒未満）でも成り立つなら `fast:true`、長いカットが要るなら `minDur`、字数が多いと崩れるなら `maxChars` |
| 退場 `exit` | `outDur(D,n,P)`、`plan`、`glyph` か `item` | `p` は退場の間 0→1。**p=0 で元どおり**、p=1 で見えない |
| 保持 `hold` | `plan`、`glyph(g,i,n,p,E,P)` | 読んでいる間の小さな動き：ずれは字の大きさの20%まで、回転6度まで、大きさ0.9〜1.1、ぼけ8%まで。**ずれ・回転・ぼけのどれかで必ず動く**（大きさだけの変化は「動いていない」と判定される）。`E.lt`（カットの中の時刻）から直接決める |
| 加工 `treat` | `style(P,c)`→`{stroke,fill,shadow,extrude,textColor,deco,blur,trail,fillFx,longShadow,echo,rim}` | 字の描き方の組み合わせ（`longShadow` `echo` `rim` の意味と手本は `docs/cut-parts-concept.md` の 3）。`deco` は `'marker'` `'underline'` `'box'` だけ。`fillFx` は字の塗りが時間で動く `{kind:'rainbow'|'shine'|'stripes',…}`（手本 `rainbowFill` `shineSweep` `stripeFill`。ほかの種類は本体の仕組みが要る）。`c.color` `c.accent` `c.bg` で色を決める（暗い背景でも見える色に） |
| 背景 `bg` | `plan`、`draw(ctx,e,P)` | `e.t`（曲の時刻）から描く。**半透明で**（不透明度0.5まで。下に絵がある時は絵が透けて見えること）。`e.W` `e.H` を使って横長・縦長どちらでも |
| カメラ `cam` | `plan`、`get(e,P)`→`{s,x,y,rot}` | 文字の層全体の変形。`e.p`（カットの進み 0→1）で。拡大は1.0〜1.1、ずれは画面の3%まで、回転5度まで。大きく動くものは `strong:true` |
| 画面効果 `fx` | `dur`（0.2〜0.45秒）、`plan`、`apply(ctx,e,P,k)` | カットの頭で、強さ `k` が 1→0 に減る後処理。**`e.opaque===false`（下に絵がある時）は、透明な所を塗らない**（白や色で全面を塗ると画面が真っ白になる）。点滅するものは `strongFlash:true`（「強い点滅を避ける」で外れる） |
| つなぎ `trans` | `dur`（0.3〜0.5秒）、`plan`、`draw(ctx,A,B,p,e,P)` | 前の絵 `A` と今の絵 `B` を `p`（0→1）で合成。p=0 で A、p=1 で B だけ。まず全面を絵で覆ってから重ねる（途中で穴を開けない）。下に絵がある時、画面の70%以上を塗りつぶさない |
| 物の世界 `world` | `worlds.js` の形（`fits` `frame` `plan` `back` `front` `textColor` `box` …） | 形が大きいので週に1個まで。既存の世界を1つ丸ごと読んでから |
| 装飾 `deco` | `plan(r)`→P、`draw(c,d,P)`、`back`（文字の後ろに描くなら true） | 文字のまわりに付く飾り（2026-10-17 新設。手で作った21種は `decos.js`）。`d` は文字の外接矩形 `x0` `y0` `x1` `y1` `w` `h` `cx` `cy`、字の大きさ `size`、`lt` `dur`、出てくる進み `a`（0→1）と残る度合い `z`（1→0）、`fg` `accent` `seed`。**文字を隠さない**（文字の上には線・小さな形だけ。塗りは `back:true` で文字の後ろに、半透明で）。`a` で描いていく・飛び出すなど、出てくる動きを付ける |

- 共通：**同じ時刻なら同じ絵**（`Math.random` `Date.now` は使わない。乱数は `plan(r)` の `r` か `hash`）。`plan` は JSON にできる値（数・文字・真偽・それらの配列と object）だけを返し、同じ `r` なら同じ値。値は STUDIO の作品ファイルに保存され、読み込む時に `plan` が出せる範囲に収められる（だから、`plan` の外の値に頼らない）。
- 字の部品の `glyph` は、`{dx,dy,sx,sy,rot,a,blur,hide}` のほかに、`ch`（代わりに描く字）`reel`（リール）`cell`（字の枠で切り抜く）`paint`（左から塗り直す）`bold`（太らせる）`thin`（輪郭だけ）`erode`（削れて消える）も返せる（2026-10-18 から。意味と手本は `docs/cut-parts-concept.md` の 3）。
- `g`（字）：`cx` `cy` `w` `size` `word`（語の番号）`line`、`wcx` `wcy`（語の真ん中）。`E`：`size` `W` `H` `r(i,k)`（字ごとの決まった乱数）`nWords` `n` `bbox`（行の外接矩形 `x0` `x1` `y0` `y1`）`lt` `D` `seed`。`e`（背景・カメラ・画面効果・つなぎ）：`W` `H` `t` `lt` `dur` `p` `fg` `accent` `bg` `opaque` `tmp(slot,w,h)`（作業用のキャンバス）。

#### 書いたら
```sh
node --test tools/test/studio/*.test.mjs        # 形・名前・決まり・計画が選ぶか・保存した値が変わらないか（毎日の部品のテスト cuts-daily と、軸ごとのテスト）
```
落ちたら、メッセージを読んで部品を直す（テストを変えない）。「60の計画で一度も選ばれない」と言われたら、`tags` を広げる・`w` を上げる・`minDur` `maxChars` を緩める。

#### ゲートの基準（プレビューと同じ、3秒の1行・480×270・名前が言葉）
1.5秒と2.0秒の絵で言葉が読める（明るい画素が400以上）／カットの間に絵が3通り以上に変わる／1コマ2秒以内／背景は下に絵がある時に不透明度130/255まで、画面効果は塗りつぶしが55%まで・隅が透明のまま、つなぎは塗りつぶしが70%まで。

さらに**組み合わせの総当たり**（2026-10-18 から）：全部の部品から計画を40通り（下に写真あり・なし）作って全コマを描き、絵の7割以上が白に近いコマがあれば失敗。メッセージに、そのコマの部品の組み合わせが出る。片方ずつ外して描けば、どちらの部品が原因か分かる（`docs/cut-parts-concept.md` の 4）。

### 変更した部品の `?v=`

GLSL（`method-samples.js`）を変えたときは、ブラウザに古い版を使わせないために、読み込む側の `?v=` を上げます。**玉突きでHTMLまで**自動で上がります。

```sh
node tools/bump_module_version.mjs app/method-samples.js
```

②の `image-method-daily.js` と③の `daily-parts.js` は、番号なしで読み込まれる（Mac側のプリセット・STUDIO のカット割り）ので、`?v=` の操作は要りません（ブラウザは毎回確認します）。上げ忘れがあれば、ゲートが見つけます。

## 3. プレビューとページ

```sh
node tools/make_sample_previews.mjs          # 足りないプレビュー（JPGとMP4）だけ作る
node tools/build_guide_samples.mjs           # app/guide/samples.html を作り直す
```

できた `app/guide/samples/*.jpg` を **Read で開いて見てください**（全部。部品は8枚前後あるので、`magick a.jpg b.jpg … +append` で横に並べて1枚にして見るとよい）。

- 何かが映っていて、動きの特徴が分かる（真っ黒・真っ白・ほぼ元のまま・ほぼ空、は作り直し）。
- 文字は読める。
- カット割りの部品は、**その部品の動きの途中**が写っている（止まった文字だけ・何も変わっていない絵なら、`poster` を動きの途中の時刻にするか、動きの配分を見直す。例：一瞬で終わる動きは静止画で伝わらない）。

見た目がよくなければ、コードや `poster` を直して `node tools/make_sample_previews.mjs --force --only=<id>`。コードを変えたら、ページも作り直す（`build_guide_samples.mjs`。ゲートが「ページが最新か」を見ます）。

## 4. ログ

`docs/daily-samples-log.md` の表の**一番上**に、その日の分を全部足します（メソッド1行・グラフィックモーション1行・部品1つにつき1行。種類は `method` / `image` / `cutpart`、`id` はバッククォートで囲む：`method-…` / `image-…` / `cut-<軸>-<key>`）。最後の列には、工夫したところ、うまくいかなかったこと、次に作れそうなことを一言。

## 5. 検証（これが通らないと進めない）

```sh
node tools/verify_daily.mjs --expect-new=<今日>
```

見るもの：単体テスト（`tools/test` と `tools/test/studio`。欄・形式・「同じ時刻は同じ絵」を壊す語、カット割りの全部の部品の形・計画・保存した値）／今日の分が（2026-10-18 から）カット割りの部品 6以上（GLSL と画像メソッドは足さなくてよい。足すなら最大1。テキストモーションとエフェクトは0）。2026-10-17 までは、GLSL 1・画像メソッド 1・テキストモーション 1／カット割りの部品が STUDIO の本物のエンジンで描け、動き、読め、下に絵がある時に塗りつぶさない／全部の部品の組み合わせで白く飛ぶコマがない（40通りの計画の総当たり）／プレビューのファイル・大きさ・形式／ページが最新／全ページ（工房・モーション集を含む）がエラーなく開く／GLSLがエディタと同じ3つの検査を通る／画像メソッドと文字コードが本物の実行環境で上の基準を満たす／サンプル集のカードとホバー／エディタのプリセット一覧と歌詞パネルの選択肢／`?v=` の上げ忘れ／ログ。

落ちたら、メッセージの指示どおりに直して、もう一度。**ゲートや単体テストを緩める・スキップするのは禁止**。1日に直して試すのは3回まで。

## 6. `main` に入れる

ゲートが全部 PASS したら：

```sh
git add -A app docs tools
git status --short                                   # 意図したファイルだけか見る（app/guide/samples/ のプレビュー、samples.html、ログ、docs/cut-parts-wishlist.md、method-samples.js・image-method-daily.js・studio/cuts/daily-parts.js、GLSLを変えたときの ?v= のhtml）
git commit -m "Add daily samples <今日>: <メソッドの名前>, <グラフィックモーションの名前>, カット割りの部品 <N>個"    # 末尾にセッションの署名行を付ける
git fetch origin main
git rebase origin/main                               # 自分の作業ブランチなので rebase してよい
node tools/verify_daily.mjs --expect-new=<今日>        # main が進んでいたらもう一度（進んでいなければ省略可）
git push origin HEAD:main
```

ほかの人（Mac の作者）が先に `main` を更新していて衝突したら、`SAMPLES`／`DAILY_*`（`DAILY_CUT_PARTS` も）の末尾・ログ・`?v=` が重なることが多いので、両方を残して番号は大きい方+1に直し、`node tools/build_guide_samples.mjs` を作り直してからゲートをやり直します。Macのファイル（プリセット本体、画像メソッドの実行環境、工房など）の衝突は、**自分で決めずに**失敗として報告します。

## 失敗したとき

- **`main` にはプッシュしません。**
- 作業を `daily-samples/failed-<今日>` ブランチにプッシュして（`git push origin HEAD:daily-samples/failed-<今日>`）、落ちたステップのメッセージ、原因の見立て、次にやりたいことを最後の報告に書く。
- 3回直しても通らないサンプルは諦めて、通る別のサンプルに替えてよい（その場合、失敗した案はログの「工夫・気づき」に残す）。

## してはいけないこと

- 既存サンプルの `key`・名前・動きを変える、サンプルを消す（保存済みの `.unfold` や自作メソッドが壊れる）。
- Macで作られたファイルを変える：`image-method-presets.js` `image-surface-presets.js` `code-motion-presets.js`、画像メソッド・コードモーションの実行環境（`*-runtime.js` `*-worker*`）、工房、モーション集、それらのテスト。`archive/` も。
- カット割りの本体を変える：`app/studio/cuts/` のうち `daily-parts.js` 以外（`kit.js` `glyphs.js` `parts.js` `worlds.js` `compose.js` `layer.js` `plan.js` `audit.js` `items.js` `apply.js`）と、STUDIO のほかのファイル、`tools/test/studio/` のテスト。部品が足りない道具や描き方を必要とする時は、作らずにログの「次に作れそうなこと」に書く。
- 公開（Cloudflareへのアップロード）をする。
- 今日の分以外の `added` の日付を書き換える。メソッドとグラフィックモーションを1日に2つ以上、部品を1日に13個以上足す。`graphic`（GLSL）・`TEXT_MOTIONS`・`DAILY_CODE_MOTIONS`（テキストモーション・エフェクト）に新しく足す。
- 認証情報やトークンをコードやログに書く。
- 人を特定できることを、コード・文書・ログ・コミットのメッセージに書く（作者や AI のあだ名、Mac のユーザー名が入ったパス `/Users/<名前>/…`、メールアドレス）。リポジトリは公開する前提です。人は「作者」「Claude」、パスは `~/…` かリポジトリからの相対パスで書きます（`tools/test/public-hygiene.test.mjs` が見張っています）。

## この環境で分かっていること

- クラウドのChromiumは**H.264を再生できません**（MP4のホバー再生は、WebMに差し替えて動作を確認済み。MP4自体は ffmpeg で全部デコードできる）。ふつうのChrome・Edge・Safari・Firefoxでは再生できます。
- 日本語フォントは IPAゴシック（かんたん設定の文字の動きの極太の書体とは少し見た目が違います）。コードモーションの書体は同梱（`app/vendor/motion-fonts/`）で、そのまま使えます。Google Fonts には届きません。
- WebGLはソフトウェア描画（SwiftShader）。GLSLの「重すぎる」判定は実機GPUより遅く出ることがあります。重いと言われたら、ループや `sin` の数を減らす。画像メソッド（物理演算のWASM込み）は1フレーム約0.1秒で動きます。
- 画像メソッドのプレビューは約6秒のクリップを20fpsで5.75秒分（116コマ）、文字とカット割りの部品は3.6秒を24fps。部品のプレビューは1つ数秒（`tools/preview/cut-part.html` が STUDIO のカット割りのエンジンで描く。ほかの軸は動かない設定で、部品だけが見える）。MP4は600KBまで。
- カット割りの書体は同梱の `app/vendor/motion-fonts/`（プレビューはゴシック）。
- `tools/make_sample_previews.mjs` は Chromium（Playwright）と ffmpeg（libx264）が必要です。`TMPDIR` が長いパスだとChromiumが起動しないので、ブラウザ側だけ `/tmp` を使うようにしてあります。

## 参考：2026-10-17 までのテキストモーションの作り方

新しくは作りませんが、作者が「テキストモーションも再開」と言った時のために、以前の ③ の手順を残します（`DAILY_GROUPS` と `verify_daily.mjs` の数の決まりも戻すこと）。

<details><summary>以前の ③ テキストモーション</summary>

#### ③ テキストモーション（文字のコードモーション）

`app/code-motion-daily.js` の `DAILY_CODE_MOTIONS` の**末尾**に1つ足します（Macの `code-motion-presets.js` は触りません）。工房の「文字モーション」とコードモーションのエディタのサンプルに出ます。

```js
 {key:'rgb-settle',name:'色ずれが重なる',desc:'赤とシアンにずれた像が、本体に重なって落ち着きます。',added:'<今日>',poster:.35,source:`// 1行目に、何をするかを書く
const {createText,text,width,duration}=api;
const opts={maxWidth:width*.82,textAlign:'center',lineHeight:1.25,outlineWidth:'2%'};
const red=createText(text,{...opts,color:'#ff5d73',colorRanges:null,outlineColor:'#ff5d73'});
const cyan=createText(text,{...opts,color:'#4fd8ff',colorRanges:null,outlineColor:'#4fd8ff'});
const label=createText(text,{...opts,outlineColor:'#101819'});
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
const enter=Math.min(.9,duration*.3),exit=Math.min(.5,duration*.18);
return {update(t){
 const a=smooth(t/enter),fin=smooth(t/(enter*.45)),b=smooth((duration-t)/exit),apart=(1-a)+(1-b),fade=fin*b;
 const shift=width*.045*apart,ghost=fade*Math.min(1,.2+.8*Math.min(1,apart*1.4));
 red.position.set(-shift,shift*.15,0);cyan.position.set(shift,-shift*.15,0);
 red.fillOpacity=ghost;cyan.fillOpacity=ghost;red.outlineOpacity=0;cyan.outlineOpacity=0;
 label.fillOpacity=fade;label.outlineOpacity=fade;
}};`}
```

- 項目：`key`／`name`（2〜20文字、重複しない）／`desc`／`added`／`poster`（省略できる。行が始まって何秒後の絵を静止画にするか、0.05〜1.5、省略時 0.2）／`source`。
- 書き方は `app/guide/code-motions.html` が正です。要点：`api` を引数に持つ関数の**本体**。使えるのは `THREE` `Text` `gsap` `scene` `camera` `text` `runs` `width` `height` `fontSize` `color` `accent` `fontURL` `createText(text,options)` `duration` `bpm` `random()`。座標は**px、画面の中心が原点、y は上向き**。返り値は `{timeline, update(t), dispose()}` の `timeline` か `update` が必要。
- **同じ時刻は同じ絵に**（②と同じ）。`update(t)` は `t` から直接求める。GSAPは `paused:true`。
- 長い歌詞・日本語でも画面に収める（`maxWidth: width*.8` くらい）。`duration`（歌詞の表示秒数）は 0.5〜60 秒で変わるので、登場・退場の長さは `Math.min(…, duration*…)` で決める。
- 強調語の自動配色は `createText` が行います。色を固定した飾りの文字は `colorRanges:null`。
- ゲートの基準（プレビューは `duration` 3秒の1行、画面 480×270）：行の中ほど（1.5秒・2.0秒）で文字が**400画素以上**あり、画面の半分以下で、画面の端（2%の内側）に触れない／登場の途中（0.45・0.9・1.5秒）で絵が変わる／行が終わった後（3.4秒）に文字が残らない（中ほどの5%以下＝`duration` までに消える）／1フレーム5秒以内。
- `poster` は文字がはっきり見える時刻に。静止画がほぼ空・ぼやけている場合は、遅らせる（0.05〜1.5）。
- **プレビューの言葉は、そのサンプルの名前**（2026-10-11 に作者の希望で変更）：「とろけてたれる」はその言葉がとろけて垂れる。動きが言葉で直感的に伝わるように、`name` をそのままプレビューの歌詞にします（`tools/make_sample_previews.mjs`）。ただし `shelf:'effect'` のエフェクトは、どんな歌詞にも重ねる飾りなので、これまでどおりの歌詞（「きみと、はじまる」）のままです。
- **名前は、1行（10〜11文字）でも2行に折り返しても読めるもの**にします。共通の部品（`layout()`）は2行以上になるとき行の長さをそろえます。
- **動きだけでなく「落ち着いた後」も見る**：1.5〜2秒の絵で、文字が正しい向きでまっすぐ止まっていること（回転や位置を `a*0.6` のように「乱数の開始角」から求めると、止まった後も傾いたままになります。回転は「動きの量」だけで決める）。
- **背景のエフェクト**（`「…の背景」`）は文字を描きません。STUDIOでは文字モーションとは別のクリップとして置き、「重なり順」を文字モーションより下にして重ねます（歌詞は常に一番上に描かれます）。外周2.5%には模様を出さず、模様が画面の半分以下になるようにします（ゲートの基準は文字モーションと同じ）。
- **語ごとに動くキネティック系**は、語に区切って（`Intl.Segmenter`）、語の登場を歌詞の長さの1/4までに散らし、3秒の行なら約1.2秒でそろうようにします（ゲートは1.5・2.0秒の絵で読めること・端に触れないことを見ます）。
- **エフェクトの棚に入れるもの**：文字の動きそのものではなく、文字の後ろや周りに重ねる装飾（シェーダー、キーキャップの枠など）。`shelf:'effect'` を付けると、サンプル集で「エフェクト」の棚に出ます。ゲートの基準（画面の半分以下・端に触れない・終了後に消える）は文字モーションと同じです。

</details>
