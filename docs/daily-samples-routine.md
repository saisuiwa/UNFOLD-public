# 毎日のサンプル追加ルーティン（手順書）

毎日1回、次の **3つを1つずつ** 追加して、検証が全部通ったときだけ `main` に入れます。メソッド工房（`/workshop.html`）のサンプルブロックと同じ3種類です。

| 作者の呼び方 | 工房での名前 | どこに足すか | プレビューのid |
|---|---|---|---|
| メソッド | 画像の崩れ方（GLSL） | `app/method-samples.js` の `SAMPLES`（`category: 'method'`） | `method-<key>` |
| グラフィックモーション | 画像・立体・物理（JavaScript） | `app/image-method-daily.js` の `DAILY_IMAGE_METHODS` | `image-<key>` |
| テキストモーション | 文字モーション（コード） | `app/code-motion-daily.js` の `DAILY_CODE_MOTIONS` | `codetext-<key>` |
| エフェクト（文字の後ろや周りの装飾） | メソッド工房の「エフェクト」タブ・サンプル集の「エフェクト」の棚 | 同じ `DAILY_CODE_MOTIONS` の項目に `shelf:'effect'` を付ける | `effect-<key>` |

この割り当ては 2026-10-07 に作者に確認して決めました（Macで作られたメソッド工房・モーション集に合わせる）。以前の GLSL の `category: 'graphic'` と、かんたん設定の文字の動き（`TEXT_MOTIONS`）は**そのまま残しますが、新しくは足しません**。

公開サイト（Cloudflare）は**自動では変わりません**。作者が手動でアップロードします（`docs/公開手順_Cloudflare.md`）。ルーティンがするのは「`main` に検証済みのソースを足す」ところまでです。

## 0. 許可の範囲

作者（2026-10-07）から：「毎日3つ（各1つ）。`main` にプッシュする前に確認して、壊れていなければプッシュしてよい。16:30頃（日本時間）。」

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

2つ目はMacで作られたものも含む、工房に出る全部の名前です（名前の重複はテストが落とします）。**標準の29種類**の崩れ方は `tools/build_guide_methods.py` の先頭の表にあるので、GLSLでは同じ動きを避けてください。`docs/daily-samples-log.md` も読んで、過去の日と同じ発想を繰り返さないでください。

## 2. 3つを作る

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

### ③ テキストモーション（文字のコードモーション）

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
- **エフェクトの棚に入れるもの**：文字の動きそのものではなく、文字の後ろや周りに重ねる装飾（シェーダー、キーキャップの枠など）。`shelf:'effect'` を付けると、サンプル集で「エフェクト」の棚に出ます。ゲートの基準（画面の半分以下・端に触れない・終了後に消える）は文字モーションと同じです。

### 変更した部品の `?v=`

GLSL（`method-samples.js`）を変えたときは、ブラウザに古い版を使わせないために、読み込む側の `?v=` を上げます。**玉突きでHTMLまで**自動で上がります。

```sh
node tools/bump_module_version.mjs app/method-samples.js
```

②③の `image-method-daily.js` / `code-motion-daily.js` は、Mac側のプリセットが番号なしで読み込むので、`?v=` の操作は要りません（ブラウザは毎回確認します）。上げ忘れがあれば、ゲートが見つけます。

## 3. プレビューとページ

```sh
node tools/make_sample_previews.mjs          # 足りないプレビュー（JPGとMP4）だけ作る
node tools/build_guide_samples.mjs           # app/guide/samples.html を作り直す
```

できた `app/guide/samples/*.jpg` を **Read で開いて見てください**（3つとも）。

- 何かが映っていて、動きの特徴が分かる（真っ黒・真っ白・ほぼ元のまま・ほぼ空、は作り直し）。
- 文字は読める。

見た目がよくなければ、コードや `poster` を直して `node tools/make_sample_previews.mjs --force --only=<id>`。コードを変えたら、ページも作り直す（`build_guide_samples.mjs`。ゲートが「ページが最新か」を見ます）。

## 4. ログ

`docs/daily-samples-log.md` の表の**一番上**に3行足します（`id` はバッククォートで囲む。`method-…` / `image-…` / `codetext-…`）。最後の列には、工夫したところ、うまくいかなかったこと、次に作れそうなことを一言。

## 5. 検証（これが通らないと進めない）

