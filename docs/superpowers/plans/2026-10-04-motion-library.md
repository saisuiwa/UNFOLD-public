# Lyric Motion Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Deliver reusable lyric compositions with continuous effects, a visual recipe editor, import/export, an AI prompt, and a site gallery.
**Architecture:** A bounded JSON recipe selects supported layout and motion primitives. A pure scene compiler/evaluator and shared Canvas painter drive both previews and the existing Three overlay. Recipes embed in each lyric event, while a browser library stores reusable motion-only files.
**Tech Stack:** Existing ES modules, Canvas2D, Three.js; no new dependencies.
**Spec:** ../../lyric-motion-research-2026-10-04.md and ../../lyric-sustain-study-2026-10-04.md; user approval in the current conversation adds recipe authoring/library/gallery.

## Global Constraints
- Persistent work remains on ORICO. No uploaded songs/images/video leave the machine.
- Keep old five-preset projects readable with their old renderer when no recipe is present.
- Preserve manual times, line locks, Undo/Redo, source text and image backgrounds.
- Pure absolute-time rendering, independent of playback order, for preview/export agreement.
- Six compositions: editorial, impact, vertical, echo, assemble, poster.
- Separate entrance, sustain effects, and exit. Genuine glyph-to-glyph morphing is outside this first library implementation.
- Recipe format is data, not executable JavaScript/GLSL. AI can create supported combinations using the documented schema.

## Review Focus
- Long Japanese text, punctuation, emoji and line breaks must retain graphemes and fit available bounds.
- Imported recipe files with future versions, unknown keys, nonfinite/excessive numbers or huge data must fail clearly.
- Typing a neighboring line must not replace an already chosen custom recipe or its timing.
- An edited recipe must travel in project files and survive browser library loss.
- Page reload, reverse seek, font loading and rendering at a second resolution must not leave stale scene caches.

### Task 1: recipe format and library
Files: app/lyric-recipe.js, app/lyric-motion.js, app/lyric-library.js, tools/test/lyric-recipe.test.mjs.
Interfaces: normalizeRecipe(value), validateRecipe(value), BUILTIN_MOTIONS; parseMotionFile(text), buildMotionFile(record), createMotionLibrary(storage); cleanMotion preserves valid recipe, assignLyricMotions accepts preserveExisting.
- [ ] Write tests for validation, normalization, file roundtrip, duplicate import, storage failure, locked lines and preservation on text edit.
- [ ] Run Node tests and observe the expected missing-feature assertions.
- [ ] Implement bounded recipes and browser persistence, retaining legacy motion fields.
- [ ] Run tests; commit format/library.

### Task 2: shared lyric scene renderer
Files: app/lyric-scene.js, app/lyric-painter.js, app/lyric-overlay.js, tools/test/lyric-scene.test.mjs, tools/test/motion-library-browser.html.
Interfaces: compileLyricScene(event,{width,height,measure}) returns text/decor nodes; evaluateLyricNode(scene,node,time,bpm) returns deterministic transforms/effects; createLyricPainter() provides draw(ctx,event,time,{width,height,bpm}) and clear().
- [ ] Write tests for all layouts, safe bounds, grapheme preservation, very short/long lines, sustain changes and out-of-range opacity.
- [ ] Observe expected failure, then implement compiler/evaluator/painter and route recipe events through it.
- [ ] Verify Canvas/WebGL pixels for visible text, deterministic reverse seeks, independent resolutions, outside-time invisibility.
- [ ] Run tests; commit rendering.

### Task 3: authoring and distribution
Files: app/lyric-studio.js, app/lyric-studio.css, app/lyric-controls.js, app/sequence.js, app/sequence.html, app/guide/motions.html, app/guide/motions.js and guide navigation.
Interfaces: openMotionStudio({motion,text,onApply}) returns modal authoring UI; controls dispatch recipe-apply for all unlocked lines or edit for one selected line.
- [ ] Write integration checks for apply, preservation after text edit, undo/redo/project roundtrip, library save/import, gallery parity.
- [ ] Implement built-in selection, entrance/sustain/exit controls, preview, named save, export/import, AI JSON prompt/editor, gallery navigation.
- [ ] Run full Node suite and browser checks, visually inspect multiple layouts and backgrounds.
- [ ] Commit; obtain a fresh whole-branch review, fix important findings with regression tests, and run affected verification.

## Execution ledger
- Baseline: 274/274 Node tests pass at 1d812da.
- Workspace: /Volumes/ORICO/UNFOLD/.worktrees/lyric-motion-library, branch codex/lyric-motion-library. Native worktree tool unavailable in this execution environment; manual ignored worktree preserves ORICO preference.
- User explicitly approved implementation; proceed inline without another design approval cycle.
- Pre-flight: recipe normalization is shared by storage and rendering; full recipe embeds per line so preview/gallery/library removal do not change saved projects.
