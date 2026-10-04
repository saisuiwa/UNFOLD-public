# SDD ledger — plan: docs/superpowers/plans/2026-10-04-lyric-motion.md

Backup: /Volumes/ORICO/UNFOLD/archive/app-before-lyric-motion-20261004-170407
Ruling: no Git repository; use archived baseline and persistent ORICO ledger instead of Git/worktree scripts — existing project structure — no commit history, archived baseline retained.
Pre-flight: Task1→3→4 uses shared event fields; Task2→6 uses candidate and revision gate; Task4→5 uses deterministic overlay; Task6→7 uses document/history. Consistent.
Ruling: retain this ledger at completion because no Git history stores it — audit and recovery — a small persistent documentation file.
Task 1: complete — missing API RED 4/4 → GREEN 4/4; full suite 246/246. Fixed issue ordering: instrumental text is not an unknown heading.
Task 2: complete — missing API RED 4/4 → GREEN 4/4; full suite 250/250. Synthetic ID3 v2.2/2.3/2.4, UTF16/UTF8, SYLT milliseconds/frame units, MP4/LRC, damaged/unsupported data, stale gate and Abort checked.
Task 3: complete — missing API RED 4/4 → GREEN 4/4; full suite 254/254. Instrumental gap, explicit end, 6s hold, provisional preview, offsets, tap resume/back, ordering/range validated.

Task 4: complete — pure motion 3/3 RED→GREEN, browser overlay 4/4; full Node suite 257/257. Resolution/safe-area coverage continues in Task 8.

Task 5: implementation and pure audio-offset test complete; full suite 258/258. Browser integration and encoded output validation pending in Task 8.
Task 6: new controls implemented; direct browser paste → Chorus → shuffle passed. Race, tap and undo scenarios pending.
Task 7: serialization RED 4/4 → GREEN 4/4; full suite 262/262. Browser restoration validation pending.

Task 5: complete — browser background 0/1 and OFF equality pass; 720p/-2s MP4 H264+AAC=10.005s, 1080p/+2s MP4 H264+AAC=6.016s.
Task 6: complete — browser headings, locks, Undo/Redo, independent drag, metadata auto/candidate/Undo, A→B and concurrent text, XSS, tap stop/resume pass.
Task 7: complete — browser .unfold document and shot roundtrip pass; Node v1/v2/v3, unknown version, legacy conversion and Blob history pass.
Task 8: review-ready — Node 266/266; integrated browser 31/31 including both MP4 outputs. Screenshot, safe-area and final reviewer pending.
Final: independent review by fresh gpt-6-astra — Important 4, Critical 0.
Final: fixed v3 method loss — baseline version validation RED→GREEN; browser actual import retains source/reference/quarantine; suite 269/269.
Final: fixed stale tap-session overwrite — browser edit+lock after stop then resume RED→GREEN; suite 269/269.
Final: fixed repeated lyric identity — two-line correction stole 20s/lock RED→GREEN; suite 269/269.
Final: fixed timing-file instrumental/emphasis/provisional loss — document timing-file RED→GREEN and browser import; suite 269/269.
Final: completed specified advanced controls and hidden legacy link — browser assertions RED→GREEN. 45 browser checks all pass.
Final: minor (deferred): editing a row's non-text fields rebuilds sourceText and normalizes blank lines/CRLF; lyric content, timings and headings remain intact.
Final: Ruling: reviewer declined independent GPU/UI/video judgment; author verified browser pixels and encoded MP4 streams/frames — direct runtime evidence — no independent second visual check.
Final: Ruling: Safari/mobile, interrupted physical file writes and physical missing-media recovery remain unverified — outside this run's tested hardware/failure injection — results in those environments are not guaranteed; baseline archive retained.
Task 8: complete — Node 269/269, browser 45/45 plus 2 MP4 exports, one independent review and one verified fix pass; documentation and artifacts retained in ORICO.