```sh
node tools/verify_daily.mjs --expect-new=<今日>
```

見るもの：単体テスト（欄・形式・「同じ時刻は同じ絵」を壊す語）／今日の分がちょうど GLSL 1・画像メソッド 1・文字コード 1／プレビューのファイル・大きさ・形式／ページが最新／全ページ（工房・モーション集を含む）がエラーなく開く／GLSLがエディタと同じ3つの検査を通る／画像メソッドと文字コードが本物の実行環境で上の基準を満たす／サンプル集のカードとホバー／エディタのプリセット一覧と歌詞パネルの選択肢／`?v=` の上げ忘れ／ログ。

落ちたら、メッセージの指示どおりに直して、もう一度。**ゲートや単体テストを緩める・スキップするのは禁止**。1日に直して試すのは3回まで。

## 6. `main` に入れる

ゲートが全部 PASS したら：

```sh
git add -A app docs tools
git status --short                                   # 意図したファイルだけか見る（app/guide/samples/ の6ファイル、samples.html、ログ、3つの追加先、GLSLを変えたときの ?v= のhtml）
git commit -m "Add daily samples <今日>: <3つの名前>"    # 末尾にセッションの署名行を付ける
git fetch origin main
git rebase origin/main                               # 自分の作業ブランチなので rebase してよい
node tools/verify_daily.mjs --expect-new=<今日>        # main が進んでいたらもう一度（進んでいなければ省略可）
git push origin HEAD:main
```

ほかの人（Mac の作者）が先に `main` を更新していて衝突したら、`SAMPLES`／`DAILY_*` の末尾・ログ・`?v=` が重なることが多いので、両方を残して番号は大きい方+1に直し、`node tools/build_guide_samples.mjs` を作り直してからゲートをやり直します。Macのファイル（プリセット本体、画像メソッドの実行環境、工房など）の衝突は、**自分で決めずに**失敗として報告します。

## 失敗したとき

- **`main` にはプッシュしません。**
- 作業を `daily-samples/failed-<今日>` ブランチにプッシュして（`git push origin HEAD:daily-samples/failed-<今日>`）、落ちたステップのメッセージ、原因の見立て、次にやりたいことを最後の報告に書く。
- 3回直しても通らないサンプルは諦めて、通る別のサンプルに替えてよい（その場合、失敗した案はログの「工夫・気づき」に残す）。

## してはいけないこと

- 既存サンプルの `key`・名前・動きを変える、サンプルを消す（保存済みの `.unfold` や自作メソッドが壊れる）。
- Macで作られたファイルを変える：`image-method-presets.js` `image-surface-presets.js` `code-motion-presets.js`、画像メソッド・コードモーションの実行環境（`*-runtime.js` `*-worker*`）、工房、モーション集、それらのテスト。`archive/` も。
- 公開（Cloudflareへのアップロード）をする。
- 今日の分以外の `added` の日付を書き換える。1日に3つより多く足す。`graphic`（GLSL）と `TEXT_MOTIONS` に新しく足す。
- 認証情報やトークンをコードやログに書く。

## この環境で分かっていること

- クラウドのChromiumは**H.264を再生できません**（MP4のホバー再生は、WebMに差し替えて動作を確認済み。MP4自体は ffmpeg で全部デコードできる）。ふつうのChrome・Edge・Safari・Firefoxでは再生できます。
- 日本語フォントは IPAゴシック（かんたん設定の文字の動きの極太の書体とは少し見た目が違います）。コードモーションの書体は同梱（`app/vendor/motion-fonts/`）で、そのまま使えます。Google Fonts には届きません。
- WebGLはソフトウェア描画（SwiftShader）。GLSLの「重すぎる」判定は実機GPUより遅く出ることがあります。重いと言われたら、ループや `sin` の数を減らす。画像メソッド（物理演算のWASM込み）は1フレーム約0.1秒で動きます。
- 画像メソッドのプレビューは約6秒のクリップを20fpsで5.75秒分（116コマ）、文字は3.6秒を24fps。1つ作るのに数十秒かかります。MP4は600KBまで。
- `tools/make_sample_previews.mjs` は Chromium（Playwright）と ffmpeg（libx264）が必要です。`TMPDIR` が長いパスだとChromiumが起動しないので、ブラウザ側だけ `/tmp` を使うようにしてあります。
