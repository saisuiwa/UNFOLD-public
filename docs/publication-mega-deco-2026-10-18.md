# カット割りの超デカ文字（STAGE）と飾り8個 — 公開記録 2026-10-18

> この記録のコミット番号は、非公開の本体リポジトリ（`saisuiwa/UNFOLD`）のものです。公開用リポジトリでは番号が違います（対応は `docs/公開用リポジトリへの反映.md`）。

作者の依頼（文字のモーショングラフィックスの見本2本を、軸と部品に分けたうち、超デカ文字と飾りを作ること）で、既存の Cloudflare Worker `unfold` を更新した。

- 公開ソース：`f2c4ad4`（本体の main）。部品は `85c67c1`、文書は `f2c4ad4`。
- 公開時刻の有効バージョン：`183f4cb5-674b-4c39-97d9-6135deb6a529`
- 復旧先（直前の版・`29eca64`）：`dae4295a-afe8-4026-9d24-ac41de085e89`
- 公開ファイル：5（変更のみ。`studio/cuts/glyphs.js` `worlds.js` `plan.js` `decos.js` と `release.json`）。公開前に直前の本番 773/773 の SHA-256 一致を確認、公開後も 773/773 が SHA-256・Content-Type ともに一致（`/release.json` は `f2c4ad4`）。
- 配布物・照合記録：`releases/unfold-mega-deco-2026-10-18/`。このフォルダは Git 管理外。

## 足した部品（STAGE 20 → 21、DECO 25 → 33。全部で 222）

| 軸 | キー | 名前 | 中身 |
|---|---|---|---|
| STAGE | `megaText` | 超デカ文字 | 1〜4字の短い語を、画面の高さより大きく置く（端が切れる）。寄る／横に流れる／輪郭だけの同じ字をずらして後ろに重ねる |
| DECO | `barcode` | バーコードの帯 | 文字の横に細い縦線の帯。何本かの太さが時々入れ替わる |
| DECO | `hudNumbers` | 計器の数字 | 文字の斜め上下に、座標や番号の小さな読み取り値。下の桁が数え変わる |
| DECO | `hudFrame` | 計器の枠 | 画面の縁に四隅のかぎ・ラベル・目盛りと進む印・時刻。画面に貼り付く |
| DECO | `strikeLine` | 打ち消し線 | 語の真ん中を細い線が横切る（2行以上なら1行目） |
| DECO | `arcRing` | 弧が描かれる輪 | 文字の後ろで二重の円弧が描かれて輪になり、ゆっくり回る |
| DECO | `shapeMorph` | 図形の変形 | 文字の後ろの淡い図形が、三角から円へ角の数を増やしながら変わる |
| DECO | `tagChips` | タグの札 | 文字の下に丸い小さな札が順に出る |
| DECO | `blinkCursor` | 点滅するカーソル | 文字の最後の後ろでカーソルが点滅する |

しくみ: 台（world）の `frame()` が `size`（字の大きさ px）と `fit:false` を返すと、`layoutText` は字を箱に収めずにその大きさで置く。

## 検証
- `node --test`（tools/test 以下）566 PASS（3 skip）。`node tools/verify_daily.mjs` 全手順 PASS（組み合わせの総当たり 40通りを含む）。
- STUDIO のブラウザテスト: cuts-fx・cuts（3回）・lyric-cut・cuts-free（5回）がすべて成功。
- テストの直し: 毎日の部品が「選ばれるか」は、台なしの計画も一緒に数える（台を全部に付けると飾りの出番が少なく、飾りが34個になると、どれかが60通りで一度も出ないことがあった）。
- 本物のエンジンで9個を描いて、目で確認した（打ち消し線が行の間を通っていたので1行目へ、カーソルは消えている間も薄く残す、図形の塗りを淡く、バーコードを大きく）。

## 復旧（今回は未実行）
```sh
WRANGLER_SEND_METRICS=false node /Volumes/ORICO/motion-lab/node_modules/wrangler/bin/wrangler.js rollback dae4295a-afe8-4026-9d24-ac41de085e89 --config releases/unfold-mega-deco-2026-10-18/wrangler.json
```
