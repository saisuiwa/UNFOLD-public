# Split-text color inheritance fix

User report: custom code motions remained white while built-in recipe thumbnails showed selected word colors.

Read the current motion from the user's existing editor without altering it. It calls createText once per character, skipping whitespace. Root cause: createText only mapped lyric run colors when its value equaled the entire lyric text. Fragment meshes only received the base color.

Fix: resolve fragments in creation order against original lyric offsets, then translate run ranges into each mesh's local offsets. Handles skipped spaces, repeated words, multi-character fragments, emphasis, and UTF-16 offsets. Existing code works unchanged. Optional textStart supports intentional out-of-order creation; explicit colorRanges and unstyled author colors are preserved. Bundled worker updated with a cache version.

Evidence:
- Before: 4 browser failures (red and blue inheritance for per-character and per-word code), whole-line and explicit author colors passed.
- After: tools/test/code-motion-colors.html 11/11 pass, including the word-color action through decoded MP4 pixels and restored export controls.
- tools/test/code-motion-colors.test.mjs: 5/5 pass (occurrence, mixed-color ranges, order override, Unicode, opt-out).
- Complete Node suite 300/300 pass.
- Existing code-motion-integration.html 29/29 pass.
- git diff --check passed.

User project, authored code, images, audio, and current browser tab were not modified/reloaded. No external publication. Small verification crop: code-color-fix.png (17KB).
