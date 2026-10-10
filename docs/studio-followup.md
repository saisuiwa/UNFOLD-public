# STUDIO follow-up clarification and delivery

## Text support and approved scope

Ordinary Japanese lyrics, free text layers, word colors, font choice, line wrapping, wide/tall layout and supported text motions are implemented. `text-image-browser.mjs`, mixed exports and final editor tests exercise actual text pixels. The unsupported “text/silhouette” refers only to the target geometry of an UNFOLD image transformation (`transitions[].shape`), not those text layers.

`unfoldCapabilities` accepts none, sphere, torus, helix, mass, cube, heart, star, saturn, mobius, diamond, flower, registered shape presets and owned modelAssets. Other shapes yield UNSUPPORTED_SHAPE; they are not substituted. Owned GLB support does not mean every existing GLB is certified. Text/silhouette target geometry needs a separate owned-font/shape adapter. Portrait currently contains the horizontal UNFOLD composition; direct portrait-camera rerender is not certified.

Approved design section8 (lines264–266) explicitly permits contained horizontal UNFOLD in portrait, requires per-placement shape/image/main settings editing, and excludes a guarantee for all special methods/GLB. Plan Task13 fixes an initial tested fold/morph/image set and requires Issues for unsupported cases. This restriction is consistent with that limited initial support contract; it does not remove the required lyric/text/MV workflow. It is an implementation support-set decision, not user approval of every possible shape omission.

## Drag failures and review

Two separate causes were addressed. Product pointerdown originally selected a clip before enabling the drag guard; selection synchronously emitted state and could replace the dragged DOM node. The fix sets drag=true before controller.select, retains capture, previews during drag and commits one command on pointerup. The later integration failure was in the test: its target y1037 lay outside the1000px viewport and hit no clip. scrollIntoViewIfNeeded fixes that test coordinate. Final real video drag, linked audio position, one Undo and unchanged main-song/lyrics PASS. Real AudioContext play plus wide/tall switching PASS.

Independent reviewer: fresh read-only agent `/root/final_review`, distinct from the implementation agent, started after implementation using a clean task context. Scope:5977480..40490df, approved design/plan, model/commands/storage/media/render/export/UI and shared legacy boundaries. It found seven Important findings (twoP1,fiveP2): unsaved outgoing import, first-song duration after visuals, duplicate-video linked audio, unlocked lyric move, late bitmap disposal, trim fade endpoints, restored short fields. All were fixed atd1d903d. Follow-up found the dirty lost-lease switch variant; fixed ateba725f. The last safe-guide correction ata8b5c89 was reviewed too. Final verdict: no unresolved Critical/Important issue. Reviewer independently ran13 Node audio tests and five focused browser suites; the implementation agent ran the complete24+2 browser gates and full-song outputs. No human code reviewer is claimed.

## Decisions and deferred details

- AAC packet timestamps use measured encoder priming compensation after a real Mac test exposed2112 extra samples; this preserves the approved audio synchronization contract.
- UNFOLD owned font/model resolution, explicit unsupported-shape rejection and horizontal portrait containment retain storage isolation and avoid silent replacement.
- No Minor finding was explicitly deferred by the independent reviewer. Two implementation/plan differences remain: the timeline currently expands all scenes rather than only the selected scene (no collapse control); the full-song runner supports the180s synthetic fixture but rejects UNFOLD_STUDIO_SONG_FIXTURE instead of importing a real-song path. These are a UI refinement and a validation-runner limitation, not missing ordinary text rendering. Real songs remain unverified. The earlier “all22 tasks complete” summary meant the core implementation and acceptance gates; it should not be read as exact completion of every UI/test-harness detail in the plan.
- Three preexisting Node tests remain skipped. iPhone/other browsers, human listening, actual device exhaustion and whole-process/GPU memory certification remain unverified.

## Formal Library routes and confirmed result

Previous route: current Library skill's bundled `library_upload.py` with four create uploads. `/usr/bin/python3` initially failed at import with `TypeError: unsupported operand type(s) for |: 'type' and 'NoneType'`; nothing was uploaded. Python3.12 then reached helper discovery but returned `library upload failed: Library prepare_uploads is not available`. The helper never invoked a successful prepare or finalize; there was no permission denial, uncertain finalized write or Library identity.

The tool catalog exposes `mcp__codex_apps__library_prepare_uploads` and `mcp__codex_apps__library_finalize_uploads`, but the helper's own hosted-app discovery could not expose `prepare_uploads` in this environment. That distinction matters: “all Library unavailable” was too broad. Current catalog also exposes `mcp__codex_apps__library_create_library_file` with `files` support. The user explicitly requested the documented unavailable-prepared/all-create fallback. Two ordered calls succeeded: files=[wide-screen,tall-screen], type=image; then files=[wide-30s,tall-30s], type=other. All four results status=succeeded, warnings=[], external_connectors_accessed=false. For each original path, `library_file_transfer.py apply-xattrs` completed with exit0 and exact returned identity/xattrs. No custom URL or alternative transfer destination was used.

The two screenshots were visually inspected again. Both videos match the SHA256 and bytes of the final outputs previously fully decoded as900frames with30s audio. No product code changed during this follow-up. All Library files are version0.

| File | Attachment file_id | Library identity |
| --- | --- | --- |
| UNFOLD-STUDIO-wide-screen.png | `file_0000000050fc823095b82aeeeb493529` | `libfile_bd1c71f66a44819187da49646811adb1` |
| UNFOLD-STUDIO-tall-screen.png | `file_0000000003d881f78b955105777f3bc4` | `libfile_9677a7cf19e881919f1cf5bff4e36051` |
| UNFOLD-STUDIO-wide-30s.mp4 | `file_00000000cca48230b4d773082dd06162` | `libfile_952ea5f52120819197ec2f4d7cd3e1fd` |
| UNFOLD-STUDIO-tall-30s.mp4 | `file_00000000b3f8823089db361775e5cdfc` | `libfile_f7bca2668f44819188bc3abaca9351e2` |

No upload blocker remains. Parent can attach these IDs directly; Mac filesystem access is no longer needed for delivery. No push, merge or publication.
