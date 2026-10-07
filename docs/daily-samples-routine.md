# 毎日のサンプル追加ルーティン（手順書）

毎日1回、次の **3つを1つずつ** 追加して、検証が全部通ったときだけ `main` に入れます。

| 種類 | どこに足すか | 例 |
|---|---|---|
| メソッド（崩れ方） | `app/method-samples.js` の `SAMPLES`（`category: 'method'`） | 砂になって落ちる、インクがにじむ |
| グラフィックモーション | 同じ `SAMPLES`（`category: 'graphic'`） | 斜めワイプ、スライスのずれ、アイリス |
| テキストモーション | `app/lyric-motion.js` の `TEXT_MOTIONS` | 落ちて弾む、揺れる、スプリングで着地 |

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

いまあるサンプルの一覧（似たものを作らないため。**標準の29種類**も `tools/build_guide_methods.py` の先頭の表にあるので、同じ動きは避ける）：

```sh
node -e "import('./tools/lib/samples-catalog.mjs').then(m=>console.table(m.catalog().map(({id,name,desc,added})=>({id,name,desc,added}))))"
```

`docs/daily-samples-log.md` も読んで、過去の日と同じ発想を繰り返さないでください。

## 2. 3つを作る

### メソッド・グラフィックモーション（GLSL）

`SAMPLES` の**末尾**に1つ足します。

```js
  { key: 'sand-fall', name: '砂になって落ちる', symbol: '砂', category: 'method', desc: '絵が細かい砂になって、上から順にさらさらと落ちていきます。', added: '<今日>', source: `// 一行目に、何をするかを書く
vec3 userMethod(vec2 p, float amount) {
  ...
}` },
```

- `key`：小文字・数字・`-`、頭は英字。他と重複しない。`name`：2〜12文字。`symbol`：1文字。
- `desc`：10〜60文字で「。」で終わる、1文。`added`：今日の日付。`source`：1行目は `//` のコメント。
- 書き方のルールと使える道具（`hash` `rot` `partC()` `ph()` `cell` `uTime` `gKind` `gGlow` …、8000文字・ループ上限）は `app/method-samples.js` の `aiTemplate()` にまとまっています。既存のサンプルを手本にしてください。
- 「崩れ方（method）」は絵がばらける・崩れる動き。「グラフィック（graphic）」は切り替えやワイプのような、デザインされた動き。
- `poster`（省略できる）：サンプル集の静止画を撮る崩れ具合（0.05〜0.8、省略時 0.45）。動きの特徴がいちばん分かる瞬間を選ぶ（例：上から順に崩れる動きは 0.28 くらいの、まだ絵が残っているとき）。
- 検証は「何も映らない」「元の絵と変わらない」も**失敗**扱いです。`amount` が 0.45 くらいのとき、はっきり絵が変わっているものにしてください。
- 重すぎる（標準の一番重いメソッドの4倍超）と失敗します。ループは少なく。

### テキストモーション（歌詞の文字の動き）

`TEXT_MOTIONS` の**末尾**に1つ足します（順番が選択肢の並びです。既存の5つの位置は変えない）。

```js
  bounce:{label:'落ちて弾む',desc:'上から落ちてきて、床に当たったように弾みながら止まります。',added:'<今日>',poster:.14,fn:({intro})=>({y:-1.6*(1-bounceOut(intro))})}
```

補助の関数は、表（`TEXT_MOTIONS`）の上に `const bounceOut=…` のように置いてかまいません（この例は 2026-10-07 の実物です）。`y` は下向きが正なので、マイナスは「上」です。

- `fn` が返せるのは `x` `y`（文字の高さ単位）、`scale`、`reveal`（0〜1：どこまで書かれたか）、`emphasis`（*強調*した言葉の拡大）だけ。フェードイン・アウト（`opacity`）は全部の動きで共通です。回転・ぼかし・1文字ずつ別の動き、のようにチャンネルが足りない動きは、**勝手にエンジンを広げず**、実装せずにログへ「次の提案」として書いてください。
- 品質ルール（テストが見張ります）：値は有限で範囲内／行の外では見えない／**6秒の行の中ほどでは、位置は動かず（|x|,|y| ≤ 0.5）、全部書かれていて、大きさがほぼ普通（0.8〜1.3倍）**。
- `poster`（省略できる）：サンプル集の静止画を、行が始まって何秒後に撮るか（0.05〜1.5秒、省略時 0.2秒）。動きがいちばん見える瞬間にする。
- `label`：2〜12文字、`desc`：10〜60文字、どちらも他と重複しない。
- 引数 `c`：`m`（動きの設定）、`e`（行）、`t`、`p`（行の進み 0〜1）、`q`（なめらかな登場 0〜1）、`intro`（直線の登場 0〜1）、`duration`、`bpm`。

