# UNFOLD 自作コードモーション

User-approved goal: Three.js + Troika Text + GSAPで他の人もオリジナルのテキスト演出を作り、＋追加でブロックを増やせる。既存レシピと色・PC書体・保存・動画出力を保持。

## Contract
`motion.code = {version:1, source:string}` is self-contained and saved with each lyric/project. Source is JavaScript function body receiving destructured API through `new Function('api',source)`. Authors use `const {THREE,Text,gsap,scene,camera,text,width,height,color,accent,fontURL,createText,random}=api;` and return `{timeline, update(time), dispose()}` (timeline/update individually optional, at least one). Host seeks a paused timeline in seconds and then calls update(time); no author RAF needed. Origin is screen centre; x right, y up, ortho coordinates are output pixels, host fontSize scales existing size. `createText(string,options)` creates Troika text with supplied font, color and size, adds to scene. At initialization await all Troika syncs before first frame. Default recipes remain Canvas2D path.

Source ≤32000 characters, package ≤128KB characters, name ≤40. File format `unfold-motion`, version 2 for code, version 1 recipes still accepted. No code execution during JSON validation/import. Explicit user Preview activates code in editor; applying or selecting code block is authorized activation. Imported projects containing code require activation in editor before running; persisted approval hashes can identify already tried sources. Errors surfaced and exports fail, never silently substitute wrong motion.

## Isolation / rendering
Execute custom code inside a dedicated Worker created within sandboxed opaque-origin iframe. Bundle dependencies locally; host fetches trusted worker bundle then transmits source. Worker gets lyric string/style/font bytes only; no images, audio, user project, parent DOM, storage or network. CSP default-src none; script unsafe-eval plus blob; connect blob/data only; worker blob only. Worker emits ImageBitmap from OffscreenCanvas. Parent validates requests, has initialization/frame deadlines, terminates hung worker through iframe control, closes stale bitmaps. Preview async latest-frame wins; export explicitly awaits matching frame before renderAt/encoding. Hold main Three renderer unchanged.

## UX
Inline motion tab shows builtins + saved code cards and a ＋追加 button. Add opens code editor with starter presets, source textarea, preview, name/save/apply, import/export. Errors visible, no silent fallback. Same entry available from guide motion gallery. Existing recipe editor remains accessible.

## fonts
Troika needs font bytes, not a CSS font family. Ship a locally hosted OFL Japanese TTF fallback; use imported TTF/OTF/WOFF or PC font bytes obtained from user-authorized Local Font Access. WOFF2 coded-motion support may require conversion; clearly reject unsupported file for code runtime while retaining existing recipe support. Never silently claim another font is selected. No font/media external upload. Font URLs in user source restricted by sandbox network policy.

## Success checks
Node roundtrips code/doc/project, v1 compatibility, bounds and untrusted import. Browser real Three/Troika/GSAP text, deterministic reverse seek/export-size frame, preview/import/save/apply/Undo, hung/throw code, no main storage/network access, actual MP4 decode. All work on ORICO, no publish/push.
