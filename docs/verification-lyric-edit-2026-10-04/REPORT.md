# Lyric preview and timeline editing fixes

## Root causes and changes

- Style buttons previously assigned motion but never played it. Reproduced: the play control stayed stopped at 0.00 after clicking a style. They now enable lyrics, seek to a visible lyric interval and start playback. Empty or out-of-range lyrics show a message.
- Overlay lyric blocks lacked edge handles. Added left/right trimming through the existing undo history. Trims use a gesture snapshot, preserve the other end, keep provisional neighbors in place and stop at the next lyric or song end.
- The lyric track was fixed at 34 pixels. It now starts at 72 pixels, wraps text and has a top handle to expand upward. Height is remembered; double-click resets, Up/Down keys adjust it.
- Fit-to-timeline resets horizontal scroll. Preview keeps its 16:9 aspect ratio when the timeline grows.

## Validation

274 Node tests passed, including five new regression tests. Confirmed failing reproduction before the fix, then success.

Chrome on an isolated localhost:8773 origin with synthetic lyrics and built-in sample images:

- Clicking a style starts playback and seeks past the blank opening.
- Overlay text is visibly rendered over the image.
- Pointer drag expands lyric height 72 -> 212 pixels; reload retains 212.
- Right edge: 6.00 -> 4.66 -> 5.33 seconds.
- Left edge: 0.00 -> 0.94 seconds while the end remains 5.33.
- Undo restores 0.00; redo restores 0.94. Reload retains the edited interval.
- Preview aspect after expanding: 1.77781 (16:9).

Screenshot: lyric-edit.png (kept locally, excluded from Git). Public deployment was not changed.