### 変更した部品の `?v=`

ブラウザに古い版を使わせないために、変えたファイルを読み込む側の `?v=` を上げます。**玉突きでHTMLまで**自動で上がります。

```sh
node tools/bump_module_version.mjs app/method-samples.js app/lyric-motion.js
```

（足したのが片方だけなら、その方だけ。ゲートが上げ忘れを見つけます。）

## 3. プレビューとページ

```sh
node tools/make_sample_previews.mjs          # 足りないプレビュー（JPGとMP4）だけ作る
node tools/build_guide_samples.mjs           # app/guide/samples.html を作り直す
```

できた `app/guide/samples/*.jpg` を **Read で開いて見てください**（3つとも）。

- 何かが映っていて、動きの特徴が分かる（真っ黒・真っ白・ほぼ元のまま、は作り直し）。
- テキストは文字が読める。

見た目がよくなければ、コードを直して `node tools/make_sample_previews.mjs --force --only=<id>`。

## 4. ログ

`docs/daily-samples-log.md` の表の**一番上**に3行足します（`id` はバッククォートで囲む。`method-sand-fall` / `graphic-…` / `text-…`）。最後の列には、工夫したところ、うまくいかなかったこと、次に作れそうなことを一言。

## 5. 検証（これが通らないと進めない）

```sh
node tools/verify_daily.mjs --expect-new=<今日>
```

見るもの：単体テスト／今日の分がちょうど method 1・graphic 1・text 1／プレビューのファイル・大きさ・形式／ページが最新／全ページがエラーなく開く／新しいメソッドがエディタと同じ3つの検査（書き方・GPUコンパイル・試し描画）を通る／サンプル集のカードとホバー／エディタのプリセット一覧／`?v=` の上げ忘れ／ログ。

落ちたら、メッセージの指示どおりに直して、もう一度。**ゲートや単体テストを緩める・スキップするのは禁止**。1日に直して試すのは3回まで。

## 6. `main` に入れる

ゲートが全部 PASS したら：

```sh
git add -A app docs tools
git status --short                                   # 意図したファイルだけか見る（app/guide/samples/ の6ファイル、ページ、ログ、変えたjs と ?v= のhtml）
git commit -m "Add daily samples <今日>: <3つの名前>"    # 末尾にセッションの署名行を付ける
git fetch origin main
git rebase origin/main                               # 自分の作業ブランチなので rebase してよい
node tools/verify_daily.mjs --expect-new=<今日>        # main が進んでいたらもう一度（進んでいなければ省略可）
git push origin HEAD:main
```

ほかの人が先に `main` を更新していて衝突したら、サンプルの `SAMPLES`／`TEXT_MOTIONS` の末尾・ログ・`?v=` が重なることが多いので、両方を残して番号は大きい方+1に直し、`node tools/build_guide_samples.mjs` を作り直してからゲートをやり直します。

## 失敗したとき

- **`main` にはプッシュしません。**
- 作業を `daily-samples/failed-<今日>` ブランチにプッシュして（`git push origin HEAD:daily-samples/failed-<今日>`）、落ちたステップのメッセージ、原因の見立て、次にやりたいことを最後の報告に書く。
- 3回直しても通らないサンプルは諦めて、通る別のサンプルに替えてよい（その場合、失敗した案はログの「工夫・気づき」に残す）。

## してはいけないこと

- 既存サンプルの `key`・名前・動きを変える、サンプルを消す（保存済みの `.unfold` や自作メソッドが壊れる）。
- `archive/` を編集する。公開（Cloudflareへのアップロード）をする。
- 今日の分以外の `added` の日付を書き換える。1日に3つより多く足す。
- 認証情報やトークンをコードやログに書く。

## この環境で分かっていること

- クラウドのChromiumは**H.264を再生できません**（MP4のホバー再生は、WebMに差し替えて動作を確認済み。MP4自体は ffmpeg で全部デコードできる）。ふつうのChrome・Edge・Safari・Firefoxでは再生できます。
- 日本語フォントは IPAゴシック（本番の Noto Sans JP の極太とは少し見た目が違います）。Google Fonts には届きません。プレビューのテキストはそのフォントで描かれます。
- WebGLはソフトウェア描画（SwiftShader）。試し描画の「重すぎる」判定は実機GPUより遅く出ることがあります。重いと言われたら、ループや `sin` の数を減らす。
- `tools/make_sample_previews.mjs` は Chromium（Playwright）と ffmpeg（libx264）が必要です。`TMPDIR` が長いパスだとChromiumが起動しないので、ブラウザ側だけ `/tmp` を使うようにしてあります。
