# カット割りの部品17個（削れて消える・長い影・二重のフチ・波・線の飾り・雪・衝撃波）と、毎日の部品7個 — 公開記録 2026-10-18

> この記録のコミット番号は、非公開の本体リポジトリ（`saisuiwa/UNFOLD`）のものです。公開用リポジトリでは番号が違います（対応は `docs/公開用リポジトリへの反映.md`）。

作者の依頼（候補の表 `docs/cut-parts-wishlist.md` の続きを作ること）で、既存の Cloudflare Worker `unfold` を更新した。前回の公開のあとに main に入った、毎日の部品作りの7個（`4a6214d`）と、ゲートの待ち時間の直し（`5cf37d6`）も、この公開で一緒に出る。

- 公開ソース：`29eca64`（本体の main）。部品は `d8eeaed`、毎日の部品作りの文書は `29eca64`。
- 公開時刻の有効バージョン：`dae4295a-afe8-4026-9d24-ac41de085e89`
- 復旧先（直前の版・`df0a3b4`）：`cfab7f44-8e9d-4872-a5ae-b5d41f9011b3`
- 公開ファイル：20（変更・追加のみ。`studio/cuts/glyphs.js` `parts.js` `decos.js` `daily-parts.js`、毎日の部品の見本 14 と `guide/samples.html`、`release.json`）。公開前に直前の本番 759/759 の SHA-256 一致を確認、公開後も 773/773 が SHA-256・Content-Type ともに一致（`/release.json` は `29eca64`）。文書とゲート（`docs/` `tools/`）は公開サイトには入らない。
- 配布物・照合記録：`releases/unfold-parts17-2026-10-18/`。このフォルダは Git 管理外。

## 足した部品（IN 28 → 30、STAY 22 → 26、OUT 21 → 24、STYLE 15 → 18、DECO 22 → 25、BG 24 → 25、FX 14 → 15。毎日の部品と合わせて全部で 213）

| 軸 | キー | 名前 | 中身 |
|---|---|---|---|
| OUT | `sandAway` | 砂になって風化する | 行の右端の字から、境目がまだらに欠けて砂の粒になり、風で右上へ流れて消える |
| OUT | `burnAway` | 燃えて消える | 字ごとにばらばらに火が付き、波打つ境目が下から燃え上がる。境目は赤く光り、その上は焦げ、火の粉が昇る |
| OUT | `rubAway` | 消しゴムで消える | 上の段から往復しながらこすって消す。跡がうっすら残り、消しかすが落ちる |
| IN | `dropFocus` | ぼけながら落ちて止まる | 上からぼけて落ち、少し行き過ぎて戻りながらピントが合う |
| IN | `colorPop` | 色とりどりに弾む | 字ごとに違う色で跳ねて出て、着いたら元の色に戻る |
| STAY | `tiltDomino` | 傾きがドミノで伝わる | 足元の角を軸に倒れかけて戻るのが、となりの字へ順に伝わる |
| STAY | `sizeBump` | 大きさのこぶが通る | 大きさのこぶが字から字へ通り過ぎる（足元から上へふくらむ） |
| STAY | `sizeBreathe` | 字ごとに呼吸する | 字ごとに違う速さと間合いで大きさが呼吸する |
| STAY | `lineShiver` | 行がざわつく | 行ごとに横へ小刻みにずれ続ける |
| STYLE | `longShadow` | 長い影 | 字から斜めに長く伸びる影。光の向きがゆっくり振れる |
| STYLE | `echoOutline` | 輪郭の影が重なる | 輪郭だけのコピーを、斜めにずらして何枚も重ねる |
| STYLE | `doubleRim` | 二重のフチ | 内側は白か黒、外側はアクセント色のフチ |
| DECO | `cornerCatch` | 四隅の枠が捕まえる | 四隅の L 字が外から縮んできて、文字の角で止まる |
| DECO | `ecgPulse` | 心電図の線 | 文字の後ろを、心電図のような線が走る |
| DECO | `crossFlash` | X字の閃光 | 文字の上の角で、細い光が X 字に交差して閃く |
| BG | `snow` | 雪 | 奥と手前の2層の雪がゆれながら降る（2つの層が重なっても 125/255 まで） |
| FX | `shockRing` | 暗転して衝撃波 | カットの頭の2コマだけ暗くしてから、輪が2つ広がる（強い点滅として扱う） |

しくみ: 字の状態に `erode`（`{kind:'sand'|'burn'|'rub',k,…}`。glyphDraw の erodeDraw が、残っている所だけを切り抜いて描き、削れた所から粒を飛ばす。読めない状態として数える）。style に `longShadow`・`echo`・`rim`。

## 検証
- `node --test`（tools/test 以下）566 PASS（3 skip）。`node tools/verify_daily.mjs` 全手順 PASS（組み合わせの総当たり 40通りを含む）。
- STUDIO のブラウザテスト: cuts-fx・cuts（3回）・lyric-cut・cuts-free（6回）がすべて成功。
- 本物のカット割りのエンジンで17個を描いて、目で確認した（ドミノと大きさの波は最初は動きが小さすぎたので、波の幅を広げた。雪は粒を大きくした）。

## 復旧（今回は未実行）
```sh
WRANGLER_SEND_METRICS=false node ~/.npm/_npx/c943b712072b77c4/node_modules/wrangler/bin/wrangler.js rollback cfab7f44-8e9d-4872-a5ae-b5d41f9011b3 --config releases/unfold-parts17-2026-10-18/wrangler.json
```
