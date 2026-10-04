# Resizable sequence editor panel

- Drag the vertical handle on the left edge of the right editor to widen it.
- Width: 340 to 800 CSS pixels, bounded to leave room for the preview.
- Width persists in localStorage as a UI preference; double-click resets to 340.
- Keyboard: Left/Right adjust by 20 pixels; Home resets; End expands.
- At viewport widths of 1100 pixels or less, the existing stacked panel remains in use and the handle is hidden.
- Lyric grid children and file inputs now fit inside the panel instead of causing horizontal overflow.

Chrome verification: real pointer drag 340 -> 580; reload retained 580; Left key -> 600; double-click -> 340; End -> 800. At widths 340, 580 and 800, the lyric panel's scrollWidth matched its clientWidth. Preview resized with the existing ResizeObserver. No project content was changed during these checks.

Screenshot: panel-width.png (local only; excluded from Git).
