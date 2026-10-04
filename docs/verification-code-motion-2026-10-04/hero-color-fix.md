# Built-in poster hero color fix — 2026-10-04

The large outline glyph in 波打つ一文字 used the motion accent unconditionally. It now inherits the selected source glyph run color, falling back to the existing accent when no run color is present. The chosen glyph, outline, opacity, layout, and timing are unchanged. Module versions were refreshed through the sequence editor and motion gallery so cached renderers receive the fix.

Validation:
- Four regression tests first failed against the old implementation, then passed after the fix.
- Full Node suite: 304 tests passed.
- Browser pixel check: large outline inherits red from first glyph; reverse seek identical (2/2).
- Existing browser motion checks: 36/36 passed, including seek, sustained motion, export resolution, and restoration.
- The focused Canvas readback test uses willReadFrequently to avoid the browser GPU/CPU readback transition; default readback changed rasterization between early draws, while fixed readback and the WebGL overlay regression were deterministic.
- git diff --check passed.

Proof: hero-color-fix.png (local generated text only).
