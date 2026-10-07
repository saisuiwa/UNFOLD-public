# Code motion extension verification — 2026-10-04

Implemented on codex/custom-motion-runtime from a41a677 in the isolated ORICO worktree. No external publishing or user-media upload.

- Node suite: 295 / 295 passed (`node --test tools/test/*.test.mjs`).
- Chrome `tools/test/code-motion-integration.html`: 29 / 29 passed. Three templates; visible and moving glyphs; exact reverse seeking; 640/1280 output resizing; all six bundled Japanese fonts; unapproved source rejection; old recipe rendering; inline add entry; project roundtrip; switching to recipes; MP4 output and decoded pixels/duration.
- Chrome `tools/test/code-motion-state.html`: 6 / 6 passed. Imported TTF through IndexedDB, Undo/Redo with code, unapproved export rejection restoring controls, decoded 1920×1080 high-quality (2× render) 30fps MP4 with imported font.
- Chrome `tools/test/motion-library-browser.html`: existing 36 / 36 passed, including CanvasTexture resize regression.
- UI: selected lyric → ＋追加 → preview → add/apply produced saved motion block. Gallery creation worked. Manual scrub to 1.80 seconds rendered correct text. Screenshot `code-editor.png`.
- Worker tests and focused multi-text pixel tests: see runtime-report.md. Parent review findings (reset queue revival, lost scrub while busy) fixed; reviewer rechecked without remaining actionable findings. MultiText dark-fill issue fixed in a9517fb; pending external Text.sync waits fixed too.
- `git diff --check` and syntax checks passed.

Compatibility: custom code must use the documented api function body, not arbitrary HTML/import-based projects. DOM/storage/network are unavailable inside code. Troika accepts TTF/OTF/WOFF, not WOFF2; old canvas recipes still accept WOFF2. Fonts and user media are not embedded in shared motion files. Background remains a separate composited layer.

Runtime pins: Three 0.180.0, Troika 0.52.4, GSAP 3.13.0. Six Japanese fonts and licenses bundled locally; source SHA256 manifest and fontTools rebuilding script retained. No dependency needed to run the app through its existing static server.
