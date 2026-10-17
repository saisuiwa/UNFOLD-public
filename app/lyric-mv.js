// Lyric MV helpers: timing files, tempo detection, lyric cards and the automatic sequence layout.
import { FONTS, ensureFont } from './mask-shape.js?v=7';
import { parseTimings, timingsToJSON } from './lyric-timings.js?v=2';

// ---------------------------------------------------------------- timings --
// the JSON / LRC / SRT readers live in lyric-timings.js (no three.js there, so the lyric timing page can use them too)
export { parseTimings, timingsToJSON };

// ------------------------------------------------------------------ tempo --
// onset envelope → autocorrelation for the tempo → Fourier fit for the exact period and phase
export function detectBeat(buffer) {
  const sr = buffer.sampleRate, fps = 100, hop = Math.round(sr / fps);
  const chans = [...Array(buffer.numberOfChannels)].map((_, i) => buffer.getChannelData(i));
  const n = Math.floor(chans[0].length / hop), energy = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let e = 0;
    for (const c of chans) for (let j = i * hop; j < (i + 1) * hop; j++) e += c[j] * c[j];
    energy[i] = Math.log(1e-6 + e);
  }
  const flux = new Float32Array(n);
  for (let i = 1; i < n; i++) flux[i] = Math.max(0, energy[i] - energy[i - 1]);
  const win = 40, mean = new Float32Array(n);   // remove the slow trend so only hits remain
  let acc = 0;
  for (let i = 0; i < n; i++) { acc += flux[i] - (i >= win ? flux[i - win] : 0); mean[i] = acc / Math.min(i + 1, win); }
  for (let i = 0; i < n; i++) flux[i] = Math.max(0, flux[i] - mean[i]);
  let best = 0, bestBpm = 120;
  for (let bpm = 70; bpm <= 180; bpm += 0.5) {
    const lag = fps * 60 / bpm, l0 = Math.floor(lag), fr = lag - l0;
    let s = 0;
    for (let i = 0; i + l0 + 1 < n; i++) s += flux[i] * (flux[i + l0] * (1 - fr) + flux[i + l0 + 1] * fr);
    s *= 1 + 0.15 * Math.exp(-(((bpm - 120) / 40) ** 2));   // mild preference for common tempi
    if (s > best) { best = s; bestBpm = bpm; }
  }
  let top = 0, bpmFine = bestBpm, phase = 0;
  for (let bpm = bestBpm - 1.5; bpm <= bestBpm + 1.5; bpm += 0.01) {
    const w = 2 * Math.PI * bpm / 60 / fps;
    let re = 0, im = 0;
    for (let i = 0; i < n; i++) { re += flux[i] * Math.cos(w * i); im -= flux[i] * Math.sin(w * i); }
    const mag = Math.hypot(re, im);
    if (mag > top) { top = mag; bpmFine = bpm; phase = -Math.atan2(im, re) / (2 * Math.PI) * (60 / bpm); }
  }
  const P = 60 / bpmFine;
  return { bpm: Math.round(bpmFine * 100) / 100, phase: ((phase % P) + P) % P };
}

// ------------------------------------------------------------------ cards --
const INK = '#141316', PAPER = '#e9e3d0';
const BOXES = [['#ece6d2', INK], ['#f2b705', INK], ['#e3245d', '#faf7ee'], ['#1d9aa1', '#faf7ee'], [INK, '#faf7ee'], ['#faf7ee', INK]];
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const isLight = hex => { const v = parseInt(hex.slice(1), 16); return ((v >> 16) * .3 + ((v >> 8) & 255) * .59 + (v & 255) * .11) > 140; };

