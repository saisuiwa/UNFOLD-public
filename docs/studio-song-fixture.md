# 明示したローカル音声で全曲検証する

Mac ChromeとPlaywrightを使用する検証runnerです。ユーザーのフォルダを検索せず、指定したファイルだけを読みます。ファイルはローカルの隔離Chromeに渡し、外部へアップロードしません。通常のSTUDIO画面への曲読み込みとは独立した検証用コマンドです。

リポジトリのルートで実行します。

```sh
UNFOLD_STUDIO_SONG_FIXTURE='/absolute/path/許可済みの曲.wav' node tools/test/studio/full-song-browser.mjs
```

パスを省略すると、従来どおり180秒の合成音声を生成して検証します。明示パスが存在しない、通常ファイルでない、音声をデコードできない場合はエラーで止まり、合成曲へすり替えません。混合作品の画像・動画・UNFOLD区間を維持するため、指定音声には30秒以上が必要です。対応形式は実際のChrome/Mediabunnyのデコード可否で判定します。WAV/MP3/M4A等を対象にできますが、全codecの保証ではありません。

曲長は音声から測定します。作品尺は30fpsの次フレーム境界まで、主曲は元音声の末尾までを使います。最後の1フレーム未満は無音です。主曲の元バイト列は作品に所有させ、保存往復で検証します。同期検査の効果音を判別するため、パス指定時の検証fixtureでは主曲gainを0.1に設定します。元ファイルを変更せず、ユーザー作品の音量にも影響しません。

検証は20回のシーク・演出切替と破棄、横全曲の音付き出力、全フレームの再デコード、音声末尾、終盤の同期マーカー、保存再読込、縦14〜22秒ショートを含みます。レポートは入力名・SHA-256・実測曲長・入力経路を保持し、人による聴取確認はfalseのままです。パス指定を実ユーザー曲の検証済みという意味には使いません。

パス指定時の結果は `tools/out/studio/full-song-path-report.json`、`full-song-path.mp4`、`song-short-path.mp4` です。従来の合成試験結果や納品済み30秒デモを上書きしません。

自作合成曲で同じパス入力を再現できます。

```sh
node tools/test/studio/make-song-fixture.mjs /tmp/UNFOLD-original-180.wav 180
UNFOLD_STUDIO_SONG_FIXTURE=/tmp/UNFOLD-original-180.wav node tools/test/studio/full-song-browser.mjs
```

この追加検証で使用したのは上記の自作WAVです。実ユーザー曲の聴取・検証済みとは主張しません。
