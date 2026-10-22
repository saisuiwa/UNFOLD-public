// How one picture sits in the 1920×1080 frame. Pure numbers (no DOM), so the sequence, STUDIO's drawing of it and the tests all share it.
// frame (kept on a slide, written to .unfold): { fit?: 'cover' | 'contain', crop?: { x, y, w, h } }
//   crop: the part of the picture that is used, as fractions (0..1) of its width and height. Left out = the whole picture.
//   fit:  how that part is put into the frame: 'cover' fills the frame (what does not fit is cut off), 'contain' shows all of it (the rest is background colour).
//         Left out = what the project-wide "画面いっぱいに表示" says, which is how every slide behaved before this existed.
export const FRAME_FITS = ['cover', 'contain'];
const MIN_SIDE = .02;                                  // the smallest part of the picture that can be kept (2% of a side)
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const round = v => Math.round(v * 1e4) / 1e4;

// Anything may arrive here (a saved file, an old browser's autosave). Returns a clean frame, or undefined when there is nothing to keep.
export function cleanFrame(f) {
  if (!f || typeof f !== 'object') return undefined;
  const out = {};
  if (FRAME_FITS.includes(f.fit)) out.fit = f.fit;
  const c = f.crop;
  if (c && typeof c === 'object' && ['x', 'y', 'w', 'h'].every(k => Number.isFinite(c[k]))) {
    const w = clamp(c.w, MIN_SIDE, 1), h = clamp(c.h, MIN_SIDE, 1);
    const crop = { x: clamp(c.x, 0, 1 - w), y: clamp(c.y, 0, 1 - h), w, h };
    if (!(crop.x < .001 && crop.y < .001 && crop.w > .999 && crop.h > .999)) out.crop = { x: round(crop.x), y: round(crop.y), w: round(crop.w), h: round(crop.h) };
  }
  return out.fit || out.crop ? out : undefined;
}

// Where to draw: the source rectangle taken from the picture and the destination rectangle in the frame (ctx.drawImage's nine numbers).
// fill: the project-wide setting, used when the frame has no fit of its own. No frame at all gives exactly what the old code drew.
export function framePlacement(imgW, imgH, frame, fill, W, H) {
  const c = frame?.crop;
  const sx = c ? c.x * imgW : 0, sy = c ? c.y * imgH : 0, sw = c ? c.w * imgW : imgW, sh = c ? c.h * imgH : imgH;
  let fit = frame?.fit ?? (fill ? 'cover' : 'contain');
  // a part cut to the frame's own shape fills it exactly; rounding the fractions must not leave a hairline of background
  if (fit === 'contain' && Math.abs(sw / sh / (W / H) - 1) < .002) fit = 'cover';
  const s = (fit === 'cover' ? Math.max : Math.min)(W / sw, H / sh);
  const dw = sw * s, dh = sh * s;
  return { sx, sy, sw, sh, dx: (W - dw) / 2, dy: (H - dh) / 2, dw, dh };
}

// The largest part of the picture with the given shape (width / height in pixels), made smaller by zoom (1 = as large as it goes), centred on (cx, cy).
export function aspectCrop(imgW, imgH, aspect, { cx = .5, cy = .5, zoom = 1 } = {}) {
  let w = imgW, h = w / aspect;
  if (h > imgH) { h = imgH; w = h * aspect; }
  const z = Math.max(1, Number(zoom) || 1);
  const nw = clamp(w / z / imgW, MIN_SIDE, 1), nh = clamp(h / z / imgH, MIN_SIDE, 1);
  return { x: clamp(cx - nw / 2, 0, 1 - nw), y: clamp(cy - nh / 2, 0, 1 - nh), w: nw, h: nh };
}

// The kept part of a picture as a canvas of its own (the picture itself when nothing is cut out). make: how a canvas is made (the page's by default).
export function croppedCanvas(img, frame, make = () => document.createElement('canvas')) {
  const crop = cleanFrame(frame)?.crop;
  if (!crop) return img;
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const out = make();
  out.width = Math.max(1, Math.round(crop.w * iw)); out.height = Math.max(1, Math.round(crop.h * ih));
  out.getContext('2d').drawImage(img, crop.x * iw, crop.y * ih, crop.w * iw, crop.h * ih, 0, 0, out.width, out.height);
  return out;
}

// How much a frame-filling picture of this shape would lose: 0 = nothing, .5 = half of it is cut off.
export function coverLoss(imgW, imgH, W, H) {
  const a = imgW / imgH, b = W / H;
  return 1 - Math.min(a, b) / Math.max(a, b);
}
// A picture that is more than 3% away from the frame's shape is the kind that gets cut off when it fills the frame: that is when we ask.
export function needsFrame(imgW, imgH, W, H) {
  return Number.isFinite(imgW) && Number.isFinite(imgH) && imgW > 0 && imgH > 0 && coverLoss(imgW, imgH, W, H) > .03;
}

// The words the panel shows for a slide's frame
export function describeFrame(frame, fill) {
  const f = cleanFrame(frame);
  if (!f) return fill ? '全体設定どおり（画面いっぱい）' : '全体設定どおり（全体を見せる）';
  const fit = f.fit ?? (fill ? 'cover' : 'contain');
  if (!f.crop) return fit === 'contain' ? '全体を見せる（余白あり）' : '画面いっぱい（はみ出しは切る）';
  return fit === 'contain' ? '切り抜いて、全体を見せる' : '切り抜いて、画面いっぱい';
}

// One choice of the import dialog, carried over to another picture ("残りも同じ設定で")
//   { mode: 'whole' }                                         the whole picture, background colour around it
//   { mode: 'screen', cx, cy, zoom }                          the frame's own shape cut out at this centre and zoom
export function frameFromChoice(choice, imgW, imgH, W, H) {
  if (choice?.mode === 'screen') return cleanFrame({ fit: 'cover', crop: aspectCrop(imgW, imgH, W / H, choice) });
  return { fit: 'contain' };
}