export async function loadCardFonts(lines, fontKey) {
  const f = FONTS[fontKey] || FONTS.gothic;
  await ensureFont(`${f.weight} 100px ${f.family}`, lines.map(l => l.t).join('').replace(/\//g, ''));
}

// {text, kind, img, style: 'sticker'|'simple', font, bg, seed} -> 1920×1080 canvas
export function drawLyricCard({ text, kind, img, style = 'sticker', font = 'gothic', bg = '#111718', seed = 1 }) {
  const W = 1920, H = 1080, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d'), r = rng(seed * 7919 + 13), f = FONTS[font] || FONTS.gothic;
  const chorus = kind === 'chorus';
  const base = chorus ? (isLight(bg) ? INK : PAPER) : bg;   // choruses flip light/dark, like a flyer reprint
  x.fillStyle = base; x.fillRect(0, 0, W, H);
  let area = { x: 0, w: W };
  if (img && style === 'simple') {
    const s = Math.max(W / img.width, H / img.height);
    x.drawImage(img, (W - img.width * s) / 2, (H - img.height * s) / 2, img.width * s, img.height * s);
    x.fillStyle = 'rgba(8,8,10,.55)'; x.fillRect(0, 0, W, H);
  } else if (img && Math.max(...text.split('/').map(l => [...l.trim()].length)) <= 10) {   // paste the photo on one side, a little crooked (short lines only)
    const left = r() < .5, s = Math.min(H * .92 / img.height, W * .3 / img.width), w = img.width * s, h = img.height * s;
    const cx = left ? W * .06 + w / 2 : W * .94 - w / 2;
    x.save(); x.translate(cx, H / 2); x.rotate((r() - .5) * .12);
    x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = 18; x.shadowOffsetY = 8;
    x.drawImage(img, -w / 2, -h / 2, w, h); x.restore();
    area = left ? { x: W * .06 + w, w: W - (W * .06 + w) } : { x: 0, w: W * .94 - w };
  }
  const lines = text.split('/').map(l => l.trim()).filter(Boolean);
  const longest = Math.max(...lines.map(l => [...l].length));
  if (style === 'simple') {
    let fs = Math.min(area.w * .86 / longest, H * .7 / (lines.length * 1.2), 210);
    x.font = `${f.weight} ${fs}px ${f.family}`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = fs * .15;
    x.fillStyle = '#faf7ee';
    lines.forEach((l, i) => x.fillText(l, area.x + area.w / 2, H / 2 + (i - (lines.length - 1) / 2) * fs * 1.2));
    return c;
  }
  const fs = Math.min(area.w * .88 / (longest * 1.08), H * .78 / (lines.length * 1.28), chorus ? 250 : 215);
  let last = -1;
  lines.forEach((l, li) => {
    const chars = [...l], cy = H / 2 + (li - (lines.length - 1) / 2) * fs * 1.28;
    let cx = area.x + area.w / 2 - chars.length * fs * 1.08 / 2 + fs * .54;
    for (const ch of chars) {
      let k;
      do { k = chorus && r() < .45 ? 2 : Math.floor(r() * BOXES.length); } while (k === last || BOXES[k][0] === base);
      last = k;
      const [box, ink] = BOXES[k], sz = fs * (1 + r() * .14), rot = (r() - .5) * .16;
      x.save(); x.translate(cx, cy + (r() - .5) * fs * .12); x.rotate(rot);
      if (!/[、。,.!！?？・\s]/.test(ch)) { x.fillStyle = box; x.fillRect(-sz / 2, -sz / 2, sz, sz); }
      x.fillStyle = /[、。,.]/.test(ch) ? (isLight(base) ? INK : '#faf7ee') : ink;
      x.font = `${f.weight} ${sz * .8}px ${f.family}`; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(ch, 0, sz * .03);
      x.restore();
      cx += fs * 1.08;
    }
  });
  return c;
}

// ----------------------------------------------------------------- layout --
const CALM = ['crumple', 'wave', 'peel', 'fold', 'melt', 'twist', 'snow', 'bubbles', 'ripple', 'blinds', 'dust', 'halftone', 'petals', 'line'];
const LOUD = ['shatter', 'scatter', 'vortex', 'shred', 'mosaic', 'crumple', 'burst', 'glitch', 'wind', 'tornado', 'sparkle', 'flip'];
// Every line arrives as a 3D word exactly when it is sung, then settles into its lyric card.
// -> {slides: [{kind:'image'|'lyric', ...}], transitions, holds (beats)}
export function layoutLyricMV(lines, { bpm, phase = 0, snap = true, transBeats = 4, duration, images = [], seed = 1 }) {
  const B = 60 / bpm, r = rng(seed);
  const snapT = t => snap ? phase + Math.round((t - phase) / (B / 2)) * (B / 2) : t;
  const pick = a => a[Math.floor(r() * a.length)];
  const events = [{ t: 0, slide: { kind: 'image', img: images[0] ?? null } }];
  let imgIdx = 1;
  // instrumental stretches: a new picture every 8 beats so the screen never freezes
  const fill = (from, to, first) => {
    if (!images.length || to - from < 6) return;
    const step = Math.max(8 * B, 3);
    for (let t = first ? from + step : from + .3; t < to - 2.5; t += step) events.push({ t: snapT(t), slide: { kind: 'image', img: images[imgIdx++ % images.length] } });
  };
  if (lines.length) fill(0, lines[0].s, true);
  lines.forEach((l, i) => {
    events.push({ t: snapT(l.s), slide: { kind: 'lyric', text: l.t, k: l.k, img: images.length ? images[(i + 1) % images.length] : null, line: i } });
    const next = lines[i + 1];
    if (l.e != null) fill(Number(l.e), next ? next.s : (duration ?? l.e), false);
  });
  const ts = events.map(e => e.t);
  const end = duration ?? ts[ts.length - 1] + 4;
  const D = ts.map((t, k) => k === 0 ? 0 : Math.min(transBeats * B, .9 * (t - ts[k - 1]), .9 * ((ts[k + 1] ?? end) - t)));
  const holds = ts.map((t, k) => Math.max(0, ((ts[k + 1] ?? end) - (D[k + 1] ?? 0) / 2) - (t + D[k] / 2)) / B);
  let prevMethod = '';
  const transitions = events.slice(1).map((e, k) => {
    const loud = e.slide.k === 'chorus';
    let method;
    do { method = pick(loud ? LOUD : CALM); } while (method === prevMethod);
    prevMethod = method;
    const method2 = r() < .4 ? pick((loud ? LOUD : CALM).filter(m => m !== method)) : '';
    let shape, text = '';
    if (e.slide.kind === 'lyric') { shape = 'text'; text = e.slide.text; }
    else shape = e.slide.img ? 'silB' : pick(['sphere', 'torus', 'star', 'saturn']);
    return { method, method2, shape, text, beats: D[k + 1] / B };
  });
  return { slides: events.map(e => e.slide), transitions, holds };
}
