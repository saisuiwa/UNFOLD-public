// A method whose image code shows words from params.label (爆砕と再誕 …): the pages offer a 「表示する文字」 field for it,
// and the words typed there go to the drawing as this use's own params (image-method-layer.js: input.params).
export const usesImageLabel=source=>/\bparams\.label\b/.test(String(source||''));
