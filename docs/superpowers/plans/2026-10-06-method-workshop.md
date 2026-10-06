# Method Workshop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** Create, preview, save and add reusable methods from one responsive workshop.
**Architecture:** Plain JS page uses existing three renderer APIs and storage formats. Small modules separate draft/palette/image helpers, renderer lifecycle, browser library integration and page UI.
**Tech Stack:** Existing Three/Troika/GSAP/Rapier bundles, native HTML/CSS, IndexedDB, Playwright.
**Spec:** docs/superpowers/specs/2026-10-06-method-workshop.md

## Global Constraints
- No deployment or GitHub push; no new dependencies.
- Preserve existing user data and CPU bitmap crash mitigation.
- One active preview; JS explicit execution; 800x450 maximum preview.
- Input images <=20MiB / <=80M pixels / long edge <=2048.
- Existing file formats and browser libraries remain compatible.

## Review Focus
- Edited drafts switching cards or reloading must not disappear.
- Slow prepare completing after stop must not resurrect a renderer.
- Storage failures must not claim a method was added.
- App handoff must not replace an unrelated sequence block or erase undo.
- Imported/previously crashed code must not run when merely listed.

### Task 1: Authoring state and asset helpers
Files: app/workshop-data.js, tools/test/workshop.test.mjs.
Interfaces: colorFormats(hex), imageScale(w,h), readDrafts/writeDrafts(storage,state), loadWorkshopImage(file), assetStore().get/put.
- [x] Write failing tests for normalized colors, bad sizes, drafts without execution and preserving corrupted storage.
- [x] Run node --test tools/test/workshop.test.mjs; confirm expected failure, implement helpers, rerun PASS.
- [x] Commit helpers and tests.

### Task 2: Workshop page and one-runtime preview
Files: app/workshop.html/css/js, app/workshop-preview.js, tools/test/workshop-browser.mjs.
Interfaces: createWorkshopPreview(host).prepare(draft,images), render(time,strength), dispose(); uses existing runtime contracts.
- [x] Add browser tests expecting workshop title/cards/editor, explicit JS preview, drafts across selection/reload, color copies and rendering.
- [x] Run browser test on port 8778; confirm missing page behavior fails; implement page and renderer adapter.
- [x] Verify actual pixels, error/timeout recovery, force stop, repeated selection, image/reference restoration and mobile layout.
- [x] Commit page, tests and verification evidence.

### Task 3: Existing library and app handoff
Files: app/workshop-library.js, app/workshop-link.js, app/app.js, app/sequence.js, app/index.html, app/sequence.html, app/guide/*.html.
Interfaces: addWorkshopItem(draft), savedWorkshopItems(), announceWorkshopItem({kind,id}); attachWorkshopLink({apply,notify}).
- [x] Add failing browser tests: save/reload/edit, import, shared file format, add confirmation and selected app block application.
- [x] Implement existing-store writes and explicit app invitation, preserving undo and no automatic execution on notification.
- [x] Run full Node suite and browser tests; verify 3 renderers and mobile screenshot visually.
- [x] Commit and request whole-branch independent review, address material findings and report local completion without deployment.

Completion evidence: docs/method-workshop-2026-10-06.md. Browser and Node checks passed. Independent review findings fixed; branch kept locally with no push or deployment.
