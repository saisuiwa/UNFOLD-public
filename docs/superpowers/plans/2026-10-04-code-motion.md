# Custom Motion Implementation Plan

> For agentic workers: use subagent-driven-development or executing-plans, work task by task.

Goal: ＋追加からThree/Troika/GSAP自作モーションを組み込み、動画へ出力する。
Architecture: self-contained versioned source in motion.code; sandbox worker renders transparent bitmaps; existing overlay composites them. Preserve recipe painter.
Tech Stack: existing native ES modules, Three.js, Troika Text, GSAP, OffscreenCanvas/Worker.
Spec: docs/superpowers/specs/2026-10-04-code-motion-design.md

## Global Constraints
No external upload/public deploy. Work on ORICO. Keep v1 recipes/Undo/project persistence. Arbitrary source must not run in main app realm. Time-seek/export deterministic. Read-only user current tab.

## Review Focus
- Missing font/source approval errors explicit in export.
- Stale async render result must not override new lyric/style.
- Infinite loop init/frame must time out and dispose.
- Code project import preserves source without executing it.
- v1 recipe app behavior unchanged.

## Task 1 — isolated rendering runtime
Files: app/code-motion-runtime.js (parent client), app/code-motion-worker-entry.js, app/vendor/code-motion-worker.js, tools/code-motion-build/*, licenses, browser runtime test.
Interface: `createCodeMotionRuntime()` returns `{prepare({source,text,width,height,fontSize,color,accent,fontBytes,seed}):Promise<void>, render(time):Promise<ImageBitmap>, dispose()}`. Runtime creates own isolated worker and renderer. Consumer supplies text/fonts; default font optional runtime can supply local font bytes if omitted. Export `CODE_MOTION_STARTER` source and `codeMotionExample(name)` optional presets. Use `motion.code.source`, no renderer reuse assumptions. Source contract as spec. Dependencies pinned bundled; no CDN runtime. Test actual browser including throw/timeout and reverse seek.
- [x] Implement runtime and starter, actual browser regression, report.

## Task 2 — schema, font bridge, preview/export integration
Files: app/code-motion-format.js, lyric-motion.js, lyric-library.js, lyric-fonts.js, lyric-overlay.js, sequence.js, relevant imports.
Interfaces: `cleanCodeMotion`, `getCodeMotionFont(key):Promise<ArrayBuffer>`, runtime API above. Overlay exposes `prepareFrame(doc,time,options)` async for export; realtime render caches latest bitmap and invokes invalidation callback. Approval held by source digest, import never autoruns unless prior approved. Limits from spec.
- [x] RED tests roundtrip/bounds/v1 then implement.
- [x] Integrate asynchronous overlay and exact export-frame await. Node and browser checks.

## Task 3 — ＋追加, code editor, gallery and documentation
Files: app/code-motion-editor.js/css, lyric-quick.js, guide/motions.js/html, creator guide examples.
Consume runtime and format; UI save in existing motion library, applying only code preserves selected typography/colors. Saved cards, add entry, source preview, import/export. Explain source uses return timeline/update.
- [x] UI implement and actual browser save/import/apply verification.
- [x] Document installed dependency versions/licenses and code API/examples.

## Task 4 — verification and integration
- [x] Unit all; browser recipe regression; custom source pixel/seek; real font; project and Undo; MP4 decode.
- [x] Independent whole branch review, fixes, commit and local main integration. No public deploy.
