import {attachWorkshopLink} from './workshop-link.js';
import {imageTarget} from './image-method-target.js';
import {createImageMethodLayer,imageCamera} from './image-method-layer.js';
import {isImageMethodKey,imageFrame,smoothImage} from './image-method-format.js';
import {applyLyricStyle,setWordColor} from './lyric-style.js';
import {cleanLyricSettings,convertLegacyLyrics,lyricTimingFile,lyricTimingDocument} from './lyric-project.js?v=9';
import {createLyricControls} from './lyric-controls.js?v=9';
import {assignLyricMotions,cleanMotion} from './lyric-motion.js?v=26';
import {extractAudioLyrics,createImportGate} from './audio-lyrics.js?v=2';
import {createLyricOverlay} from './lyric-overlay.js?v=8';
import {parseLyrics,importTimedLyrics,resolveUnknown,lyricRuns,SECTION_LABELS,cleanLyricDocument} from './lyric-document.js?v=3';
import {movieDuration,getTimings,moveLyric,createTapSession,trimLyric,lyricPreviewTime} from './lyric-timing.js?v=3';
import {audioBlock} from './lyric-audio-range.js?v=2';
import { cleanShot, rotationAt, blendCameraMove } from './shot-motion.js?v=26';
import { createShotControls } from './shot-motion-controls.js?v=3';
import { cleanRenderLook, applyRenderLook, syncPerspective } from './render-look.js?v=2';
import { createRenderControls } from './render-look-controls.js?v=2';
// UNFOLD SEQUENCE — images unfold into one another: A → crumple → 3D shape → B → … on a beat grid.
import * as THREE from './vendor/three.module.min.js';
import { smooth, vertexShader, particleFragment } from './motion.js?v=26';
import { presetNames, presetTargets } from './shape-presets.js?v=6';
import { createTextShape, validateText } from './text-shape.js?v=9';
import { SceneBlur } from './effects.js?v=29';
import { WebMWriter, opusHead } from './webm-writer.js?v=2';
import { MP4Writer } from './mp4-writer.js?v=1';
import { FONTS, createMaskTextShape, createSilhouetteShape } from './mask-shape.js?v=5';
import { parseTimings, timingsToJSON, detectBeat, drawLyricCard, loadCardFonts, layoutLyricMV } from './lyric-mv.js?v=6';
import { importModel } from './model-import.js?v=10';
import { listModels, getModel, saveModel, deleteModel, updateModel } from './model-library.js?v=4';
import { grainSequenceNote, tileSequenceNote } from './slider-notes.js?v=1';
import { applyTiles, tilesAcross } from './tile-size.js?v=1';
import { ALL, UNGROUPED, cleanGroupName, groupOf, groupSelect, inGroup, loadActive, renderTabs, saveActive, validActive, wantsTabs } from './model-groups.js?v=1';
import { modelThumb, fillMissingThumbs } from './model-thumb.js?v=1';
import { particleParts } from './model-layout.js?v=10';
import { createTimeline } from './timeline.js?v=6';
import { lookView, lookViewText } from './look-view.js?v=1';
import { BUILTIN_KEYS, getCustom, isCustomKey, isUsable, listCustom, methodEntries, methodLabel, newCustomId, onRegistryChange, registerCustom, setCustomStatus, unregisterCustom } from './method-registry.js';
import { compileUserMethod, createVariants } from './custom-method.js';
import { createPersistence, openStore, sourceHash } from './method-library.js';
import { createImageMethodEditor } from './image-method-editor.js';
import { createSafety } from './method-safety.js';
import { createTrial } from './method-trial.js';
import { collectMethods, planImport, registerQuarantined, remapTransitions, validateEmbedded } from './method-project.js?v=10';
import { createEnabler } from './method-verify.js';
import { createQuarantineBanner } from './method-banner.js';
import { downloadMethodFile, exportMethod, importMethodFile, importMethodText, pickMethodFile } from './method-transfer.js';
import { cleanFx, concealAmount, mixFx, swapCurve } from './fx-mix.js';
import { CAM_EASES, CAM_PRESETS, CAM_RANGES, camEnds, camLife, camValues, cleanCam, legacyKenBurns, lifeProgress, mixCam } from './camera-work.js?v=1';
import { openMethodMenu } from './method-menu.js';
import { methodButtons, syncMethodTiles } from './method-tiles.js';
import { registerAsset, imageFromBlob, createHistory, autosave, loadAutosave, clearAutosave, exportFile, importFile, canLinkFile, linkFile, linkedFile, unlinkFile, filePermission, writeLinked } from './project.js?v=9';

const $ = id => document.getElementById(id);
// every method (the built-in ones and the ones users add) is listed in method-registry.js
const BUILTIN = { sphere: '球', torus: 'ドーナツ', helix: 'らせん', mass: '塊', cube: '立方体', heart: 'ハート', star: '星',
  saturn: '土星', mobius: 'メビウスの輪', diamond: 'ダイヤ', flower: '花' };
const BUILTIN_IDS = Object.fromEntries(Object.keys(BUILTIN).map((k, i) => [k, i]));
const PRESET_LABELS = { human: '人', pegasus: 'ペガサス', whale: 'クジラ', dragon: '龍', flock: '鳥の群れ', spheres: '球の群れ（16:9）', apple: 'りんご', icecream: 'アイス' };
const SPECIAL_SHAPES = { text: '立体文字', silB: 'シルエット（次の画像）', silA: 'シルエット（今の画像）', none: '形にしない（崩れるだけ）' };
const FONT_LABELS = { classic: '英字クラシック', ...Object.fromEntries(Object.entries(FONTS).map(([k, f]) => [k, f.label])) };
const CANVAS_W = 1920, CANVAS_H = 1080;
let imageLayers=[],imageInputs=[];
function imageLayerAt(i){return imageLayers[i]??=createImageMethodLayer(renderer,{onReady:()=>{if(!seq.recording)renderAt(seq.t)},onError:e=>notice(e.message)})}
function imageTransition(tr){return tr&&(isImageMethodKey(tr.method)||isImageMethodKey(tr.method2))}
function normalizeImageTransition(tr){if(imageTransition(tr)){tr.flow='return'}}
async function prepareImageFrameAt(sec){renderAt(sec);for(let i=0;i<imageInputs.length;i++)if(imageInputs[i])await imageLayerAt(i).prepare(imageInputs[i]);renderAt(sec)}
const MAX_SAVED_MODELS = 100;   // GLBs kept in this browser (each is a few MB, in IndexedDB)
const SHAPE_ICONS = { sphere: '◉', torus: '◎', helix: '♧', mass: '✧', cube: '▣', heart: '♡', star: '☆', saturn: '♄', mobius: '∞', diamond: '◇', flower: '✿',
  human: '♙', pegasus: '♞', whale: '鯨', dragon: '龍', flock: '鳥', spheres: '⁘', apple: '♧', icecream: '▽', text: '字', silB: '◐', silA: '◑' };

const fragmentShader = `
uniform sampler2D uImage;
uniform sampler2D uImageB;
uniform float uSwap;
varying vec2 vUv;
varying vec3 vPosition;
varying float vForm;
vec4 texAt(vec2 uv){return mix(texture2D(uImage,uv),texture2D(uImageB,uv),uSwap);}
${particleFragment}
void main(){
  vec4 c=particleLook(texAt(vUv));
  if(c.a<0.01)discard;
  vec3 normal=normalize(cross(dFdx(vPosition),dFdy(vPosition)));
  c=glassLook(c,normal);
  float light=surfaceLight(normal);
  c.rgb*=mix(1.,light,vForm);
  gl_FragColor=surfaceAlpha(c);
  #include <colorspace_fragment>
}`;

export const seq = {
  lyricDocument: null, lyricMotion: {bpm:98,phase:0},
  renderLook: cleanRenderLook(),
  slides: [],              // {id, name, img} or {id, name, lyric:{text,k,img,seed}}; canvas/texture are made on demand
  transitions: [],         // {method, method2, shape, text, font, beats}
  lyrics: [],              // [{s, e?, t, k?}] timed lyric lines for the MV builder
  lyricOpts: { style: 'sticker', font: 'gothic', transBeats: 4, snap: true },
  audioBuffer: null, audioOwner: null, audioName: '', withAudio: true, phase: 0, link: false, selection: null,
  fx: { blur: 0, bloom: 0, neon: 0, neonColor: '', glass: 0, chroma: 0, glitch: 0, scan: 0, grain: 0, vignette: 0, bokeh: 0 },
  cam: { persp: 0, kenburns: 0, handheld: 0, tilt: 0, orbit: 0 },
  bpm: 98, holdBeats: 4, offset: 0, bg: '#111718', push: 0.25, pulse: 0.5, strength: 0.8, pullback: 1, formPullback: 1, detail: 1, tiles: .5, depth: 1, fill: true, silSens: 0.5,
  playing: false, t: 0, audio: null, recording: false,
};

let lyricOverlay, lyricControls;
const audioGate=createImportGate();let audioURL='',lyricRevision=0,lyricExtraction=null,lyricStatus='',lyricFontStatus='',lyricTap=null,lyricTapping=false,lyricSelectedId=null;let lyricPreviewStop=null;
let renderer, scene, camera, perspCam, mesh, sceneBlur, backdrop, variants, methodEditor, methodPersistence, safety, methodTrial, methodEnabler, quarantineBanner;   // backdrop: the next picture held still behind a "reveal" change
const geoCache = new Map();   // shape key -> geometry
const savedModels = new Map();
let activeGroup = loadActive('unfold-glb-tab');   // the GLB tab in use (shared by the shape menu and the library list)
function setActiveGroup(g) { activeGroup = g; saveActive('unfold-glb-tab', g); renderModelLibrary(); refreshUI(); }
const pending = new Set();    // shape keys being built
let slideSerial = 0;
let planeW, planeH;
const shotAxis=new THREE.Vector3(),shotQuat=new THREE.Quaternion();

// --------------------------------------------------------------- slides --
function fitCanvas(img, bg) {
  const c = document.createElement('canvas');
  c.width = CANVAS_W; c.height = CANVAS_H;
  const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height);
  const s = (seq.fill ? Math.max : Math.min)(c.width / img.width, c.height / img.height);
  const w = img.width * s, h = img.height * s;
  x.drawImage(img, (c.width - w) / 2, (c.height - h) / 2, w, h);
  return c;
}
function makeTexture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export async function addImageFromUrl(url, name) {
  const blob = await (await fetch(url)).blob();
  return addImageBlob(blob, name || url.split('/').pop());
}
async function imageOf(blob) { const img = await imageFromBlob(blob); registerAsset(img, blob); return img; }
export async function addImageBlob(blob, name) { addSlide(await imageOf(blob), name); }
function newTransition(i) {
  const shapes = Object.keys(BUILTIN);
  return { method: BUILTIN_KEYS[i % BUILTIN_KEYS.length], shape: shapes[i % shapes.length], method2: '', text: '', font: 'gothic', beats: 8, viewX: 0, viewY: 0 };
}
export function addSlide(img, name) {
  seq.slides.push({ id: ++slideSerial, name, img });
  while (seq.transitions.length < seq.slides.length - 1) seq.transitions.push(newTransition(seq.transitions.length));
  refreshUI();
}
function dropTexture(s) { s.texture?.dispose(); s.texture = s.canvas = null; }
function rebuildBackgrounds() { seq.slides.forEach(dropTexture); }
const liveCards = [];   // lyric cards are big: keep only the few near the playhead on the GPU
function slideCanvas(s) {
  if (!s.canvas) {
    s.canvas = s.lyric ? drawLyricCard({ ...seq.lyricOpts, text: s.lyric.text, kind: s.lyric.k, img: s.lyric.img, seed: s.lyric.seed, bg: seq.bg })
      : fitCanvas(s.img, seq.bg);
  }
  return s.canvas;
}
function slideTexture(s) {
  if (!s.texture) s.texture = makeTexture(slideCanvas(s));
  if (s.lyric) {
    const k = liveCards.indexOf(s);
    if (k >= 0) liveCards.splice(k, 1);
    liveCards.push(s);
    while (liveCards.length > 8) dropTexture(liveCards.shift());
  }
  return s.texture;
}

// -------------------------------------------------------------- geometry --
function gridGeometry(targets) {
  const positions = [], uvs = [], cells = [], parts = [];
  const tiles = 16, sub = 5, w = planeW, h = planeH;
  for (let cy = 0; cy < tiles; cy++) for (let cx = 0; cx < tiles; cx++) for (let sy = 0; sy < sub; sy++) for (let sx = 0; sx < sub; sx++) {
    const u = (cx + sx / sub) / tiles, v = (cy + sy / sub) / tiles, step = 1 / (tiles * sub);
    for (const [du, dv] of [[0, 0], [1, 0], [0, 1], [1, 0], [1, 1], [0, 1]]) {
      const a = u + du * step, b = v + dv * step;
      positions.push((a - .5) * w, (b - .5) * h, 0); uvs.push(a, b); cells.push((cx + .5) / tiles, (cy + .5) / tiles);
      parts.push(u + step / 2, v + step / 2, du, dv);   // every small quad is one particle
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute('cell', new THREE.Float32BufferAttribute(cells, 2));
  g.setAttribute('part', new THREE.Float32BufferAttribute(parts, 4));
  g.setAttribute('targetPosition', new THREE.BufferAttribute(targets, 3));
  applyTiles(THREE, g, tilesAcross(seq.tiles));
  return g;
}
function customGeometry(data) {
  const g = new THREE.BufferGeometry(), positions = new Float32Array(data.target.length);
  for (let i = 0; i < data.uv.length / 2; i++) {
    positions[i * 3] = (data.uv[i * 2] - .5) * planeW;
    positions[i * 3 + 1] = (data.uv[i * 2 + 1] - .5) * planeH;
  }
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(data.uv, 2));
  g.setAttribute('cell', new THREE.BufferAttribute(data.cell, 2));
  g.setAttribute('part', new THREE.BufferAttribute(particleParts(data, seq.detail), 4));
  g.setAttribute('targetPosition', new THREE.BufferAttribute(data.target, 3));
  g.userData.layout = data;
  applyTiles(THREE, g, tilesAcross(seq.tiles));
  return g;
}
// grain size of added shapes in the particle methods: only the grouping of faces changes, never the solid itself
function applyParticleDetail() {
  for (const g of geoCache.values()) if (g.userData.layout) g.setAttribute('part', new THREE.BufferAttribute(particleParts(g.userData.layout, seq.detail), 4));
}
// the grain and tile sliders only reach some methods (and, for grain, some shapes): say so beside them, with how many ◆ they reach now
let sliderNotes = '';
function updateSliderNotes() {
  const grain = $('seq-detail-note'), tile = $('seq-tiles-note');
  if (!grain || !tile) return;
  const items = seq.transitions.slice(0, Math.max(0, seq.slides.length - 1)).map(tr => ({
    method: tr.method, method2: tr.method2, shapeHasGrain: savedModels.has(tr.shape) || ['text', 'silA', 'silB'].includes(tr.shape),
  }));
  const g = grainSequenceNote(items).text, t = tileSequenceNote(items, seq.tiles).text;
  if (g + '\n' + t !== sliderNotes) { sliderNotes = g + '\n' + t; grain.textContent = g; tile.textContent = t; }
}
// tile size of the tile methods (ばらばら・砕ける…): regroup the faces of every shape we hold
function applyTileSize() {
  const n = tilesAcross(seq.tiles);
  for (const g of geoCache.values()) applyTiles(THREE, g, n);
}
const isFlatShape = tr => tr && ['text', 'silA', 'silB'].includes(tr.shape);   // faces the camera: wobble, no full turn
function textFont(tr) {
  const font = tr.font || 'gothic';
  return font === 'classic' && /[^\x20-\x7e]/.test(tr.text || '') ? 'gothic' : font;   // Japanese needs a Japanese font
}
function silSlide(tr, i) { return seq.slides[tr.shape === 'silA' ? i : i + 1]; }
function shapeKey(tr, i) {
  if (tr.shape === 'text') return `text:${textFont(tr)}:${tr.text || 'UNFOLD'}`;
  if (tr.shape === 'silA' || tr.shape === 'silB') return `sil:${silSlide(tr, i)?.id}:${seq.silSens}`;
  if (tr.shape === 'none') return 'sphere';
  if (tr.orderedPicture === true && savedModels.has(tr.shape)) return `${tr.shape}:ordered`;   // a GLB with the picture laid on by position
  return tr.shape;
}
async function ensureShape(tr, i) {
  const key = shapeKey(tr, i);
  if (geoCache.has(key)) return;
  if (savedModels.has(tr.shape)) {
    const record = await getModel(tr.shape);
    if (!record) throw new Error('保存したGLBが見つかりません。');
    geoCache.set(key, customGeometry(await importModel(record.buffer, { ordered: tr.orderedPicture === true })));
  } else if (tr.shape === 'text') {
    const font = textFont(tr), text = tr.text || 'UNFOLD';
    const data = font === 'classic' ? await createTextShape(validateText(text)) : await createMaskTextShape(text, font);
    geoCache.set(key, customGeometry(data));
  } else if (tr.shape === 'silA' || tr.shape === 'silB') {
    const slide = silSlide(tr, i);
    if (!slide) return;
    const src = slide.img || slide.lyric?.img || slideCanvas(slide);
    const iw = src.naturalWidth || src.width, ih = src.naturalHeight || src.height;
    const sc = Math.min(CANVAS_W / iw, CANVAS_H / ih), dw = iw * sc / CANVAS_W, dh = ih * sc / CANVAS_H;
    const place = { x: -dw / 2 * planeW, y: dh / 2 * planeH, w: dw * planeW, h: dh * planeH };
    geoCache.set(key, customGeometry(createSilhouetteShape(src, seq.silSens, place)));
  } else {
    geoCache.set(key, gridGeometry(presetTargets(tr.shape)));
  }
}
export async function prepareShapes() {
  for (let i = 0; i < seq.slides.length - 1; i++) await ensureShape(seq.transitions[i], i);
}
function dropSilhouettes() {
  for (const [k, g] of geoCache) if (k.startsWith('sil:')) { g.dispose(); geoCache.delete(k); }
}
export function shuffleTransitions() {
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const shapes = [...Object.keys(BUILTIN), ...presetNames, ...savedModels.keys()];
  seq.transitions.forEach((tr, i) => {
    const prev = seq.transitions[i - 1];
    do { tr.method = pick(BUILTIN_KEYS); } while (prev && tr.method === prev.method);
    if (!['text', 'silA', 'silB'].includes(tr.shape)) do { tr.shape = pick(shapes); } while (prev && tr.shape === prev.shape);
    tr.method2 = Math.random() < .45 ? pick(BUILTIN_KEYS.filter(k => k !== tr.method)) : '';
  });
}

// -------------------------------------------------------------- timeline --
const beatSec = () => 60 / seq.bpm;
function backgroundSeconds() {
  if (!seq.slides.length) return 0;
  const beats = seq.slides.reduce((a, s) => a + (s.hold ?? seq.holdBeats), 0) + seq.transitions.slice(0, seq.slides.length - 1).reduce((a, t) => a + t.beats, 0);
  return beats * beatSec();
}
export function totalSeconds(){return movieDuration({document:seq.lyricDocument,audioDuration:seq.audioBuffer?.duration||0,offset:seq.offset,backgroundDuration:backgroundSeconds()});}
async function prepareDocumentFont(){const doc=seq.lyricDocument;try{await lyricOverlay?.prepare(doc);if(doc!==seq.lyricDocument)return;lyricFontStatus='';if(!seq.recording)renderAt(seq.t)}catch(e){if(doc!==seq.lyricDocument)return;lyricFontStatus=e.message}lyricControls?.refresh()}
export function setLyricDocument(doc,{fromTap=false}={}){if(seq.recording)return;if(!fromTap){if(lyricTapping)stopPlay();lyricTap=null;lyricTapping=false;}seq.lyricDocument=cleanLyricDocument(doc);seq.t=Math.min(seq.t,totalSeconds());refreshUI();prepareDocumentFont();}
function drawLyrics(sec){lyricOverlay?.render(seq.lyricDocument,sec+seq.offset,{duration:seq.audioBuffer?.duration||12,bpm:seq.lyricMotion.bpm,width:renderer.domElement.width,height:renderer.domElement.height});}
function locate(sec) {
  // -> {i: slide index shown (or from), tr: transition index or -1, u: 0..1 inside transition, beat}
  const B = beatSec();
  let b = sec / B;
  const n = seq.slides.length;
  for (let i = 0; i < n; i++) {
    const hold = seq.slides[i].hold ?? seq.holdBeats;
    if (b < hold || i === n - 1) return { i, tr: -1, u: 0, beat: sec / B };
    b -= hold;
    const tb = seq.transitions[i].beats;
    if (b < tb) return { i, tr: i, u: b / tb, beat: sec / B };
    b -= tb;
  }
  return { i: n - 1, tr: -1, u: 0, beat: sec / B };
}
function curves(u) {
  const out = 1 - smooth(.70, .96, u);
  return {
    distort: smooth(.0, .28, u) * out,
    form: smooth(.20, .45, u) * (1 - smooth(.60, .86, u)),
    conceal: smooth(.03, .18, u) * (1 - smooth(.82, .97, u)),
    swap: smooth(.46, .54, u),
    spin: smooth(.24, .80, u),
  };
}

// ---------------------------------------------------------------- render --
function setMaterialTextures(a, b) {
  const u = mesh.material.uniforms;
  u.uImage.value = slideTexture(a); u.uImageB.value = slideTexture(b || a);
}
export function renderAt(sec) {
  const videoSec=sec;imageInputs=[];
  if (!seq.slides.length) { imageLayers.forEach(l=>l.reset());renderer.setClearColor(seq.bg, 1); renderer.clear(); drawLyrics(videoSec); if(!seq.recording)updateTransport(videoSec,{i:-1,tr:-1,u:0});return; }
  sec=Math.min(sec,backgroundSeconds());
  const L = locate(sec);
  const u = mesh.material.uniforms;
  let c = { distort: 0, form: 0, conceal: 0, swap: 0, spin: 0 };
  let tr = null;
  if (L.tr >= 0) { tr = seq.transitions[L.tr]; c = curves(L.u); }
  const imageCode=imageTransition(tr);if(tr?.shape === 'none')c.form=0;
  // no solid + "pass through": one gesture — A breaks away, B flies in from the other side (no pause in the middle)
  const flow = imageCode?'return':tr?.shape === 'none' ? (tr.flow ?? 'through') : '';
  const through = flow === 'through', reveal = flow === 'reveal';
  if (reveal) {   // only the current picture breaks away; the next one waits untouched underneath
    c.distort = smooth(0, .9, L.u);
    c.conceal = 0; c.swap = 0;
  }
  if (through) {
    const u2 = L.u;
    c.distort = smooth(0, .5, u2) * (1 - smooth(.5, 1, u2));
    c.conceal = smooth(.03, .2, u2) * (1 - smooth(.8, .97, u2));
    c.swap = u2 < .5 ? 0 : 1;
  }
  if (tr && tr.shape !== 'none') c.swap = swapCurve(tr, L.u, c.swap);   // a ◆ can keep the solid the first picture (lateSwap)
  const key = tr ? shapeKey(tr, L.tr) : 'sphere';
  let geo = geoCache.get(key);
  if (!geo) {   // still being built: show the sphere grid meanwhile
    geo = geoCache.get('sphere');
    if (tr && !pending.has(key)) { pending.add(key); safeEnsure(tr, L.tr).finally(() => { pending.delete(key); if (!seq.playing) renderAt(seq.t); }); }
  }
  if (mesh.geometry !== geo) mesh.geometry = geo;
  setMaterialTextures(seq.slides[L.i], tr ? seq.slides[L.i + 1] : null);
  const isText = isFlatShape(tr);
  const isPreset = tr && (presetNames.includes(tr.shape) || savedModels.has(tr.shape) || isText);
  u.uTime.value = sec;
  u.uThrough.value = through && L.u >= .5 ? 1 : 0;
  u.uFade.value = through ? smooth(0, .045, Math.abs(L.u - .5)) : reveal ? 1 - smooth(.72, .98, L.u) : 1;
  if (reveal) u.uDraw.value = 1 - smooth(.05, .85, L.u);
  backdrop.visible = reveal;
  if (reveal) backdrop.material.map = slideTexture(seq.slides[L.i + 1]);
  u.uDraw.value = !tr ? 1 : L.u < .5 ? 1 - smooth(.06, .44, L.u) : smooth(.56, .94, L.u);
  u.uDistort.value = c.distort; u.uForm.value = c.form; u.uStrength.value = seq.strength; u.uDepth.value = seq.depth;
  // custom methods have their own shader: swap it in (uniforms are shared, so `u` stays valid)
  const firstJS=isImageMethodKey(tr?.method),secondJS=isImageMethodKey(tr?.method2);
  const pick = imageCode?variants.pick(firstJS?(secondJS?'':tr?.method2):tr?.method):variants.pick(tr ? tr.method : '', tr?.method2 || '');
  if(imageCode&&firstJS&&(!tr.method2||secondJS))u.uDistort.value=0;
  if (mesh.material !== pick.material) mesh.material = pick.material;
  safety.beforeDraw(pick.used);
  u.uSeed.value = 28 + (L.tr >= 0 ? L.tr * 37 : 0); u.uMethod.value = pick.uMethod;
  u.uMethod2.value = pick.uMethod2; u.uMethodMix.value = imageCode?0:tr?.method2 ? smooth(.30, .62, L.u) : 0;
  u.uShape.value = tr && BUILTIN_IDS[tr.shape] !== undefined ? BUILTIN_IDS[tr.shape] : 0;
  u.uPreset.value = isPreset ? 1 : 0; u.uProject.value = isText ? 1 : 0; u.uConceal.value = imageCode?0:concealAmount(tr, c.conceal); u.uSwap.value = c.swap;
  // full turn ends at identity; flat words only wobble, and without a solid there is nothing to turn
  const turn = tr?.shape === 'none' ? 0 : isText ? 0.18 * Math.sin(c.spin * Math.PI * 2) : c.spin * Math.PI * 2;
  const shot=cleanShot(tr?.shot);
  const cm = seq.cam,orientation=imageCode&&tr.shape==='none'?c.distort:c.form;
  mesh.rotation.set((-.16 + (tr?.viewX || 0) - cm.orbit * .45) * c.form,
    (isPreset && !isText ? .2 : .35) * c.form + turn + (tr?.viewY || 0) * c.form + (tr ? cm.orbit * 2.2 * (L.u - .5) * c.form : 0), 0);
  const spin=tr&&(tr.shape!=='none'||imageCode)?rotationAt(shot.rotation,L.u,'sequence'):null;
  if(spin){mesh.rotation.set((tr.viewX||0)*orientation,(tr.viewY||0)*orientation,0);mesh.quaternion.premultiply(shotQuat.setFromAxisAngle(shotAxis.fromArray(spin.axis),spin.angle));}
  // camera: push-in with the shape, a pulse on every beat while it is 3D
  const bp = (sec + seq.offset - seq.phase) / beatSec(), frac = bp - Math.floor(bp);
  const beatKick = Math.exp(-frac * 7) * seq.pulse * (c.distort > 0.02 ? 1 : 0);
  // flat images fill the frame edge to edge (or sit at 1× when "画面いっぱい" is off);
  // while torn up / 3D the camera goes to the zoom the two "引き" sliders ask for: 0% = frame-filling, 100% = 1×
  const fullZoom = Math.max((camera.right - camera.left) / planeW, (camera.top - camera.bottom) / planeH);
  const flatZoom = seq.fill ? fullZoom : 1;
  const pull = seq.pullback * (1 - c.form) + seq.formPullback * c.form;   // hands over to the 3D setting as the solid forms
  const loose = reveal ? 0 : Math.max(c.distort, c.form);   // a reveal keeps the frame still so the next picture sits exactly in place
  camera.zoom = flatZoom + (1 + (fullZoom - 1) * (1 - pull) - flatZoom) * loose + seq.push * c.form + 0.06 * beatKick;
  // camera work: slow Ken Burns drift per picture (or a picture's own camera), handheld wobble, a lazy tilt
  const shotBaseZoom=camera.zoom;
  const own = ownCamera(L, sec, tr);
  if (own) {   // a picture has its own camera: it moves the frame as a whole, so it eases off while a solid is on screen (a big zoom would cut the solid off)
    camera.zoom *= 1 + (own.zoom - 1) * (1 - c.form);
    camera.position.x = own.x * planeW + cm.handheld * .05 * (Math.sin(sec * 1.7) + .5 * Math.sin(sec * 2.9 + 1));
    camera.position.y = own.y * planeH + cm.handheld * .04 * (Math.sin(sec * 1.3 + .7) + .5 * Math.sin(sec * 3.1));
    camera.rotation.z = own.roll * (1 - c.form) * Math.PI / 180 + cm.handheld * .012 * Math.sin(sec * 1.1) + cm.tilt * .1 * Math.sin(sec * .45);
  } else {
    const kb = kenBurns(L, sec);
    camera.zoom *= kb.zoom;
    camera.position.x = kb.x + cm.handheld * .05 * (Math.sin(sec * 1.7) + .5 * Math.sin(sec * 2.9 + 1));
    camera.position.y = cm.handheld * .04 * (Math.sin(sec * 1.3 + .7) + .5 * Math.sin(sec * 3.1));
    camera.rotation.z = cm.handheld * .012 * Math.sin(sec * 1.1) + cm.tilt * .1 * Math.sin(sec * .45);
  }
  if(tr){const move=blendCameraMove({x:camera.position.x,y:camera.position.y,zoom:camera.zoom,roll:camera.rotation.z},shot.camera,L.u,{width:planeW,height:planeH,zoom:shotBaseZoom});
    camera.zoom=move.zoom;camera.position.x=move.x;camera.position.y=move.y;camera.rotation.z=move.roll;}
  camera.updateProjectionMatrix();
  const view = perspective(reveal);
  renderer.setClearColor(seq.bg, 1);
  // effects: the global look, each picture's own look (flowing from one to the next across a ◆), then this ◆'s own settings while it is breaking up / solid
  const env = tr ? Math.max(c.distort, c.form) : 0;
  const fx = mixFx(FX_KEYS, { global: seq.fx, from: seq.slides[L.i].fx, to: tr ? (seq.slides[L.i + 1]?.fx ?? {}) : null, trFx: tr?.fx, u: L.u, env, late: tr?.lateSwap === true && tr.shape !== 'none' });
  applyRenderLook(u, seq.renderLook);
  u.uGlass.value = imageCode?0:fx.glass;
  sceneBlur.render(scene, view, imageCode?0:fx.blur, imageCode?0:fx.glitch, imageCode?0:fx.chroma, sec, imageCode?{}:{ ...fx, neonColor: seq.fx.neonColor });
  if(imageCode){
   const duration=tr.beats*beatSec(),f=imageFrame(L.u*duration,duration,seq.strength,{form:c.form}),mix=tr.method2?smooth(.30,.62,L.u):0,fade=smoothImage(L.u/.025)*smoothImage((1-L.u)/.025),keys=[tr.method,tr.method2];
   for(let i=0;i<2;i++){if(isImageMethodKey(keys[i])){const input={target:tr.shape!=='none'?imageTarget(geo,{shape:tr.shape,preset:!!isPreset,project:!!isText}):null,id:keys[i],imageA:slideCanvas(seq.slides[L.i]),imageB:slideCanvas(seq.slides[L.i+1]),size:{width:planeW,height:planeH},frame:{...f,imageMix:tr.shape!=='none'?c.swap:f.imageMix,depth:seq.depth,seed:u.uSeed.value,width:renderer.domElement.width,height:renderer.domElement.height,bg:seq.bg,camera:imageCamera(view),rootQuaternion:mesh.quaternion.toArray()}};imageInputs[i]=input;const weight=i===0?(secondJS?1:1-mix):mix;if(fade*weight>0&&(seq.strength>0||c.form>0))imageLayerAt(i).draw(input,fade*weight)}else imageLayers[i]?.reset()}
  }else imageLayers.forEach(l=>l.reset());
  drawLyrics(videoSec);
  safety.afterDraw();
  if (!seq.recording) updateTransport(videoSec, L);
}
const FX_KEYS = ['blur', 'bloom', 'neon', 'glass', 'chroma', 'glitch', 'scan', 'grain', 'vignette', 'bokeh'];
// a ◆ from a file (or an old autosave) with its own effects cleaned: known settings only, real numbers between 0 and 1
function withCleanFx(tr) {
  if (!tr || typeof tr !== 'object') return tr;
  const { fx, mixTiles, lateSwap, orderedPicture, shot, ...rest } = tr, own = cleanFx(fx, FX_KEYS);
  if(shot)rest.shot=cleanShot(shot);
  if (mixTiles === false) rest.mixTiles = false;
  if (lateSwap === true) rest.lateSwap = true;
  if (orderedPicture === true) rest.orderedPicture = true;
  return own ? { ...rest, fx: own } : rest;
}
// Ken Burns: each picture slowly zooms in (or out) and drifts while it is shown; during a change the move hands over smoothly
function kenBurns(L, sec) {
  const k = seq.cam.kenburns;
  if (!k) return { zoom: 1, x: 0 };
  const lay = layoutTimes();
  const at = (i, p) => legacyKenBurns(i, p, k);
  const prog = i => { const s = lay.slides[i]; return s && s.end > s.start ? Math.min(1, Math.max(0, (sec - s.start) / (s.end - s.start))) : 1; };
  if (L.tr < 0) return at(L.i, prog(L.i));
  const a = at(L.i, 1), b = at(L.i + 1, 0), w = smooth(0, 1, L.u);
  return { zoom: a.zoom + (b.zoom - a.zoom) * w, x: a.x + (b.x - a.x) * w };
}
// A picture's own camera (see camera-work.js). Null when neither the picture shown nor the next one has one: then the global Ken Burns above rules,
// exactly as before. The move runs from the time the picture arrives to when it starts to break up, and hands over to the next picture's camera
// when the pictures swap (a punch-in right then is how a "zoom-out reveal" starts).
function ownCamera(L, sec, tr) {
  const a = seq.slides[L.i], b = tr ? seq.slides[L.i + 1] : null;
  if (!a?.cam && !b?.cam) return null;
  const lay = layoutTimes(), n = seq.slides.length;
  const k = seq.cam.kenburns;
  const at = (i, s) => {
    if (s.cam) { const life = camLife(i, n, lay, seq.transitions); return camValues(s.cam, lifeProgress(sec, life, s.cam)); }
    const slide = lay.slides[i], p = tr ? (i === L.i ? 1 : 0) : (slide && slide.end > slide.start ? Math.min(1, Math.max(0, (sec - slide.start) / (slide.end - slide.start))) : 1);
    const kb = k ? legacyKenBurns(i, p, k) : { zoom: 1, x: 0 };
    return { zoom: kb.zoom, x: kb.x / planeW, y: 0, roll: 0 };
  };
  const va = at(L.i, a);
  if (!tr) return va;
  const late = tr.lateSwap === true && tr.shape !== 'none';
  const w = late ? smooth(.72, .80, L.u) : smooth(.35, .65, L.u);   // the pictures' own swap timing (pictureWeight)
  return mixCam(va, at(L.i + 1, b), w);
}
// "遠近感": a perspective camera placed so the picture plane (z = 0) frames exactly like the flat camera
function perspective(reveal) {
  const k = seq.renderLook.enabled ? seq.renderLook.perspective : seq.cam.persp;
  backdrop.scale.set(1, 1, 1);
  if (!k) return camera;
  syncPerspective(camera, perspCam, k);
  const d = perspCam.position.z;
  if (reveal) { const sc = (d + 4) / d; backdrop.scale.set(sc, sc, 1); }   // the still picture sits behind: scale it back to full frame
  return perspCam;
}
function updateTransport(sec, L) {
  const total = totalSeconds();
  $('seq-time').textContent = `${sec.toFixed(2)} / ${total.toFixed(2)} s`;
  $('seq-scrub').value = total ? Math.round(sec / total * 1000) : 0;
  $('seq-phase').textContent = L.tr >= 0 ? `${L.i + 1} → ${L.i + 2}　${methodLabel(seq.transitions[L.tr].method)} / ${shapeLabel(seq.transitions[L.tr])}` : `${L.i + 1} / ${seq.slides.length}`;
  const ph = phaseOf(L);
  if (ph) $('seq-phase').append(Object.assign(document.createElement('span'), { className: 'phase-chip ' + ph, textContent: imageTransition(seq.transitions[L.tr])&&seq.transitions[L.tr].shape==='none'?'コード演出':PHASE_LABELS[ph] }));
  lookPhase = ph;
  applyLookView();
  updateInspectorWhere();
}
// which part of a change is on screen — the same colours as the timeline bands and the two "引き" sliders
const PHASE_LABELS = { chaos: 'ぐちゃぐちゃ', form: '立体化' };
const PHASE_BANDS = [['chaos', 0, 32.5], ['form', 32.5, 73], ['chaos', 73, 83]];   // where curves() has form / distort above half
function phaseOf(L) {
  if (L.tr < 0) return null;
  if (seq.transitions[L.tr].shape === 'none') return L.u > .03 && L.u < .97 ? 'chaos' : null;
  const u = L.u * 100;
  return PHASE_BANDS.find(([, a, b]) => u >= a && u < b)?.[0] || null;
}
// the 04 見た目 tab shows only what works where the playhead is (docs/superpowers/specs/2026-10-02-phase-filtered-look-tab-design.md).
// lookMode is not saved: reopening starts in 'auto'.
let lookMode = 'auto', lookPhase = null, lookDragging = false;
function applyLookView() {
  const pane = $('pane-look');
  // never change the panel during playback or while a control in it is held
  if (!pane || seq.playing || lookDragging) return;
  const view = lookView(lookMode, lookPhase), { label, hint } = lookViewText(view);
  pane.dataset.view = view;
  $('look-view-label').textContent = label;
  $('look-view-hint').textContent = hint;
  for (const b of document.querySelectorAll('#look-mode [data-mode]')) b.setAttribute('aria-pressed', String(b.dataset.mode === lookMode));
}
function shapeLabel(tr) {
  if (tr.shape === 'none') return { through: '立体化なし・通り抜け', reveal: '立体化なし・吹き飛んで次が現れる', return: '立体化なし・行って戻る' }[tr.flow ?? 'through'];
  return tr.shape === 'text' ? `文字「${tr.text}」` : savedModels.get(tr.shape)?.name || BUILTIN[tr.shape] || PRESET_LABELS[tr.shape] || tr.shape;
}

function renderModelLibrary() {
  const list = $('seq-model-list'), all = [...savedModels.values()];
  const active = validActive(all, activeGroup);
  $('seq-model-tabs').replaceChildren(...(wantsTabs(all) ? [renderTabs(all, active, setActiveGroup)] : []));
  list.replaceChildren(...all.filter(m => inGroup(m, active)).map(model => {
    const row = document.createElement('div'); row.className = 'saved-model';
    const name = document.createElement('span'); name.textContent = model.name;
    if (model.thumb) row.append(Object.assign(document.createElement('img'), { src: model.thumb, alt: '' }));
    const remove = document.createElement('button'); remove.className = 'btn'; remove.textContent = '削除';
    remove.setAttribute('aria-label', `${model.name}を削除`);
    remove.onclick = async () => {
      try { await deleteModel(model.id); savedModels.delete(model.id);
        const geo = geoCache.get(model.id); geo?.dispose(); geoCache.delete(model.id);
        seq.transitions.forEach(tr => { if (tr.shape === model.id) tr.shape = 'sphere'; });
        renderModelLibrary(); refreshUI(); notice('保存したGLBを削除しました。');
      } catch (e) { notice('GLBを削除できませんでした。'); }
    };
    const grp = groupSelect(all, groupOf(model), async g => {
      try { await updateModel(model.id, { group: g }); model.group = g; renderModelLibrary(); refreshUI(); }
      catch (e) { notice('グループを変えられませんでした。'); renderModelLibrary(); }
    });
    row.append(name, grp, remove); return row;
  }));
  $('seq-model-status').textContent = savedModels.size ? `保存済み ${savedModels.size}個。画像の下にある形メニューから選べます。` : '追加したGLBはこのブラウザに保存され、1枚モードでも使えます。';
}
async function loadModelLibrary() {
  try { for (const model of await listModels()) savedModels.set(model.id, model); renderModelLibrary(); refreshUI();
    fillMissingThumbs([...savedModels.values()], () => { renderModelLibrary(); refreshUI(); }); }
  catch (e) { $('seq-model-status').textContent = '保存したGLBを読み込めませんでした。'; }
}
async function importSequenceModel(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.glb')) { notice('GLB形式を選んでね。'); return; }
  if (file.size > 50 * 1024 * 1024) { notice('50 MB以下のGLBを選んでね。'); return; }
  if (savedModels.size >= MAX_SAVED_MODELS) { notice(`保存できるGLBは${MAX_SAVED_MODELS}個までです。使わないGLBを削除してね。`); return false; }
  const button = $('seq-model-add'); button.disabled = true;
  $('seq-model-status').textContent = 'GLBを読み込み、保存中…';
  try {
    const buffer = await file.arrayBuffer();
    const data = await importModel(buffer);
    let thumb = ''; try { thumb = modelThumb(data.target); } catch (e) { console.warn('thumbnail:', e); }
    const tab = validActive([...savedModels.values()], activeGroup), group = tab === ALL || tab === UNGROUPED ? '' : tab;   // a new GLB joins the tab you are looking at
    const model = await saveModel(file.name.replace(/\.glb$/i, ''), buffer, data.originalTriangles, thumb, group);
    savedModels.set(model.id, model); geoCache.set(model.id, customGeometry(data));
    renderModelLibrary(); refreshUI(); notice('GLBを保存したよ。形メニューから選んでね。'); return true;
  } catch (e) { console.error(e); $('seq-model-status').textContent = e.message || 'GLBを追加できませんでした。'; notice(e.message || 'GLBを追加できませんでした。'); }
  finally { button.disabled = false; $('seq-model-input').value = ''; }
}
// several GLBs at once: one after the other (each one is parsed and saved before the next)
async function importSequenceModels(files) {
  let saved = 0;
  for (const f of files) { const ok = await importSequenceModel(f); if (ok === false) break; if (ok) saved++; }
  if (files.length > 1) notice(`GLBを${saved}個保存したよ（選んだのは${files.length}個）。`);
}

// ---------------------------------------------------------------- output --
function sizeFor(q) { return [Math.round(q * 16 / 9 / 2) * 2, q]; }
function resize() {
  if (seq.recording || !$('seq-stage')) return;
  const r = $('seq-stage').getBoundingClientRect();
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(r.width, r.height, false);
  setCamera(r.width / r.height);
  renderAt(seq.t);
}
function setCamera(aspect) {
  const height = Math.max(3.8, 6.8 / aspect * 0.75);
  camera.left = -height * aspect / 2; camera.right = height * aspect / 2; camera.top = height / 2; camera.bottom = -height / 2;
  camera.updateProjectionMatrix();
}

// std = one pass at the output size (as before); high / max draw at 2× and shrink, so fine grains and edges stay crisp, with a higher bitrate
const EXPORT_LOOKS = { std: { ss: 1, bpp: 0 }, high: { ss: 2, bpp: .5 }, max: { ss: 2, bpp: .8 } };
// format: 'webm' (VP9/VP8 + Opus) or 'mp4' (H.264 + AAC — plays in QuickTime, iPhone and most editors)
export async function exportVideo({ fps = 30, quality = 1080, look = 'high', format = 'webm', from = 0, to = null, onProgress, signal } = {}) {
  if (!('VideoEncoder' in window)) throw new Error('このブラウザは WebCodecs に対応していません（Chrome で開いてね）');
  signal?.throwIfAborted();
  if(seq.recording)throw new Error('書き出し中です。');
  seq.recording=true;lyricControls?.refresh();
  try {
  await lyricOverlay?.prepare(seq.lyricDocument);
  await variants.ready();      // a custom method that is still compiling would be exported as the default method
  if(seq.transitions.some(tr=>[tr.method,tr.method2].some(k=>isImageMethodKey(k)&&!isUsable(k))))throw Error('未確認・停止中の画像コードがあります。編集画面でプレビューして保存してください。');
  const switchedOff = seq.transitions.filter(tr => [tr.method, tr.method2].some(k => k && isCustomKey(k) && !isUsable(k))).length;
  if (switchedOff) notice(`止まっている自作メソッドを使う◆が${switchedOff}か所あります。「くしゃくしゃ」で書き出します。`);
  await prepareShapes();
  const [w, h] = sizeFor(quality);
  const end = to ?? totalSeconds();
  const mp4 = format === 'mp4';
  const L = EXPORT_LOOKS[look] || EXPORT_LOOKS.high;
  const base = { width: w, height: h, bitrate: L.bpp ? Math.round(w * h * fps * L.bpp) : w * h > 1e6 ? 16e6 : 8e6, framerate: fps, latencyMode: 'quality' };
  let codec, mkv;
  if (mp4) {
    // High profile first (level 4.2 covers 1080p60), then simpler profiles
    for (const c of ['avc1.64002A', 'avc1.640033', 'avc1.4D402A', 'avc1.42E02A'])
      if ((await VideoEncoder.isConfigSupported({ ...base, codec: c, avc: { format: 'avc' } })).supported) { codec = c; break; }
    if (!codec) throw new Error('このブラウザはMP4（H.264）の書き出しに対応していません。WebMを選んでね。');
    base.avc = { format: 'avc' };
  } else {
    codec = 'vp09.00.40.08'; mkv = 'V_VP9';
    if (!(await VideoEncoder.isConfigSupported({ ...base, codec })).supported) { codec = 'vp8'; mkv = 'V_VP8'; }
  }
  const audio = seq.withAudio && seq.audioBuffer && 'AudioEncoder' in window ? await encodeAudio(seq.audioBuffer, from + seq.offset, end + seq.offset, mp4 ? 'aac' : 'opus') : null;
  if(seq.withAudio&&seq.audioBuffer&&!audio)throw new Error('音声を書き出せません。MP4の場合は形式をWebMへ変えて再実行してください。');
  const writer = mp4
    ? new MP4Writer({ width: w, height: h, fps, audio: audio && { sampleRate: audio.sampleRate, channels: audio.channels } })
    : new WebMWriter({ width: w, height: h, codec: mkv, fps, audio: audio && { sampleRate: audio.sampleRate, channels: audio.channels, codecPrivate: audio.head } });
  if (mp4 && audio) writer.asc = audio.head;
  audio?.chunks.forEach(ch => writer.addChunk(ch, 2));
  let error = null;
  const enc = new VideoEncoder({ output: (ch, meta) => writer.addChunk(ch, 1, meta), error: e => { error = e; } });
  enc.configure({ ...base, codec });
  seq.recording = true;
  renderer.setPixelRatio(L.ss); renderer.setSize(w, h, false); setCamera(w / h);
  const small = L.ss > 1 ? Object.assign(document.createElement('canvas'), { width: w, height: h }) : null;
  const sx = small?.getContext('2d');
  if (sx) { sx.imageSmoothingEnabled = true; sx.imageSmoothingQuality = 'high'; }
  const n = Math.round((end - from) * fps);
  try {
    for (let k = 0; k < n; k++) {
      signal?.throwIfAborted();if (error) throw error;
      await lyricOverlay?.prepareFrame(seq.lyricDocument,from+k/fps+seq.offset,{duration:seq.audioBuffer?.duration||12,bpm:seq.lyricMotion.bpm,width:renderer.domElement.width,height:renderer.domElement.height});
      await prepareImageFrameAt(from + k / fps);signal?.throwIfAborted();
      if (sx) sx.drawImage($('seq-canvas'), 0, 0, w, h);
      const frame = new VideoFrame(small || $('seq-canvas'), { timestamp: Math.round(k * 1e6 / fps), duration: Math.round(1e6 / fps) });
      enc.encode(frame, { keyFrame: k % (fps * 2) === 0 });
      frame.close();
      while (enc.encodeQueueSize > 6) await new Promise(r => setTimeout(r, 4));
      if (k % 10 === 0) { onProgress?.(k / n); await new Promise(r => setTimeout(r, 0)); }
    }
    await enc.flush();signal?.throwIfAborted();if(error)throw error;
  } finally {
    enc.close();
    seq.recording = false;
    resize();
  }
  onProgress?.(1);
  return writer.finish();
  } finally {seq.recording=false;resize();lyricControls?.refresh();}
}

export const exportWebM = opts => exportVideo({ ...opts, format: 'webm' });

// the song segment [t0, t1] → Opus (WebM) or AAC (MP4) chunks with timestamps from 0
async function encodeAudio(buffer, t0, t1, kind = 'opus') {
  const sampleRate = 48000, channels = Math.min(2, buffer.numberOfChannels);
  const cfg = kind === 'aac' ? { codec: 'mp4a.40.2', sampleRate, numberOfChannels: channels, bitrate: 192000 } : { codec: 'opus', sampleRate, numberOfChannels: channels, bitrate: 160000 };
  if (buffer.sampleRate !== sampleRate || !(await AudioEncoder.isConfigSupported(cfg)).supported) return null;
  const chunks = [];
  let head = null, error = null;
  const enc = new AudioEncoder({
    output: (ch, meta) => { chunks.push(ch); if (!head && meta?.decoderConfig?.description) head = new Uint8Array(meta.decoderConfig.description); },
    error: e => { error = e; },
  });
  enc.configure(cfg);
  const frames=Math.max(0,Math.round((t1-t0)*sampleRate)),step=4800;
  try{for(let i=0;i<frames;i+=step){if(error)throw error;const n=Math.min(step,frames-i),data=audioBlock(buffer,t0,i,n,channels);const ad=new AudioData({format:'f32-planar',sampleRate,numberOfFrames:n,numberOfChannels:channels,timestamp:Math.round(i/sampleRate*1e6),data});enc.encode(ad);ad.close();while(enc.encodeQueueSize>12)await new Promise(r=>setTimeout(r,0));}await enc.flush();}finally{enc.close();}
  if (error) throw error;
  if (kind === 'aac') return head ? { chunks, sampleRate, channels, head } : null;   // head = AudioSpecificConfig
  return { chunks, sampleRate, channels, head: head && head.length >= 19 && new TextDecoder().decode(head.slice(0, 8)) === 'OpusHead' ? head : opusHead(channels, sampleRate) };
}
export async function loadAudio(blob,name='',assetId,{restoring=false}={}){
 if(seq.recording)return;const token=audioGate.next(),revision=lyricRevision;lyricStatus='曲と埋め込み歌詞を読み込み中…';lyricControls?.refresh();
 const extraction=restoring?Promise.resolve(null):extractAudioLyrics(blob).catch(e=>({candidates:[],warnings:[e.message]}));
 const ctx=new AudioContext({sampleRate:48000});let buffer;try{buffer=await ctx.decodeAudioData(await blob.arrayBuffer())}finally{ctx.close()}
 const result=await extraction;if(!audioGate.isCurrent(token)||seq.recording)return;if(!restoring)beginEdit();stopPlay();seq.audio?.pause();if(audioURL)URL.revokeObjectURL(audioURL);audioURL=URL.createObjectURL(blob);seq.audio=new Audio(audioURL);seq.audioBlob=blob;seq.audioBuffer=buffer;seq.audioOwner={};registerAsset(seq.audioOwner,blob,assetId);seq.audioName=name;$('seq-audio-name').textContent=name;lyricExtraction=result;
 lyricStatus=result?.warnings?.join('\n')||'曲を読み込みました。';
 if(result?.candidates.length){if(!seq.lyricDocument?.sourceText.trim()&&!seq.lyrics.length&&revision===lyricRevision)applyCandidate(result.candidates[0]);else lyricStatus='埋め込み歌詞が見つかりました。取り込む場合は候補を選んでください。';}else if(result)lyricStatus+=' 埋め込み歌詞はありません。';
 refreshUI();
}
function syncOverlayLyrics(){if(seq.lyricDocument)seq.lyrics=getTimings(seq.lyricDocument,seq.audioBuffer?.duration||12).events.map(e=>({id:e.id,s:e.start,e:e.end,t:e.kind==='section'?'▸ '+(SECTION_LABELS[e.section]||e.raw):e.text,k:e.section,isBoundary:e.kind==='section'}));}
function lyricState(){return {document:seq.lyricDocument,audioName:seq.audioName,audioDuration:seq.audioBuffer?.duration||0,playing:seq.playing,recording:seq.recording,songSec:seq.t+seq.offset,offset:seq.offset,lyricMotion:seq.lyricMotion,extraction:lyricExtraction,status:[lyricStatus,lyricFontStatus].filter(Boolean).join('\n'),tapping:lyricTapping,tapCurrent:lyricTap?.current(),selectedId:lyricSelectedId,legacy:!seq.lyricDocument&&seq.slides.some(s=>s.lyric)};}
function applyCandidate(c){const d=c.synced?importTimedLyrics(c.lines,'embedded'):parseLyrics(c.text,seq.lyricDocument);setLyricDocument(assignLyricMotions(d,{style:seq.lyricDocument?.style||'readable',seed:seq.lyricDocument?.seed||7}));lyricStatus=c.synced?'時刻付き歌詞を取り込みました。':'歌詞を取り込みました。タイミングは仮配置です。';}
function showLyricPreview(id,replay=false){
 const t=getTimings(seq.lyricDocument,seq.audioBuffer?.duration||12).events.find(e=>e.id===id&&e.kind==='line');if(!t)return;
 const start=Math.max(0,t.start-seq.offset),end=Math.min(totalSeconds(),t.end-seq.offset);if(end<=start){lyricStatus='この歌詞は動画の時間外です。開始時刻・曲の開始位置を確認してください。';lyricControls?.refresh();return}
 const hold=start+Math.min((end-start)*.5,2);seek(replay?start:hold);if(replay){startPlay();lyricPreviewStop={end,hold}}
}
export async function lyricAction(a){
 if(seq.recording)return;
 if(a.type==='select-lyric'){const i=seq.lyrics.findIndex(e=>e.id===a.id);if(i>=0){timelineApi.select({kind:'lyric',i});showLyricPreview(a.id)}return}
 if(a.type==='preview-lyric'){showLyricPreview(a.id,true);return}
 if(a.type==='lyric-style'){if(!seq.lyricDocument?.events.some(e=>e.id===a.id&&e.kind==='line'))return;lyricRevision++;edit(()=>setLyricDocument(applyLyricStyle(seq.lyricDocument,a)));showLyricPreview(a.id,!!a.replay);return}
 if(a.type==='word-color'){lyricRevision++;edit(()=>{const d=structuredClone(seq.lyricDocument),e=d.events.find(e=>e.id===a.id&&e.kind==='line');if(!e)return;e.colors=setWordColor(e.colors,e.text,a.start,a.end,a.color);setLyricDocument(d)});showLyricPreview(a.id);return}
 if(a.type==='studio'){stopPlay();lyricControls?.openStudio(a.id);return}
 if(a.type==='recipe-apply'){if(!seq.lyricDocument?.events.some(e=>e.kind==='line'))throw Error('先に歌詞を入れてください。');const motion=cleanMotion(a.motion);if(!motion.recipe)throw Error('文字モーションを選んでください。');lyricRevision++;edit(()=>{const d=structuredClone(seq.lyricDocument);for(const e of d.events)if(e.kind==='line'&&!e.locked)e.motion=structuredClone(motion);d.enabled=true;setLyricDocument(d)});return}
 if(a.type==='text-edit'){lyricRevision++;return}
 if(a.type==='audio'){await loadAudio(a.file,a.file.name);return}
 if(a.type==='text'){if(a.value===(seq.lyricDocument?.sourceText||''))return;lyricRevision++;lyricTap=null;lyricTapping=false;edit(()=>setLyricDocument(assignLyricMotions(parseLyrics(a.value,seq.lyricDocument),{style:seq.lyricDocument?.style||'readable',seed:seq.lyricDocument?.seed||7,preserveExisting:true})));return}
 if(a.type==='import'){const value=await a.file.text();let restored=null;if(/\.json$/i.test(a.file.name))restored=lyricTimingDocument(JSON.parse(value));lyricRevision++;edit(()=>setLyricDocument(restored||assignLyricMotions(/\.(json|lrc)$/i.test(a.file.name)?importTimedLyrics(parseTimings(value,a.file.name),'file'):parseLyrics(value),{style:'readable',seed:7})));return}
 if(a.type==='candidate'){const c=lyricExtraction?.candidates.find(c=>c.id===a.id);if(c){lyricRevision++;edit(()=>applyCandidate(c))}return}
 if(a.type==='shuffle'){
  const doc=seq.lyricDocument;
  if(!doc?.events.some(e=>e.kind==='line'&&e.decision==='lyric')){notice('先に歌詞を入れてください。');return}
  edit(()=>setLyricDocument({...assignLyricMotions(doc,{style:a.style,seed:(doc.seed||7)+1}),enabled:true}));
  const at=lyricPreviewTime(seq.lyricDocument,seq.t+seq.offset,seq.audioBuffer?.duration||12,seq.offset,totalSeconds());
  if(at===null){notice('動画の時間内に表示できる歌詞がありません。時刻を確認してください。');return}
  stopPlay();seek(Math.max(0,at-seq.offset));startPlay();
  lyricStatus='動きを割り当てて、歌詞のある位置から再生しています。';lyricControls?.refresh();return
 }
 if(a.type==='resolve'){lyricRevision++;edit(()=>setLyricDocument(assignLyricMotions(resolveUnknown(seq.lyricDocument,a.id,a.decision),{style:seq.lyricDocument.style,seed:seq.lyricDocument.seed,preserveExisting:true})));return}
 if(a.type==='edit'){lyricRevision++;edit(()=>{const d=structuredClone(seq.lyricDocument),e=d.events.find(e=>e.id===a.id);if(!e)return;const patch={...a.patch};if(patch.section)patch.sectionOverride=patch.section;if(patch.raw!=null){if(patch.raw!==e.raw)patch.colors=[];patch.runs=lyricRuns(patch.raw);patch.text=patch.runs.map(x=>x.text).join('')}if(patch.motion)patch.motion=cleanMotion(patch.motion);Object.assign(e,patch);d.sourceText=d.events.map(e=>e.raw).join('\n');setLyricDocument(d)});return}
 if(a.type==='nudge'){edit(()=>{const d=structuredClone(seq.lyricDocument),e=d.events.find(e=>e.id===a.id),t=getTimings(d,seq.audioBuffer?.duration||12).events.find(e=>e.id===a.id);if(e&&t)e.s=t.start;setLyricDocument(moveLyric(d,a.id,a.delta))});return}
 if(a.type==='settings'){edit(()=>setLyricDocument({...seq.lyricDocument,...a.patch}));return}
 if(a.type==='motion-settings'){edit(()=>{seq.lyricMotion=cleanLyricSettings({...seq.lyricMotion,...a.patch})});return}
 if(a.type==='shift-all'){edit(()=>{const d=structuredClone(seq.lyricDocument);for(const e of d.events){if(Number.isFinite(e.s))e.s=Math.max(0,e.s+a.delta);if(Number.isFinite(e.e))e.e=Math.max(0,e.e+a.delta)}setLyricDocument(d)});return}
 if(a.type==='offset'){edit(()=>{seq.offset=Number.isFinite(a.value)?a.value:0;$('seq-offset').value=seq.offset});return}
 if(a.type==='seek'){seek(Math.max(0,a.time-seq.offset));return}
 if(a.type==='play'){startPlay();return}if(a.type==='pause'){stopPlay();return}
 if(a.type==='tap-start'||a.type==='tap-resume'){if(!seq.lyricDocument?.events.length)return;beginEdit();if(a.type==='tap-start'||!lyricTap)lyricTap=createTapSession(seq.lyricDocument,seq.audioBuffer?.duration||12);else lyricTap.resume();lyricTapping=true;const t=lyricTap.current();if(t){const at=getTimings(seq.lyricDocument,seq.audioBuffer?.duration||12).events.find(e=>e.id===t.id)?.start||0;seek(Math.max(0,at-seq.offset-1))}startPlay();}
 if(a.type==='tap-now'&&lyricTap&&lyricTapping){lyricTap.tap(seq.t+seq.offset);const d=lyricTap.stop();lyricTap.resume();setLyricDocument(d,{fromTap:true});if(!lyricTap.current()){lyricTapping=false;stopPlay();endEdit()}}
 if(a.type==='tap-back'&&lyricTap){seek(Math.max(0,lyricTap.back()-seq.offset));const d=lyricTap.stop();lyricTap.resume();setLyricDocument(d,{fromTap:true});startPlay()}
 if(a.type==='tap-stop'&&lyricTap){setLyricDocument(lyricTap.stop(),{fromTap:true});lyricTapping=false;stopPlay();endEdit()}
 if(a.type==='save-timing'&&seq.lyricDocument)download('lyrics-timing.json',lyricTimingFile(seq.lyricDocument,seq.audioBuffer?.duration||12));
 if(a.type==='tempo'){if(!seq.audioBuffer)throw new Error('先に曲を入れてください。');const r=detectBeat(seq.audioBuffer);edit(()=>{seq.lyricMotion={bpm:r.bpm,phase:r.phase}});lyricStatus='文字モーションのテンポを更新しました。'}
 if(a.type==='export')showTab('export');
 if(a.type==='convert')await convertLyricProject();
 lyricControls?.refresh();
}
// ------------------------------------------------------------ lyric MV --
export function setLyrics(lines) { seq.lyrics = lines.map(l => ({ ...l })); renderLyricRows(); }
function lyricTextLines() { return $('lyr-text').value.split(/\r?\n/).map(l => l.trim()).filter(Boolean); }
function renderLyricRows() {
  const box = $('lyr-rows');
  box.replaceChildren(...seq.lyrics.map((l, i) => {
    const row = document.createElement('div');
    row.className = 'lyr-row';
    const t = document.createElement('input');
    t.type = 'number'; t.step = '0.01'; t.min = 0; t.value = Number.isFinite(l.s) ? l.s.toFixed(2) : '';
    t.onchange = () => { l.s = Number(t.value); };
    const tx = document.createElement('span');
    tx.textContent = l.t + (l.k === 'chorus' ? '　★サビ' : '');
    tx.title = 'クリックでサビ ⇄ 通常を切り替え';
    tx.onclick = () => { l.k = l.k === 'chorus' ? 'verse' : 'chorus'; renderLyricRows(); };
    row.append(t, tx);
    return row;
  }));
  $('lyr-status').textContent = seq.lyrics.length ? `${seq.lyrics.length}行 · ${seq.lyrics.filter(l => Number.isFinite(l.s)).length}行にタイミングあり` : '';
}
export async function detectTempo() {
  if (!seq.audioBuffer) throw new Error('先に「音楽」を選んでね。');
  const { bpm, phase } = detectBeat(seq.audioBuffer);
  seq.bpm = bpm; seq.phase = phase; $('seq-bpm').value = bpm;
  return { bpm, phase };
}
let lyricSerial = 0;
function lineIds() { for (const l of seq.lyrics) if (!l.id) l.id = `L${Date.now().toString(36)}${++lyricSerial}`; }
export async function buildLyricMV() {
  lineIds();
  const lines = seq.lyrics.filter(l => Number.isFinite(l.s) && l.t.trim());
  if (!lines.length) throw new Error('タイミング付きの歌詞がまだありません（タップするか、読み込んでね）。');
  if (!seq.audio && !seq.audioBuffer) throw new Error('先に「音楽」を選んでね。');
  stopPlay();
  beginEdit();
  const images = [...new Map(seq.slides.filter(s => s.img).map(s => [s.id, s])).values()].map(s => s.img);
  const duration = seq.audioBuffer ? seq.audioBuffer.duration : seq.audio.duration;
  await loadCardFonts(lines, seq.lyricOpts.font);
  const L = layoutLyricMV(lines, { bpm: seq.bpm, phase: seq.phase, snap: seq.lyricOpts.snap, transBeats: seq.lyricOpts.transBeats, duration, images, seed: 7 });
  seq.slides.forEach(dropTexture);
  liveCards.length = 0;
  seq.slides = L.slides.map((sl, i) => sl.kind === 'lyric'
    ? { id: ++slideSerial, name: sl.text.replace(/\//g, ' '), lyric: { text: sl.text, k: sl.k, img: sl.img, seed: i + 1, lineId: lines[sl.line]?.id }, hold: L.holds[i] }
    : { id: ++slideSerial, name: '画像', img: sl.img || blankImage(), hold: L.holds[i] });
  seq.transitions = L.transitions.map(t => ({ ...t, font: seq.lyricOpts.font }));
  seq.offset = 0; $('seq-offset').value = 0;
  seq.t = 0; seq.link = true; seq.selection = null;
  refreshUI();
  await prepareShapes();
  renderAt(0);
  return { slides: seq.slides.length, seconds: totalSeconds() };
}
function blankImage() {
  const c = document.createElement('canvas'); c.width = 16; c.height = 9;
  const x = c.getContext('2d'); x.fillStyle = seq.bg; x.fillRect(0, 0, 16, 9);
  return c;
}
// tap along: Space = the next line starts now, Backspace = redo the previous one, Esc = stop
let tapIdx = -1;
function startTap() {
  const texts = lyricTextLines();
  if (!texts.length) { notice('歌詞を1行ずつ入力してね。'); return; }
  if (!seq.audio) { notice('先に「音楽」を選んでね。'); return; }
  const old = new Map(seq.lyrics.map(l => [l.t, l]));
  seq.lyrics = texts.map(t => ({ t, s: NaN, k: old.get(t)?.k }));
  tapIdx = 0; stopPlay();
  seq.audio.currentTime = 0; seq.audio.play();
  $('lyr-tap-overlay').hidden = false; showTap();
}
function showTap() {
  $('lyr-tap-now').textContent = seq.lyrics[tapIdx]?.t ?? '（ぜんぶ入力できたよ）';
  $('lyr-tap-next').textContent = seq.lyrics[tapIdx + 1]?.t ? '次：' + seq.lyrics[tapIdx + 1].t : '';
  $('lyr-tap-count').textContent = `${Math.min(tapIdx, seq.lyrics.length)} / ${seq.lyrics.length}`;
}
function tap() {
  if (tapIdx < 0 || tapIdx >= seq.lyrics.length) return;
  seq.lyrics[tapIdx].s = Math.max(0, seq.audio.currentTime - 0.08);   // human reaction lag
  tapIdx++; showTap();
  if (tapIdx >= seq.lyrics.length) setTimeout(endTap, 600);
}
function untap() { if (tapIdx > 0) { tapIdx--; seq.lyrics[tapIdx].s = NaN; seq.audio.currentTime = Math.max(0, (seq.lyrics[tapIdx - 1]?.s ?? 0)); showTap(); } }
function endTap() {
  if (tapIdx < 0) return;
  tapIdx = -1; seq.audio.pause();
  $('lyr-tap-overlay').hidden = true;
  renderLyricRows();
}
function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ------------------------------------------------------------------- UI --
let timeline = null, ready = false, saveTimer = 0, saveStatus = '', fileHandle = null, fileOk = false, fileWrittenAt = 0, fileTimer = 0, persistAsked = false;
const history = createHistory();

function thumbFor(s) {
  if (s.lyric) return null;
  if (!s.thumb) {
    const c = document.createElement('canvas'), src = slideCanvas(s);
    c.width = 192; c.height = 108; c.getContext('2d').drawImage(src, 0, 0, 192, 108);
    s.thumb = c.toDataURL('image/jpeg', .6);
  }
  return s.thumb;
}
function refreshUI() {
  syncOverlayLyrics();lyricControls?.refresh();
  if (seq.selection && !selectionTarget(seq.selection)) seq.selection = null;
  renderInspector();
  renderMethodGrid();
  updateSliderNotes();
  $('seq-count').textContent = `${seq.slides.length}枚 · ${totalSeconds().toFixed(1)}秒`;
  timeline?.render();
  renderAt(seq.t);
  scheduleSave();
}
function selectionTarget(sel) {
  if (sel.kind === 'slide') return seq.slides[sel.i];
  if (sel.kind === 'tr') return sel.i < seq.slides.length - 1 ? seq.transitions[sel.i] : null;
  if (sel.kind === 'lyric') return seq.lyrics[sel.i];
  return null;
}

// ------------------------------------------------------ effects panel --
const FX_UI = [
  ['bloom', '光のにじみ', '明るいところがふわっと光る'], ['neon', 'ネオン', '輪郭がネオン管みたいに光る（画面は暗めに）'],
  ['glass', 'ガラス', '傾いたかけらや立体がガラスっぽく屈折・反射'], ['chroma', '色収差', '赤と青の輪郭をずらす'], ['glitch', 'グリッチ', '横線ごとに映像が跳ねる'],
  ['scan', '走査線', 'ブラウン管の横線・ちらつき・丸いゆがみ'], ['grain', 'ノイズ', 'フィルムのざらつき'], ['vignette', '周辺減光', '画面の四隅を暗く'],
  ['bokeh', 'ボケ', '手前・奥に飛んだかけらがぼける（ピントは画像の面）', 'chaos form'], ['blur', 'ぼかし', '全体をやわらかく'],
];
const CAM_UI = [
  ['persp', '遠近感', '奥行きのあるカメラに。手前のかけらが大きく見える'], ['kenburns', 'ゆっくりズーム', '1枚ごとにじわっと寄る／引く＋横に流れる'],
  ['handheld', '手持ち揺れ', 'ゆらゆら揺れる手持ちカメラ風'], ['tilt', '傾き', 'ゆっくり左右に傾く'], ['orbit', '回り込み', '立体化の間、カメラが回り込む', 'form'],
];
// the coloured dots in front of a setting: orange = while breaking up, purple = while solid (same colours as the timeline bands)
function phaseDots(phase) {
  return (phase || '').split(' ').filter(Boolean).map(p => Object.assign(document.createElement('span'), { className: 'phase-dot ' + p }));
}
function slider(label, hint, value, onInput, onStart, phase) {
  const wrap = document.createElement('div'); wrap.className = 'fx-row';
  if (phase) wrap.dataset.phase = phase;
  const head = document.createElement('div'); head.className = 'fx-head';
  const name = document.createElement('span'); name.textContent = label; name.prepend(...phaseDots(phase));
  const out = document.createElement('output'); out.textContent = value ? Math.round(value * 100) + '%' : 'OFF';
  head.append(name, out);
  const input = document.createElement('input'); input.type = 'range'; input.min = 0; input.max = 100; input.value = Math.round(value * 100); input.title = hint;
  input.onpointerdown = () => onStart?.();
  input.oninput = () => { const v = Number(input.value) / 100; out.textContent = v ? input.value + '%' : 'OFF'; onInput(v); };
  wrap.append(head, input);
  return wrap;
}
function renderFxPanel() {
  const box = $('seq-fx');
  if (!box) return;
  box.replaceChildren();
  const lookControls = createRenderControls({value:seq.renderLook,onChange:value=>{if(seq.recording){lookControls.setValue(seq.renderLook);return;}seq.renderLook=value;renderAt(seq.t);scheduleSave();}});
  box.append(lookControls.element);
  const h1 = document.createElement('h2'); h1.textContent = '演出'; box.append(h1);
  const globalNote = document.createElement('p'); globalNote.className = 'hint'; globalNote.textContent = 'ここは全体の設定です（止まっている画像にも、変形にも、全部に効きます）。画像や◆だけ変えたいときは、タイムラインで画像や◆を選んで「この画像だけの演出」「この◆だけの演出」を使ってね。'; box.append(globalNote);
  for (const [k, label, hint, phase] of FX_UI) box.append(slider(label, hint, seq.fx[k], v => { seq.fx[k] = v; renderAt(seq.t); scheduleSave(); }, undefined, phase));
  const colorRow = document.createElement('div'); colorRow.className = 'row';
  const lab = document.createElement('label'); lab.textContent = 'ネオンの色';
  const mode = selectOf([['', '画像の色'], ['custom', '指定の色']], seq.fx.neonColor ? 'custom' : '');
  const color = document.createElement('input'); color.type = 'color'; color.value = seq.fx.neonColor || '#39f3ff'; color.hidden = !seq.fx.neonColor;
  mode.onchange = () => { seq.fx.neonColor = mode.value ? color.value : ''; color.hidden = !mode.value; renderAt(seq.t); scheduleSave(); };
  color.oninput = () => { seq.fx.neonColor = color.value; renderAt(seq.t); scheduleSave(); };
  colorRow.append(lab, mode, color); box.append(colorRow);
  const h2 = document.createElement('h2'); h2.textContent = 'カメラ'; box.append(h2);
  for (const [k, label, hint, phase] of CAM_UI) box.append(slider(label, hint, seq.cam[k], v => { seq.cam[k] = v; renderAt(seq.t); scheduleSave(); }, undefined, phase));
  const reset = document.createElement('button'); reset.className = 'btn'; reset.textContent = '演出とカメラをすべてOFF';
  reset.onclick = () => { seq.renderLook = cleanRenderLook(); for (const k of FX_KEYS) seq.fx[k] = 0; for (const k of Object.keys(seq.cam)) seq.cam[k] = 0; renderFxPanel(); renderAt(seq.t); scheduleSave(); };
  box.append(reset);
  applyLookView();
}

// ------------------------------------------------ method grid + tabs --
// which ◆ the left-hand method buttons act on: the selected one, else the one next to what is selected, else the one at the playhead
function targetTransition() {
  const n = seq.slides.length - 1, sel = seq.selection;
  if (n < 1) return -1;
  if (sel?.kind === 'tr') return sel.i;
  if (sel?.kind === 'slide') return Math.min(sel.i, n - 1);
  if (sel?.kind === 'lyric') { const j = linkedTransition(seq.lyrics[sel.i]?.id); if (j >= 0) return j; }
  const L = locate(seq.t);
  return L.tr >= 0 ? L.tr : Math.min(L.i, n - 1);
}
function renderMethodGrid() {
  const grid = $('seq-methods');
  syncMethodTiles(grid, {
    tag: $('seq-methods-tag'),
    onAdd: () => methodEditor.open(),
    onImport: () => pickMethodFile({ notify: notice }),
    onMenu: (id, anchor) => openMethodMenu(anchor, id, { onEdit: key => methodEditor.open({ id: key }), onDuplicate: key => methodEditor.open({ copyOf: key }), onDelete: deleteCustomMethod, onEnable: key => isImageMethodKey(key)?methodEditor.open({id:key,review:true}):methodEnabler.enable(key), onReview: key => methodEditor.open({ id: key, review: true }), onExport: key => exportMethod(key, { notify: notice }) }),
    onPick: (k, e) => {
      const j = targetTransition();
      if (j < 0) { notice('画像を2枚以上並べると、その間の◆に崩れ方を付けられるよ。'); return; }
      const tr = seq.transitions[j];
      edit(() => { if (e.shiftKey) tr.method2 = tr.method2 === k || tr.method === k ? '' : k; else tr.method = k; normalizeImageTransition(tr);seq.selection = { kind: 'tr', i: j }; });
      showTab('edit');
    },
  });
  const j = targetTransition(), tr = seq.transitions[j];
  grid.classList.toggle('disabled', j < 0);
  for (const b of methodButtons(grid)) {
    b.setAttribute('aria-pressed', String(!!tr && tr.method === b.dataset.method));
    b.classList.toggle('second', !!tr && tr.method2 === b.dataset.method);
  }
  $('seq-methods-hint').textContent = j < 0 ? '画像を2枚以上並べると使えるよ。' : `◆ ${j + 1} → ${j + 2} に設定中（⇧＋クリックで「戻り方」）`;
}
// deleting a custom method: the ◆ that used it go back to the default method (like deleting a GLB), then the method is forgotten
function deleteCustomMethod(id) {
  const name = methodLabel(id);
  for (const tr of seq.transitions) { if (tr.method === id) tr.method = 'crumple'; if (tr.method2 === id) tr.method2 = ''; }
  unregisterCustom(id);
  refreshUI();
  notice(`「${name}」を削除しました。使っていた◆は「くしゃくしゃ」に戻しました。`);
}
function showTab(name) {
  document.querySelectorAll('.tabs [data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  document.querySelectorAll('aside.right .pane').forEach(p => { p.hidden = p.id !== `pane-${name}`; });
}

// ---------------------------------------------------------- inspector --
function field(parent, label, input) {
  const row = document.createElement('div'); row.className = 'row';
  const l = document.createElement('label'); l.textContent = label;
  row.append(l, input); parent.append(row); return input;
}
function selectOf(entries, value) {
  const sel = document.createElement('select');
  for (const [k, v] of entries) sel.append(new Option(v, k, false, value === k));
  return sel;
}
function renderInspector() {
  const box = $('seq-inspector');
  box.replaceChildren();
  const sel = seq.selection, target = sel && selectionTarget(sel);
  const title = document.createElement('div'); title.className = 'insp-title'; box.append(title);
  const where = document.createElement('div'); where.id = 'seq-insp-where'; where.className = 'insp-where'; where.hidden = true; box.append(where);
  inspectorWhereKey = '\u0000';
  if (!target) {
    title.textContent = '設定';
    const p = document.createElement('p'); p.className = 'hint';
    p.textContent = '下のタイムラインで画像・◆（変形）・歌詞をクリックすると、ここで設定できるよ。画像ファイルをブロックにドロップすると差し替え。';
    box.append(p);
    return;
  }
  if (sel.kind === 'slide') inspectSlide(box, title, sel.i, target);
  else if (sel.kind === 'tr') inspectTransition(box, title, sel.i, target);
  else inspectLyric(box, title, sel.i, target);
  updateInspectorWhere();
}
// The panel shows the picture / ◆ that is selected, not the one under the playhead. When the two differ, say so (it is easy to think the
// sliders belong to where the playhead is), with a button to select what is under the playhead.
let inspectorWhereKey = '';
function updateInspectorWhere() {
  const box = $('seq-insp-where');
  if (!box) return;
  const sel = seq.selection;
  let item = null;
  if (sel && (sel.kind === 'slide' || sel.kind === 'tr') && seq.slides.length) { const L = locate(seq.t); item = L.tr >= 0 ? { kind: 'tr', i: L.tr } : { kind: 'slide', i: L.i }; }
  const mismatch = !!item && (item.kind !== sel.kind || item.i !== sel.i);
  const key = mismatch ? `${sel.kind}${sel.i}|${item.kind}${item.i}` : '';
  if (key === inspectorWhereKey) return;
  inspectorWhereKey = key;
  box.hidden = !mismatch;
  box.replaceChildren();
  if (!mismatch) return;
  const name = x => (x.kind === 'tr' ? `◆ 変形 ${x.i + 1} → ${x.i + 2}` : `画像 ${x.i + 1}`);
  const text = document.createElement('span');
  text.textContent = `いまの再生位置は「${name(item)}」です。このパネルは、選んでいる「${name(sel)}」の設定です。`;
  const go = document.createElement('button'); go.className = 'btn tiny'; go.textContent = `「${name(item)}」を選ぶ`; go.onclick = () => timelineApi.select(item);
  box.append(text, go);
}

// "この◆だけの演出" / "この画像だけの演出": the effects of its own. `owner` is the ◆ or the picture; owner.fx holds only what it overrides.
// A slider that moves makes its row an own setting on the spot (no redraw while it is dragged): the row loses "（全体）" and gets "↺ 全体に戻す".
function fxOverrideSection(box, owner, { heading, note }) {
  const det = document.createElement('details'); det.className = 'fx-override';
  const sum = document.createElement('summary');
  const count = () => Object.keys(owner.fx || {}).length;
  const showCount = () => { sum.textContent = heading + (count() ? `（${count()}個 上書き中）` : '（全体と同じ）'); };
  showCount();
  det.append(sum); det.open = count() > 0;
  const hint = document.createElement('p'); hint.className = 'hint'; hint.textContent = note; det.append(hint);
  for (const [k, label, hintText] of FX_UI) {
    let row, name, clear = null;
    const addClear = () => {
      clear = document.createElement('button'); clear.className = 'btn tiny'; clear.textContent = '↺ 全体に戻す';
      clear.onclick = () => edit(() => { const rest = { ...owner.fx }; delete rest[k]; if (Object.keys(rest).length) owner.fx = rest; else delete owner.fx; });
      row.append(clear);
    };
    const own = owner.fx?.[k] !== undefined;
    row = slider(label + (own ? '' : '（全体）'), hintText, own ? owner.fx[k] : seq.fx[k], v => {
      owner.fx = { ...(owner.fx || {}), [k]: v };
      if (!clear) { name.lastChild.textContent = label; addClear(); showCount(); timeline?.render(); }
      renderAt(seq.t); scheduleSave();
    }, () => beginEdit());
    name = row.querySelector('.fx-head span');
    if (own) addClear();
    det.append(row);
  }
  box.append(det);
}
// "この画像だけのカメラ": the picture's own camera move (zoom / sideways / up-down / tilt, from → to), or one of the ready-made moves. s.cam holds it.
function camOverrideSection(box, s) {
  const det = document.createElement('details'); det.className = 'fx-override cam-override';
  const sum = document.createElement('summary');
  const showState = () => { sum.textContent = 'この画像だけのカメラ' + (s.cam ? '（動かし方を指定中）' : '（全体の「ゆっくりズーム」と同じ）'); };
  showState();
  det.append(sum); det.open = !!s.cam;
  const hint = document.createElement('p'); hint.className = 'hint';
  hint.textContent = '画像が登場してから、次の変形で崩れ始めるまでの間、カメラをここで決めた動きにします（全体の「ゆっくりズーム」は、この画像では使いません）。ズームは 1 が元の大きさ、2 で2倍（画面からはみ出すほど寄る）。立体になっている間は、はみ出さないよう動きを弱めます。';
  det.append(hint);
  const presets = document.createElement('div'); presets.className = 'row wrap';
  for (const [label, cam] of CAM_PRESETS) {
    const b = document.createElement('button'); b.className = 'btn tiny'; b.textContent = label;
    b.onclick = () => edit(() => { s.cam = cleanCam(cam); });
    presets.append(b);
  }
  det.append(presets);
  // from → to for each channel; changing one writes all four (the others stay as they are, or neutral)
  const write = (k, from, to) => {
    const next = {};
    for (const kk of Object.keys(CAM_RANGES)) next[kk] = kk === k ? [from, to] : [...camEnds(s.cam, kk)];
    s.cam = cleanCam({ ...next, ease: s.cam?.ease, sec: s.cam?.sec });
  };
  for (const [k, label, step] of [['zoom', 'ズーム（倍）', 0.05], ['x', '横へ（画像の幅の割合。＋で右）', 0.01], ['y', '縦へ（画像の高さの割合。＋で上）', 0.01], ['roll', '傾き（度）', 0.5]]) {
    const [lo, hi] = CAM_RANGES[k], [f, t] = camEnds(s.cam, k);
    const mk = v => { const el = document.createElement('input'); el.type = 'number'; el.min = lo; el.max = hi; el.step = step; el.value = +v.toFixed(3); el.className = 'cam-num'; return el; };
    const a = mk(f), b = mk(t);
    const ends = document.createElement('span'); ends.className = 'cam-ends';
    ends.append(a, document.createTextNode(' → '), b);
    const apply = () => edit(() => write(k, Number(a.value), Number(b.value)));
    a.onchange = apply; b.onchange = apply;
    const row = document.createElement('div'); row.className = 'row';
    const l = document.createElement('label'); l.textContent = label;
    row.append(l, ends); det.append(row);
  }
  const ease = selectOf(CAM_EASES, s.cam?.ease || 'smooth');
  field(det, '動き方', ease).onchange = () => edit(() => { if (s.cam) s.cam = cleanCam({ ...s.cam, ease: ease.value }); else { s.cam = cleanCam({ ...Object.fromEntries(Object.keys(CAM_RANGES).map(k => [k, camEnds(undefined, k)])), ease: ease.value }); } });
  const sec = document.createElement('input'); sec.type = 'number'; sec.min = 0; sec.step = 0.1; sec.value = s.cam?.sec ?? 0;
  sec.title = '0 のときは、画像が登場してから崩れ始めるまでずっと動きます。';
  field(det, '動く長さ（秒、0＝ずっと）', sec).onchange = () => edit(() => {
    const base = s.cam ?? { zoom: [1, 1] };
    s.cam = cleanCam({ ...base, sec: Number(sec.value) || undefined });
  });
  if (s.cam) {
    const clear = document.createElement('button'); clear.className = 'btn tiny'; clear.textContent = '↺ 全体に戻す';
    clear.onclick = () => edit(() => { delete s.cam; });
    det.append(clear);
  }
  box.append(det);
}
function inspectSlide(box, title, i, s) {
  title.textContent = `画像 ${i + 1}${s.lyric ? '（歌詞カード）' : ''}`;
  if (!s.lyric) { const im = document.createElement('img'); im.className = 'insp-thumb'; im.src = thumbFor(s); box.append(im); }
  const hold = document.createElement('input');
  hold.type = 'number'; hold.min = 0; hold.step = 'any'; hold.value = +(s.hold ?? seq.holdBeats).toFixed(2);
  field(box, '見せる長さ（拍）', hold).onchange = () => edit(() => { s.hold = Math.max(0, Number(hold.value) || 0); });
  if (s.lyric) {
    const tx = document.createElement('input'); tx.value = s.lyric.text; tx.maxLength = 48;
    field(box, '歌詞（/ で改行）', tx).onchange = () => edit(() => setLyricText(s.lyric.lineId, tx.value, s));
  }
  fxOverrideSection(box, s, { heading: 'この画像だけの演出', note: 'この画像が止まって見えている間、全体の設定をここの値に置きかえます。前後の◆の間は、前の画像の設定から次の画像の設定へ、なめらかにつなぎます（◆自身の設定は「この◆だけの演出」）。ネオンの色は全体の設定のままです。' });
  camOverrideSection(box, s);
  const row = document.createElement('div'); row.className = 'row wrap'; box.append(row);
  const pick = document.createElement('input'); pick.type = 'file'; pick.accept = 'image/*'; pick.hidden = true;
  pick.onchange = () => { if (pick.files[0]) replaceSlide(i, pick.files[0]); };
  for (const [label, fn] of [[s.lyric ? 'カードの写真を差し替え' : '画像を差し替え', () => pick.click()], ['複製', () => duplicateSlide(i)], ['削除', () => removeSlide(i)]]) {
    const b = document.createElement('button'); b.className = 'btn'; b.textContent = label; b.onclick = fn; row.append(b);
  }
  row.append(pick);
}
function inspectTransition(box, title, i, tr) {
  title.textContent = `◆ 変形 ${i + 1} → ${i + 2}`;
  const m = selectOf(methodEntries(tr.method), tr.method);
  field(box, '崩れ方', m).onchange = () => edit(() => { tr.method = m.value;normalizeImageTransition(tr); });
  const m2 = selectOf([['', '同じ崩れ方で戻る'], ...methodEntries(tr.method2).map(([k, v]) => [k, v + 'で戻る'])], tr.method2 || '');
  field(box, '戻り方（ミックス）', m2).onchange = () => edit(() => { tr.method2 = m2.value;normalizeImageTransition(tr); });
  const imageCode=imageTransition(tr);
  const on = document.createElement('input'); on.type = 'checkbox'; on.checked = tr.shape !== 'none';
  field(box, '立体化する', on).onchange = () => edit(() => {
    if (on.checked) tr.shape = tr.shapePrev && tr.shapePrev !== 'none' ? tr.shapePrev : 'sphere';
    else { tr.shapePrev = tr.shape; tr.shape = 'none'; }
  });
  const hint = document.createElement('p'); hint.className = 'hint';
  hint.textContent = imageCode?'JavaScript画像メソッド：画像 → 物理演出 → 選んだ立体 → 次の画像。立体化をオフにもできます。絵柄シャッフル・画面効果は未対応。メソッドのミックスは映像クロスフェードです。':on.checked ? '画像 → ぐちゃぐちゃ → 立体 → 次の画像' : '画像 → ぐちゃぐちゃ → 次の画像（立体化を飛ばす）';
  box.append(hint);
  const mix = document.createElement('input'); mix.type = 'checkbox'; mix.checked = tr.mixTiles !== false;mix.disabled=!!imageCode;
  mix.title = '崩れている間、画像を断片に分けて混ぜます。オフにすると、絵柄がそのまま貼られます（世界地図の画像なら、球が本物の地球儀になります）。';
  field(box, '絵柄を混ぜる', mix).onchange = () => edit(() => { if (mix.checked) delete tr.mixTiles; else tr.mixTiles = false; });
  if (savedModels.has(tr.shape)) {
    const ord = document.createElement('input'); ord.type = 'checkbox'; ord.checked = tr.orderedPicture === true;
    ord.title = 'GLBの形に、画像を位置どおりに貼ります（画像の左は形の左、下は下。印刷した模様のように、絵がそのまま形に乗ります）。オフだと、画像の断片が形のあちこちにバラバラに貼られます。';
    field(box, '絵を位置どおりに貼る（GLB）', ord).onchange = () => edit(() => { if (ord.checked) tr.orderedPicture = true; else delete tr.orderedPicture; });
  }
  if (on.checked) {
    const late = document.createElement('input'); late.type = 'checkbox'; late.checked = tr.lateSwap === true;
    late.title = 'オフ（初期値）：立体の途中で、次の画像に入れ替わります。オンにすると、立体の間は前の画像のままで、立体が崩れてから次の画像になります（世界地図なら、地球儀のまま崩れます）。';
    field(box, '立体は前の画像のまま', late).onchange = () => edit(() => { if (late.checked) tr.lateSwap = true; else delete tr.lateSwap; });
  }
  if (!on.checked&&!imageCode) {
    const flow = selectOf([['through', '通り抜ける（崩れて去り、次が反対側から来る）'], ['reveal', '吹き飛んで次が現れる（次の画像はそのまま）'], ['return', '行って戻る（同じ動きで戻る）']], tr.flow ?? 'through');
    field(box, '流れ方', flow).onchange = () => edit(() => { tr.flow = flow.value; });
  }
  if (tr.shape !== 'none') {
    const allModels = [...savedModels.values()], tabOn = wantsTabs(allModels), shownTab = validActive(allModels, activeGroup);
    const shapes = [...Object.entries(BUILTIN), ...presetNames.map(k => [k, PRESET_LABELS[k] || k]),
      ...allModels.filter(m => !tabOn || m.id === tr.shape || inGroup(m, shownTab)).map(m => [m.id, 'GLB：' + m.name]), ...Object.entries(SPECIAL_SHAPES).filter(([k]) => k !== 'none')];
    const grid = document.createElement('div'); grid.className = 'shape-grid'; grid.setAttribute('role', 'group'); grid.setAttribute('aria-label', '立体の形');
    for (const [k, label] of shapes) {
      const b = document.createElement('button');
      b.setAttribute('aria-pressed', String(tr.shape === k)); b.title = label;
      // added GLBs show a shaded portrait of the model and a sky-blue frame, so they stand apart from the built-in shapes
      const thumb = savedModels.get(k)?.thumb;
      if (savedModels.has(k)) b.className = 'added';
      const ic = thumb ? Object.assign(document.createElement('img'), { src: thumb, alt: '' }) : document.createElement('span');
      if (!thumb) ic.textContent = SHAPE_ICONS[k] || '▲';
      b.append(ic, label.replace(/^GLB：/, '').replace('シルエット（次の画像）', 'シルエット次').replace('シルエット（今の画像）', 'シルエット今'));
      b.onclick = () => edit(() => { tr.shape = k; if (k === 'text' && !tr.text) tr.text = '幻想'; });
      grid.append(b);
    }
    const lab = document.createElement('div'); lab.className = 'hint'; lab.textContent = '形';
    box.append(lab);
    if (tabOn) box.append(renderTabs(allModels, shownTab, setActiveGroup));   // GLBs by tab instead of one long list
    if (savedModels.size > 8) {   // many GLBs: find one by name
      const q = document.createElement('input'); q.type = 'search'; q.className = 'shape-filter'; q.placeholder = 'GLBの名前で絞り込む';
      q.oninput = () => { const t = q.value.trim().toLowerCase(); for (const b of grid.querySelectorAll('button.added')) b.hidden = !!t && !b.title.toLowerCase().includes(t); };
      box.append(q);
    }
    box.append(grid);
    if (tr.shape === 'text') {
      const tx = document.createElement('input'); tx.value = tr.text; tx.maxLength = 48; tx.placeholder = '幻想/サイレント';
      field(box, '文字（/ で改行）', tx).onchange = () => edit(() => { tr.text = tx.value; });
      const fo = selectOf(Object.entries(FONT_LABELS), tr.font || 'gothic');
      field(box, '書体', fo).onchange = () => edit(() => { tr.font = fo.value; });
    }
    for (const [axis, label, limit] of [['viewY', '横向き', 180], ['viewX', '縦向き', 90]]) {
      const slider = document.createElement('input');
      slider.type = 'range'; slider.min = -limit; slider.max = limit; slider.step = 1;
      slider.value = Math.round((tr[axis] || 0) * 180 / Math.PI);
      slider.dataset.axis = axis; slider.dataset.transition = i;
      slider.onpointerdown = () => beginEdit();
      slider.oninput = () => { tr[axis] = Number(slider.value) * Math.PI / 180; renderAt(seq.t); scheduleSave(); };
      field(box, label, slider);
    }
  }
  const bt = document.createElement('input');
  bt.type = 'number'; bt.min = 0.5; bt.max = 64; bt.step = 'any'; bt.value = +tr.beats.toFixed(2);
  field(box, '変形の長さ（拍）', bt).onchange = () => edit(() => { tr.beats = Math.max(0.5, Number(bt.value) || 8); });
  const shotControls=createShotControls({value:tr.shot,getDuration:()=>tr.beats*beatSec(),getImage:()=>seq.slides[i]?slideCanvas(seq.slides[i]):null,onChange:value=>{if(seq.recording){shotControls.setValue(tr.shot);return;}beginEdit();tr.shot=cleanShot(value);timeline?.render();renderAt(seq.t);scheduleSave();}});
  box.append(shotControls.element);
  // this ◆'s own effects: they take over while the change is happening
  fxOverrideSection(box, tr, { heading: 'この◆だけの演出', note: 'この◆が崩れている間と立体の間だけ、画像ごとの設定（なければ全体の設定）をここの値に置きかえます。止まっている画像には効きません（それは「この画像だけの演出」）。' });
  const row = document.createElement('div'); row.className = 'row wrap'; box.append(row);
  const play = document.createElement('button'); play.className = 'btn'; play.textContent = '▶ この変形を再生';
  play.onclick = () => { const L = layoutTimes(); seek(Math.max(0, L.transitions[i].start - 0.4)); startPlay(); };
  row.append(play);
}
function inspectLyric(box, title, i, l) {
  title.textContent = `歌詞 ${i + 1}`;
  const tx = document.createElement('input'); tx.value = l.t; tx.maxLength = 48; tx.id = 'insp-lyric-text';
  field(box, '文字（/ で改行）', tx).onchange = () => edit(() => setLyricText(l.id, tx.value));
  const at = document.createElement('input'); at.type = 'number'; at.step = '0.01'; at.value = Number.isFinite(l.s) ? l.s.toFixed(2) : '';
  field(box, '歌い出し（曲の秒）', at).onchange = () => { beginEdit(); moveLyricTo(i, Number(at.value)); endEdit(); };
  const ch = document.createElement('input'); ch.type = 'checkbox'; ch.checked = l.k === 'chorus';
  field(box, 'サビ', ch).onchange = () => edit(() => { l.k = ch.checked ? 'chorus' : 'verse'; });
  const row = document.createElement('div'); row.className = 'row wrap'; box.append(row);
  const del = document.createElement('button'); del.className = 'btn'; del.textContent = 'この行を削除';
  del.onclick = () => edit(() => { seq.lyrics.splice(i, 1); seq.selection = null; });
  row.append(del);
  const p = document.createElement('p'); p.className = 'hint';
  p.textContent = linkedTransition(l.id) >= 0 ? (seq.link ? '「歌詞と画像を連動」がONなので、タイミングを動かすと変形も一緒に動きます。' : '連動OFF：歌詞だけ動きます。') : '「MVを組む」で作った行だと、画像の変形と連動できます。';
  box.append(p);
}

// ------------------------------------------------------------ editing --
function snapshot() {
  return {
    lyricDocument:seq.lyricDocument&&structuredClone(seq.lyricDocument),lyricMotion:{...seq.lyricMotion},audioBlob:seq.audioBlob,audioOwner:seq.audioOwner,audioName:seq.audioName,audioBuffer:seq.audioBuffer,
    slides: seq.slides.map(s => ({ id: s.id, name: s.name, img: s.img, lyric: s.lyric && { ...s.lyric }, hold: s.hold, thumb: s.thumb, fx: s.fx && { ...s.fx }, cam: s.cam && structuredClone(s.cam) })),
    transitions: structuredClone(seq.transitions), lyrics: structuredClone(seq.lyrics),
    offset: seq.offset, bpm: seq.bpm, phase: seq.phase, holdBeats: seq.holdBeats, link: seq.link,
  };
}
function restore(snap) {
  audioGate.invalidate();lyricRevision++;lyricTap=null;lyricTapping=false;lyricExtraction=null;
  seq.lyricDocument=cleanLyricDocument(snap.lyricDocument);seq.lyricMotion=cleanLyricSettings(snap.lyricMotion);
  if(seq.audioBlob!==snap.audioBlob){stopPlay();if(audioURL)URL.revokeObjectURL(audioURL);audioURL=snap.audioBlob?URL.createObjectURL(snap.audioBlob):'';seq.audio=audioURL?new Audio(audioURL):null;}
  Object.assign(seq,{audioBlob:snap.audioBlob,audioOwner:snap.audioOwner,audioName:snap.audioName||'',audioBuffer:snap.audioBuffer});$('seq-audio-name').textContent=seq.audioName;
  lyricOverlay?.prepare(seq.lyricDocument).then(()=>renderAt(seq.t)).catch(e=>notice(e.message));
  const old = new Map(seq.slides.map(s => [s.id, s]));
  seq.slides = snap.slides.map(x => {
    const o = old.get(x.id);
    if (o && o.img === x.img && (o.lyric?.text ?? null) === (x.lyric?.text ?? null) && o.lyric?.img === x.lyric?.img) {
      o.hold = x.hold; o.name = x.name; o.lyric = x.lyric && { ...x.lyric };
      if (x.fx) o.fx = { ...x.fx }; else delete o.fx;
      if (x.cam) o.cam = structuredClone(x.cam); else delete o.cam;
      return o;
    }
    return { ...x, lyric: x.lyric && { ...x.lyric }, fx: x.fx && { ...x.fx }, cam: x.cam && structuredClone(x.cam) };
  });
  for (const [id, o] of old) if (!seq.slides.includes(o)) dropTexture(o);
  seq.transitions = structuredClone(snap.transitions); seq.lyrics = structuredClone(snap.lyrics);
  Object.assign(seq, { offset: snap.offset, bpm: snap.bpm, phase: snap.phase, holdBeats: snap.holdBeats, link: snap.link });
  $('seq-offset').value = seq.offset; $('seq-bpm').value = seq.bpm; $('seq-hold').value = seq.holdBeats;
  renderLyricRows();
}
function beginEdit() {if(seq.recording)return; history.push(snapshot()); }
function endEdit() { refreshUI(); prepareShapes().then(() => renderAt(seq.t)).catch(e => console.warn(e)); }
function edit(fn) {if(seq.recording)return; beginEdit(); fn(); endEdit(); }
export function undo() {if(seq.recording)return; const s = history.undo(snapshot()); if (s) { restore(s); endEdit(); notice('元に戻したよ'); } }
export function redo() {if(seq.recording)return; const s = history.redo(snapshot()); if (s) { restore(s); endEdit(); notice('やり直したよ'); } }

function layoutTimes() {
  const B = beatSec(), slides = [], transitions = [];
  let t = 0;
  seq.slides.forEach((s, i) => {
    const hold = (s.hold ?? seq.holdBeats) * B;
    slides.push({ start: t, end: t + hold });
    t += hold;
    if (i < seq.slides.length - 1) { const d = seq.transitions[i].beats * B; transitions.push({ start: t, end: t + d }); t += d; }
  });
  return { slides, transitions, total: totalSeconds() };
}
function snapshotTimes() {
  return { holds: seq.slides.map(s => s.hold ?? seq.holdBeats), beats: seq.transitions.map(t => t.beats), lyrics: seq.lyrics.map(l => l.s), lyricIds:seq.lyrics.map(l=>l.id),document:seq.lyricDocument&&structuredClone(seq.lyricDocument), offset: seq.offset };
}
function linkedTransition(lineId) {
  if(seq.lyricDocument)return -1;
  if (!lineId) return -1;
  const k = seq.slides.findIndex(s => s.lyric?.lineId === lineId);
  return k > 0 ? k - 1 : -1;
}
function lineOfTransition(i) { return seq.slides[i + 1]?.lyric?.lineId; }
const snapSong = t => { const h = beatSec() / 2; return seq.phase + Math.round((t - seq.phase) / h) * h; };
// move the cut between slide i and i+1 by db beats without moving anything else
function roll(i, db, base) {
  const a = base.holds[i], b = base.holds[i + 1] ?? 0;
  db = Math.max(-a, Math.min(b, db));
  seq.slides[i].hold = a + db;
  if (seq.slides[i + 1]) seq.slides[i + 1].hold = b - db;
  return db;
}
function dragEdit(mode, i, dt, base, snap, snapOn) {
  if(seq.recording)return;
  const B = beatSec();
  let db = dt / B;
  if (mode === 'hold') seq.slides[i].hold = Math.max(0, snap(base.holds[i] + db));
  else if (mode === 'tr') {
    const d = roll(i, snap(base.holds[i] + db) - base.holds[i], base);
    const id = lineOfTransition(i), k = seq.lyrics.findIndex(l => l.id === id);
    if (seq.link && k >= 0) seq.lyrics[k].s = base.lyrics[k] + d * B;
  } else if (mode === 'trStart') {
    const h = Math.max(0, Math.min(base.holds[i] + base.beats[i] - .5, snap(base.holds[i] + db)));
    seq.slides[i].hold = h; seq.transitions[i].beats = base.beats[i] - (h - base.holds[i]);
  } else if (mode === 'trEnd') {
    const next = base.holds[i + 1] ?? 0;
    const bt = Math.max(.5, Math.min(base.beats[i] + next, snap(base.beats[i] + db)));
    seq.transitions[i].beats = bt; if (seq.slides[i + 1]) seq.slides[i + 1].hold = next - (bt - base.beats[i]);
  } else if (mode === 'lyric') {
    const t = base.lyrics[i] + dt;
    moveLyricTo(i, snapOn&&!seq.lyricDocument ? snapSong(t) : t, base);
  } else if ((mode === 'lyricStart' || mode === 'lyricEnd') && base.document) {
    seq.lyricDocument=trimLyric(base.document,base.lyricIds[i],mode==='lyricStart'?'start':'end',dt,seq.audioBuffer?.duration||12);
    lyricRevision++;lyricTap=null;lyricTapping=false;syncOverlayLyrics();lyricControls?.refresh();
  } else if (mode === 'audio') {
    seq.offset = base.offset - dt; $('seq-offset').value = seq.offset.toFixed(2);
  }
  timeline.render(); renderInspector(); renderAt(seq.t);
}
function moveLyricTo(i, t, base = snapshotTimes()) {
  if(seq.lyricDocument&&base.document){const id=base.lyricIds[i],d=structuredClone(base.document),e=d.events.find(x=>x.id===id);if(e){const old=base.lyrics[i];e.s=Math.max(0,t);if(Number.isFinite(e.e))e.e=Math.max(e.s,e.e+(e.s-old));e.timingSource='manual';lyricTap=null;lyricTapping=false;seq.lyricDocument=d;syncOverlayLyrics();lyricControls?.refresh()}return}
  const l = seq.lyrics[i];
  if (!l || !Number.isFinite(t)) return;
  const j = linkedTransition(l.id);
  if (seq.link && j >= 0) {   // the change into this lyric's card moves with it (other cuts stay put)
    const d = roll(j, (t - base.lyrics[i]) / beatSec(), base);
    l.s = base.lyrics[i] + d * beatSec();
  } else l.s = Math.max(0, t);
}
function setLyricText(lineId, text, slide) {
  const l = seq.lyrics.find(x => x.id === lineId);
  const card = slide || seq.slides.find(s => s.lyric?.lineId === lineId);
  const old = card?.lyric?.text ?? l?.t;
  if (l) l.t = text;
  if (card?.lyric) { card.lyric.text = text; card.name = text.replace(/\//g, ' '); dropTexture(card); }
  const j = card ? seq.slides.indexOf(card) - 1 : -1;
  const tr = seq.transitions[j];
  if (tr && tr.shape === 'text' && tr.text === old) tr.text = text;   // the 3D word follows the line
  renderLyricRows();
}
function moveSlide(from, to) {
  if (to === from || to === from + 1) return;
  beginEdit();
  const [s] = seq.slides.splice(from, 1);
  seq.slides.splice(to > from ? to - 1 : to, 0, s);
  seq.selection = { kind: 'slide', i: to > from ? to - 1 : to };
  endEdit();
}
async function replaceSlide(i, file) {
  const s = seq.slides[i];
  if (!s) return;
  const img = await imageOf(file);
  beginEdit();
  if (s.lyric) s.lyric = { ...s.lyric, img }; else { s.img = img; s.name = file.name; }
  s.id = ++slideSerial; s.thumb = null; dropTexture(s);   // a new id also refreshes silhouettes made from it
  endEdit();
  notice('差し替えたよ');
}
async function insertImages(files, at) {
  const imgs = [];
  for (const f of files) imgs.push([await imageOf(f), f.name]);
  beginEdit();
  for (const [img, name] of imgs) {
    const n = seq.slides.length;
    seq.slides.splice(at, 0, { id: ++slideSerial, name, img });
    if (n > 0) seq.transitions.splice(at === n ? n - 1 : at, 0, newTransition(at));
    at++;
  }
  endEdit();
}
function duplicateSlide(i) {
  beginEdit();
  const s = seq.slides[i];
  seq.slides.splice(i + 1, 0, { id: ++slideSerial, name: s.name, img: s.img, lyric: s.lyric && { ...s.lyric, lineId: null }, hold: s.hold, fx: s.fx && { ...s.fx }, cam: s.cam && structuredClone(s.cam) });
  seq.transitions.splice(i, 0, { ...seq.transitions[Math.min(i, seq.transitions.length - 1)] || newTransition(i) });
  endEdit();
}
function removeSlide(i) {
  beginEdit();
  seq.slides.splice(i, 1);
  if (seq.transitions.length) seq.transitions.splice(Math.min(i, seq.transitions.length - 1), 1);
  seq.selection = null;
  endEdit();
}
function deleteSelection() {
  const sel = seq.selection;
  if (sel.kind === 'slide') removeSlide(sel.i);
  else if (sel.kind === 'lyric') edit(() => { seq.lyrics.splice(sel.i, 1); seq.selection = null; });
}
function seek(t) { stopPlay(); seq.t = Math.min(Math.max(0, t), totalSeconds()); renderAt(seq.t); timeline?.setTime(seq.t, false); if (!seq.selection) renderMethodGrid(); }

// --------------------------------------------------------------- save --
function stateForSave() {
  return {
    lyricDocument:seq.lyricDocument,
    settings: { lyricMotion:cleanLyricSettings(seq.lyricMotion), bpm: seq.bpm, phase: seq.phase, holdBeats: seq.holdBeats, offset: seq.offset, bg: seq.bg, push: seq.push, pulse: seq.pulse,
      strength: seq.strength, pullback: seq.pullback, formPullback: seq.formPullback, detail: seq.detail, tiles: seq.tiles, depth: seq.depth, fill: seq.fill, silSens: seq.silSens, lyricOpts: seq.lyricOpts, withAudio: seq.withAudio, link: seq.link, fx: seq.fx, cam: seq.cam, renderLook: cleanRenderLook(seq.renderLook) },
    slides: seq.slides, transitions: seq.transitions, lyrics: seq.lyrics,
    audio: seq.audioOwner ? { owner: seq.audioOwner, name: seq.audioName } : null,
    methods: collectMethods(seq.transitions, getCustom),     // goes into .unfold files only (exportFile); the autosave ignores it
  };
}
function scheduleSave() {
  if (!ready) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 800);
}
export async function flushSave() {
  clearTimeout(saveTimer);
  if (!persistAsked) { persistAsked = true; navigator.storage?.persist?.().catch(() => {}); }   // ask the browser not to evict it
  try { const at = await autosave(stateForSave()); saveStatus = `ブラウザに保存 ${new Date(at).toLocaleTimeString()}`; }
  catch (e) { console.warn('autosave', e); saveStatus = 'ブラウザに保存できませんでした'; }
  // the linked file is heavier to write: at most every 5 s
  if (fileHandle && fileOk) { clearTimeout(fileTimer); fileTimer = setTimeout(writeFileNow, Math.max(0, 5000 - (Date.now() - fileWrittenAt))); }
  showSaveStatus();
}
async function writeFileNow() {
  if (!fileHandle || !fileOk) return;
  try { await writeLinked(fileHandle, stateForSave()); fileWrittenAt = Date.now(); }
  catch (e) { console.warn('file save', e); fileOk = false; notice('ファイルに保存できませんでした。「保存先」をもう一度選んでね。'); }
  showSaveStatus();
}
function showSaveStatus() {
  const file = fileHandle ? (fileOk ? `・ファイル「${fileHandle.name}」${fileWrittenAt ? ' ' + new Date(fileWrittenAt).toLocaleTimeString() : ''}` : `・ファイル「${fileHandle.name}」は一時停止中（保存先を押すと再開）`) : '';
  timeline?.setStatus(saveStatus + file);
}
// a different project must never be written over the file the previous one was linked to
async function releaseSaveFile() { clearTimeout(fileTimer); fileHandle = null; fileOk = false; fileWrittenAt = 0; await unlinkFile().catch(() => {}); showSaveStatus(); }
async function chooseSaveFile() {
  if (!canLinkFile) { notice('このブラウザはファイルへの自動保存に対応していません。「書き出し」を使ってね。'); return; }
  try {
    if (fileHandle && !fileOk && await filePermission(fileHandle, true)) { fileOk = true; await writeFileNow(); notice(`「${fileHandle.name}」への自動保存を再開したよ`); return; }
    fileHandle = await linkFile(`unfold-project-${new Date().toISOString().slice(0, 10)}.unfold`);
    fileOk = true; await writeFileNow();
    notice(`これからは「${fileHandle.name}」にも自動で保存するよ`);
  } catch (e) { if (e?.name !== 'AbortError') { console.error(e); notice('保存先を設定できませんでした。'); } }
}
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && ready) { flushSave(); writeFileNow(); } });
async function restoreProject(json, blobs) {
  audioGate.invalidate();lyricRevision++;lyricTap=null;lyricTapping=false;lyricExtraction=null;
  seq.lyricDocument=cleanLyricDocument(json.lyricDocument);seq.lyricMotion=cleanLyricSettings(json.settings?.lyricMotion||{bpm:json.settings?.bpm,phase:json.settings?.phase});
  const imgs = new Map();
  const img = async id => {
    if (!id) return null;
    if (!imgs.has(id)) { const b = blobs.get(id); if (!b) return null; const im = await imageFromBlob(b); registerAsset(im, b, id); imgs.set(id, im); }
    return imgs.get(id);
  };
  const st = json.settings || {};
  seq.renderLook = cleanRenderLook(st.renderLook);
  for (const k of ['bpm', 'phase', 'holdBeats', 'offset', 'bg', 'push', 'pulse', 'strength', 'pullback', 'formPullback', 'detail', 'tiles', 'depth', 'fill', 'silSens', 'withAudio', 'link']) if (st[k] !== undefined) seq[k] = st[k];
  if (st.lyricOpts) seq.lyricOpts = { ...seq.lyricOpts, ...st.lyricOpts };
  if (st.fx) seq.fx = { ...seq.fx, ...st.fx };
  if (st.cam) seq.cam = { ...seq.cam, ...st.cam };
  applyParticleDetail();
  applyTileSize();
  renderFxPanel();
  seq.slides.forEach(dropTexture);
  const slides = [];
  for (const x of json.slides) {
    const s = { id: ++slideSerial, name: x.name, hold: x.hold ?? undefined };
    const ownFx = cleanFx(x.fx, FX_KEYS); if (ownFx) s.fx = ownFx;
    const ownCam = cleanCam(x.cam); if (ownCam) s.cam = ownCam;
    if (x.lyric) s.lyric = { text: x.lyric.text, k: x.lyric.k ?? undefined, seed: x.lyric.seed, lineId: x.lyric.lineId, img: await img(x.lyric.img) };
    else s.img = (await img(x.img)) || blankImage();
    slides.push(s);
  }
  seq.slides = slides;
  seq.transitions = (json.transitions || []).map(withCleanFx);
  seq.lyrics = json.lyrics || [];
  if (json.audio?.asset && blobs.get(json.audio.asset)) await loadAudio(blobs.get(json.audio.asset), json.audio.name, json.audio.asset,{restoring:true});
  else {seq.audio?.pause();if(audioURL)URL.revokeObjectURL(audioURL);audioURL='';seq.audioBlob=null;seq.audio = seq.audioBuffer = seq.audioOwner = null; seq.audioName = ''; $('seq-audio-name').textContent = '';}
  for (const [id, key, scale] of [['seq-bpm', 'bpm', 1], ['seq-hold', 'holdBeats', 1], ['seq-offset', 'offset', 1], ['seq-push', 'push', 100], ['seq-pulse', 'pulse', 100], ['seq-strength', 'strength', 100], ['seq-pullback', 'pullback', 100], ['seq-form-pullback', 'formPullback', 100], ['seq-detail', 'detail', 100], ['seq-tiles', 'tiles', 100], ['seq-sil', 'silSens', 100]]) $(id).value = +(seq[key] * scale).toFixed(2);
  $('seq-fill').checked = seq.fill; $('seq-bg').value = seq.bg; $('seq-with-audio').checked = seq.withAudio;
  $('lyr-style').value = seq.lyricOpts.style; $('lyr-trans').value = seq.lyricOpts.transBeats; $('lyr-snap').checked = seq.lyricOpts.snap;
  $('lyr-text').value = seq.lyrics.map(l => l.t).join('\n');
  seq.t = 0; seq.selection = null;
  renderLyricRows();
  refreshUI();
  await prepareShapes().catch(e => console.warn(e));
  await prepareDocumentFont();
  renderAt(0);
}
async function convertLyricProject(){if(seq.recording)return;await releaseSaveFile();beginEdit();const result=convertLegacyLyrics(seq);seq.slides.forEach(dropTexture);seq.slides=result.slides.map(s=>({...s,...(!s.img&&!s.lyric?{img:blankImage()}:{})}));seq.transitions=result.transitions;seq.link=false;seq.selection=null;setLyricDocument(result.document);endEdit();lyricStatus='テキストモーション版を作りました。元ファイルとは別名で保存してください。';}
async function exportProject() {
  try {
    const blob = await exportFile(stateForSave());
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `unfold-project-${new Date().toISOString().slice(0, 10)}.unfold`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    notice(`プロジェクトを書き出したよ（${(blob.size / 1048576).toFixed(1)} MB）`);
  } catch (e) { console.error(e); notice(e.message || '書き出せませんでした'); }
}
// The custom methods inside a file of someone else come in unchecked ('quarantined'): they are not compiled or drawn until the user
// enables them. Code that is already here (the same code) is reused. The ◆ of the file are pointed at the local ids before the project is restored.
async function prepareImportedMethods(json) {
  const { methods, problems } = validateEmbedded(json.methods, json.version);
  const plan = await planImport({ embedded: methods, local: listCustom(), hash: sourceHash, newId: newCustomId });
  registerQuarantined(plan.created);
  json.transitions = remapTransitions(json.transitions, plan.map);
  return { created: plan.created.length, createdIds: plan.created.map(m => m.id), reused: plan.reused.length, problems };
}
async function openProjectFile(f) {
  stopPlay(); beginEdit();
  const { json, blobs } = await importFile(f);
  const outcome = await prepareImportedMethods(json);
  try { await releaseSaveFile(); await restoreProject(json, blobs); }
  catch (error) { for (const id of outcome.createdIds) unregisterCustom(id); throw error; }       // a file that did not open leaves nothing behind
  history.clear(); flushSave();
  const extra = [outcome.created ? `未確認のメソッドが${outcome.created}個あります（他の人のコードです。確認してから有効にしてね）。` : '', outcome.problems.length ? `取り込めなかったメソッドが${outcome.problems.length}個あります。` : ''].filter(Boolean).join(' ');
  notice(`プロジェクトを開いたよ（ファイルへの自動保存は「保存先…」で選び直してね）${extra ? ' ' + extra : ''}`);
  return outcome;
}
function importProject() {
  const pick = document.createElement('input'); pick.type = 'file'; pick.accept = '.unfold,.unfoldmethod';
  pick.onchange = async () => {
    const f = pick.files[0]; if (!f) return;
    if (/\.unfoldmethod$/i.test(f.name)) { await importMethodFile(f, { notify: notice }); return; }      // a single method, not a project
    try { await openProjectFile(f); }
    catch (e) { console.error(e); notice(e.message || '開けませんでした'); }
  };
  pick.click();
}
async function newProject() {
  if(seq.recording)return;
  if (!confirm('今のシーケンスを閉じて、空から始める？（書き出していない変更は消えます）')) return;
  stopPlay();
  await releaseSaveFile();
  await clearAutosave().catch(() => {});
  seq.slides.forEach(dropTexture);
  seq.slides = []; seq.transitions = []; seq.lyrics = []; seq.selection = null; seq.t = 0; seq.link = false;
  seq.audio?.pause(); seq.audio = seq.audioBuffer = seq.audioOwner = null; seq.audioName = ''; $('seq-audio-name').textContent = '';
  audioGate.invalidate();lyricRevision++;lyricTap=null;lyricTapping=false;lyricExtraction=null;lyricStatus='';seq.lyricDocument=null;seq.lyricMotion={bpm:seq.bpm,phase:seq.phase};seq.audioBlob=null;if(audioURL)URL.revokeObjectURL(audioURL);audioURL='';
  $('lyr-text').value = ''; renderLyricRows();
  history.clear();
  refreshUI();
}

const timelineApi = {
  layout: layoutTimes,
  state: () => ({ lyricMode:seq.lyricDocument?'overlay':'legacy', t: seq.t, bpm: seq.bpm, phase: seq.phase, offset: seq.offset, lyrics: seq.lyrics, selection: seq.selection, link: seq.link,
    audioDuration: seq.audioBuffer?.duration || 0, audioBuffer: seq.audioBuffer, canUndo: history.canUndo, canRedo: history.canRedo, status: saveStatus }),
  slideInfo: i => { const s = seq.slides[i]; return { name: (s.lyric ? s.lyric.text.replace(/\//g, ' ') : s.name) + (s.fx && Object.keys(s.fx).length ? ' ✦' : ''), thumb: thumbFor(s), lyric: !!s.lyric }; },
  transitionInfo: i => {
    const tr = seq.transitions[i];
    const label = methodLabel(tr.method) + (tr.method2 ? '→' + methodLabel(tr.method2) : '') + (tr.shape === 'none' ? { through: ' ⇢', reveal: ' ⤳', return: ' ⇄' }[tr.flow ?? 'through'] : ' / ' + shapeLabel(tr));
    return { label: label + (tr.fx && Object.keys(tr.fx).length ? ' ✦' : ''), flat: tr.shape === 'none', bands: tr.shape === 'none' ? [['chaos', 3, 97]] : PHASE_BANDS, title: `${label}（${+tr.beats.toFixed(2)}拍）\nドラッグで切り替え位置、両端で長さ` };
  },
  isLinked: k => seq.link && linkedTransition(seq.lyrics[k]?.id) >= 0,
  select: sel => {if(sel.kind==='lyric'&&seq.lyricDocument){lyricSelectedId=seq.lyrics[sel.i]?.id;seq.selection=sel;showTab('lyric');lyricControls?.refresh();lyricControls?.revealQuick();timeline.render();return} seq.selection = sel; renderInspector(); renderMethodGrid(); timeline.render(); showTab('edit'); },
  seek, beginEdit, endEdit, snapshotTimes, dragEdit, moveSlide, replaceSlide, insertImages, undo, redo,
  editLyricText: i => { timelineApi.select({ kind: 'lyric', i }); setTimeout(() => { const t = $('insp-lyric-text'); t?.focus(); t?.select(); }, 0); },
  setLink: on => edit(() => { seq.link = on; }),
  exportProject, importProject, newProject, chooseSaveFile,
};

async function safeEnsure(tr, i) {
  try { await ensureShape(tr, i); } catch (e) { console.error(e); notice(e.message || String(e)); tr.shape = 'sphere'; refreshUI(); }
}

function notice(msg) {
  $('seq-notice').textContent = msg;
  $('seq-notice').classList.add('show');
  clearTimeout(notice.t);
  notice.t = setTimeout(() => $('seq-notice').classList.remove('show'), 4000);
}
async function addFiles(files) {
  files = files.filter(f => /^image\//.test(f.type));
  if (!files.length) return;
  beginEdit();
  for (const f of files) await addImageBlob(f, f.name);
  await prepareShapes();
  renderAt(seq.t);
}
function wire() {
  document.querySelectorAll('.tabs [data-tab]').forEach(b => { b.onclick = () => showTab(b.dataset.tab); });
  for (const b of document.querySelectorAll('#look-mode [data-mode]')) b.onclick = () => { lookMode = b.dataset.mode; applyLookView(); };
  $('pane-look').addEventListener('pointerdown', () => { lookDragging = true; }, true);
  const lookRelease = () => { if (lookDragging) { lookDragging = false; applyLookView(); } };
  addEventListener('pointerup', lookRelease);
  addEventListener('pointercancel', lookRelease);
  renderFxPanel();
  $('seq-model-add').onclick = () => $('seq-model-input').click();
  $('seq-model-input').onchange = e => importSequenceModels([...e.target.files]);
  $('seq-files').onchange = e => addFiles([...e.target.files]);
  const dz = $('seq-drop');
  dz.onclick = () => $('seq-files').click();
  for (const ev of ['dragenter', 'dragover']) dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('over'); });
  dz.ondragleave = () => dz.classList.remove('over');
  dz.ondrop = e => { e.preventDefault(); dz.classList.remove('over'); addFiles([...e.dataTransfer.files]); };
  for (const [id, key, scale] of [['seq-bpm', 'bpm', 1], ['seq-hold', 'holdBeats', 1], ['seq-push', 'push', .01], ['seq-pulse', 'pulse', .01], ['seq-strength', 'strength', .01], ['seq-pullback', 'pullback', .01], ['seq-form-pullback', 'formPullback', .01]]) {
    $(id).oninput = e => { seq[key] = Number(e.target.value) * scale; refreshUI(); };
  }
  $('seq-detail').oninput = e => { seq.detail = Number(e.target.value) / 100; applyParticleDetail(); renderAt(seq.t); scheduleSave(); };
  $('seq-tiles').oninput = e => { seq.tiles = Number(e.target.value) / 100; applyTileSize(); updateSliderNotes(); renderAt(seq.t); scheduleSave(); };
  $('seq-shuffle').onclick = async () => { shuffleTransitions(); await prepareShapes(); refreshUI(); };
  $('seq-sil').onchange = e => { seq.silSens = Number(e.target.value) / 100; dropSilhouettes(); renderAt(seq.t); };
  $('seq-fill').onchange = e => { seq.fill = e.target.checked; rebuildBackgrounds(); renderAt(seq.t); };
  $('seq-bg').oninput = e => { seq.bg = e.target.value; rebuildBackgrounds(); refreshUI(); };
  $('seq-audio').onchange = async e => {
    const f = e.target.files[0];
    if (!f) return;
    try { await loadAudio(f, f.name); } catch (err) { console.error(err); notice('音楽を読み込めませんでした。'); }
  };
  lyricControls=createLyricControls({getState:lyricState,onAction:lyricAction});$('pane-lyric').append(lyricControls.element);if(location.hash==='#lyric')showTab('lyric');
  $('seq-with-audio').onchange=e=>{seq.withAudio=e.target.checked;scheduleSave()};
  $('seq-offset').onchange = e => edit(()=>{seq.offset=Number(e.target.value);});
  $('seq-play').onclick = () => togglePlay();
  $('seq-scrub').oninput = e => { stopPlay(); seq.t = Number(e.target.value) / 1000 * totalSeconds(); renderAt(seq.t); };
  let drag = null;
  const canvas = $('seq-canvas');
  canvas.style.cursor = 'grab';
  canvas.style.touchAction = 'none';
  canvas.onpointerdown = e => {
    if (seq.recording) return;
    stopPlay();
    const L = locate(seq.t);
    if (L.tr < 0 || curves(L.u).form < .05) { notice('立体化の位置に移動すると、ドラッグで向きを変えられるよ。'); return; }
    const tr = seq.transitions[L.tr];
    drag = { x: e.clientX, y: e.clientY, viewX: tr.viewX || 0, viewY: tr.viewY || 0, index: L.tr };
    canvas.setPointerCapture(e.pointerId);
  };
  canvas.onpointermove = e => {
    if (!drag || seq.recording) return;
    const tr = seq.transitions[drag.index];
    tr.viewX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, drag.viewX + (e.clientY - drag.y) * .009));
    tr.viewY = Math.max(-Math.PI, Math.min(Math.PI, drag.viewY + (e.clientX - drag.x) * .009));
    for (const axis of ['viewX', 'viewY']) {
      const slider = document.querySelector(`input[data-transition="${drag.index}"][data-axis="${axis}"]`);
      if (slider) slider.value = Math.round(tr[axis] * 180 / Math.PI);
    }
    renderAt(seq.t);
  };
  canvas.onpointerup = canvas.onpointercancel = () => { drag = null; };
  $('seq-reset-view').onclick = canvas.ondblclick = () => {
    const L = locate(seq.t);
    if (L.tr < 0) { notice('立体化の位置に移動してから向きを戻してね。'); return; }
    const tr = seq.transitions[L.tr]; tr.viewX = tr.viewY = 0;
    for (const axis of ['viewX', 'viewY']) {
      const slider = document.querySelector(`input[data-transition="${L.tr}"][data-axis="${axis}"]`);
      if (slider) slider.value = 0;
    }
    renderAt(seq.t);
  };
  let exportController=null;const cancelExport=document.createElement('button');cancelExport.id='seq-export-cancel';cancelExport.textContent='書き出しを中止';cancelExport.hidden=true;cancelExport.onclick=()=>exportController?.abort(new DOMException('書き出しを中止しました。','AbortError'));$('seq-export').after(cancelExport);
  $('seq-export').onclick = async () => {
    stopPlay();
    if(seq.lyricDocument){const check=getTimings(seq.lyricDocument,seq.audioBuffer?.duration||12),pending=seq.lyricDocument.events.filter(e=>e.decision==='pending');if(pending.length){notice(`未分類の行が${pending.length}行あります。歌詞・曲タブで扱いを選んでください。`);showTab('lyric');return}if(check.issues.length){notice(check.issues.map(x=>x.message).join(' / '));showTab('lyric');return}if(check.events.some(e=>e.provisional)&&!confirm('仮タイミングの歌詞があります。この配置のまま動画を書き出しますか？'))return;}
    const fps = Number($('seq-fps').value), q = Number($('seq-quality').value), look = $('seq-hq').value, format = $('seq-format').value;
    $('seq-export').disabled = true;exportController=new AbortController();cancelExport.hidden=false;
    try {
      const blob = await exportVideo({ fps, quality: q, look, format, signal:exportController.signal, onProgress: p => { $('seq-progress').value = p * 100; } });
      const url = URL.createObjectURL(blob);
      $('seq-download').href = url;
      $('seq-download').download = `unfold-sequence-${Date.now()}.${format}`;
      $('seq-download').hidden = false;
      $('seq-result').src = url; $('seq-result').hidden = false;
      notice(`書き出し完了：${(blob.size / 1048576).toFixed(1)} MB（${fps}fps・コマ落ちなし）`);
    } catch (e) { console.error(e); notice(e.message || '書き出しに失敗しました'); }
    finally { $('seq-export').disabled = false;cancelExport.hidden=true;exportController=null; }
  };
  document.addEventListener('keydown', e => {
    if(document.querySelector('dialog.motion-studio[open]'))return;
    const typing=['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)||e.target.isContentEditable||e.isComposing;
    if(lyricTapping&&!typing){if(e.code==='Space'){e.preventDefault();lyricAction({type:'tap-now'})}else if(e.code==='Backspace'){e.preventDefault();lyricAction({type:'tap-back'})}else if(e.code==='Escape')lyricAction({type:'tap-stop'});return}
    if(seq.recording)return;
    if ((e.metaKey || e.ctrlKey) && !typing && (e.key === 'z' || e.key === 'Z' || e.key === 'y')) {
      e.preventDefault();
      if (e.key === 'y' || e.shiftKey) redo(); else undo();
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && !typing && seq.selection) { e.preventDefault(); deleteSelection(); return; }
    if (e.code === 'Space' && !typing && e.target.tagName !== 'BUTTON') { e.preventDefault(); togglePlay(); }
  });
  new ResizeObserver(resize).observe($('seq-stage'));
}
let playStart = 0, playFrom = 0;
function togglePlay() { seq.playing ? stopPlay() : startPlay(); }
function startPlay() {
  lyricPreviewStop=null;
  if (!totalSeconds()||seq.recording) return;
  if (seq.t >= totalSeconds() - 0.01) seq.t = 0;
  seq.playing = true; playFrom = seq.t; playStart = performance.now();
  if(seq.audio){seq.audio.currentTime=Math.max(0,seq.t+seq.offset);if(seq.t+seq.offset>=0)seq.audio.play().catch(()=>notice('音楽の再生ボタンをもう一度押してください。'));}
  $('seq-play').textContent = 'Ⅱ';
}
function stopPlay() { lyricPreviewStop=null;seq.playing = false; seq.audio?.pause(); $('seq-play').textContent = '▶'; applyLookView(); }
let lastTickAt = 0;
function tick(now) {
  // the time between animation frames, for the watch on custom methods (only while playing, never while exporting)
  if (seq.playing && !seq.recording && lastTickAt && !document.hidden) safety.tick(now - lastTickAt);
  lastTickAt = now;
  if (seq.playing && !seq.recording) {
    const wallTime=playFrom+(now-playStart)/1000;
    if(seq.audio&&seq.audio.paused&&!seq.audio.ended&&wallTime+seq.offset>=0&&seq.t+seq.offset<0)seq.audio.play().catch(()=>{});
    seq.t = seq.audio && !seq.audio.paused ? seq.audio.currentTime - seq.offset : playFrom + (now - playStart) / 1000;
    if(lyricPreviewStop&&seq.t>=lyricPreviewStop.end){const hold=lyricPreviewStop.hold;stopPlay();seq.t=hold}
    if (seq.t >= totalSeconds()) { seq.t = totalSeconds(); stopPlay(); }
    renderAt(seq.t);
    timeline?.setTime(seq.t);
  }
  requestAnimationFrame(tick);
}

function sampleCanvas(i) {
  const c = document.createElement('canvas');
  c.width = 1600; c.height = 900;
  const x = c.getContext('2d');
  const pal = [['#ff7145', '#2855b9'], ['#cce876', '#183625'], ['#678cc5', '#f1f0da'], ['#dc472c', '#eee9d6']][i % 4];
  x.fillStyle = pal[0]; x.fillRect(0, 0, 1600, 900);
  x.strokeStyle = pal[1]; x.lineWidth = 3;
  for (let k = 0; k < 1600; k += 80) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k, 900); x.stroke(); }
  for (let k = 0; k < 900; k += 80) { x.beginPath(); x.moveTo(0, k); x.lineTo(1600, k); x.stroke(); }
  x.fillStyle = pal[1]; x.font = 'bold 300px sans-serif'; x.textAlign = 'center'; x.fillText(['ONE', 'TWO', 'THREE', 'FOUR'][i % 4], 800, 560);
  return c;
}

// ------------------------------------------------------------------ boot --
try {
  renderer = new THREE.WebGLRenderer({ canvas: $('seq-canvas'), antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  sceneBlur = new SceneBlur(renderer);
  lyricOverlay=createLyricOverlay(renderer,{onReady:()=>{if(!seq.recording)renderAt(seq.t)},onError:e=>{lyricFontStatus=e.message;lyricControls?.refresh()}});
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-4.8, 4.8, 2.7, -2.7, .1, 100);
  camera.position.z = 10;
  perspCam = new THREE.PerspectiveCamera(30, 16 / 9, .1, 200);
  const aspect = CANVAS_W / CANVAS_H;
  planeH = Math.min(3.65, 5.25 / aspect); planeW = planeH * aspect;
  const blank = makeTexture(document.createElement('canvas'));
  const uniforms = { uImage: { value: blank }, uImageB: { value: blank }, uSwap: { value: 0 }, uSize: { value: new THREE.Vector2(planeW, planeH) },
    uDistort: { value: 0 }, uForm: { value: 0 }, uStrength: { value: .8 }, uDepth: { value: 1 }, uSeed: { value: 28 }, uMethod: { value: 0 },
    uMethod2: { value: 0 }, uMethodMix: { value: 0 }, uProject: { value: 0 }, uTime: { value: 0 }, uDraw: { value: 1 }, uThrough: { value: 0 }, uFade: { value: 1 }, uGlass: { value: 0 }, uShape: { value: 0 }, uPreset: { value: 0 }, uConceal: { value: 0 } };
  geoCache.set('sphere', gridGeometry(presetTargets('sphere')));
  variants = createVariants({ renderer, vertexShader, fragmentShader, uniforms, onReady: () => { if (!seq.playing) renderAt(seq.t); } });
  onRegistryChange(() => { renderMethodGrid(); renderInspector(); if (!seq.playing) renderAt(seq.t); });
  safety = createSafety({ notify: notice });
  methodTrial = createTrial({ vertexShader, fragmentShader });
  methodEditor = createImageMethodEditor({ vertexShader, fragmentShader, notify: notice, safety, trial: methodTrial, onExportFile: record => downloadMethodFile([record], { notify: notice }), getRenderLook: () => seq.renderLook, onApplyRenderLook: value => { if(seq.recording)return;seq.renderLook=cleanRenderLook(value);renderFxPanel();renderAt(seq.t);scheduleSave(); }, getPreviewImage: () => {const i=seq.selection?.i??locate(seq.t).i;return seq.slides[i]?slideCanvas(seq.slides[i]):null},getPreviewTarget:()=>{const i=seq.selection?.kind==='tr'?seq.selection.i:Math.max(0,locate(seq.t).tr);const tr=seq.transitions[i];if(!tr||tr.shape==='none')return null;const geo=geoCache.get(shapeKey(tr,i));return geo?imageTarget(geo,{shape:tr.shape,preset:presetNames.includes(tr.shape)||savedModels.has(tr.shape)||isFlatShape(tr),project:!!isFlatShape(tr)}):null} });
  methodEnabler = createEnabler({ compile: source => compileUserMethod(renderer, { vertexShader, fragmentShader, source }), trial: source => methodTrial.run(source), safety, notify: notice });
  quarantineBanner = createQuarantineBanner($('seq-quarantine'), { onReview: id => methodEditor.open({ id, review: true }), onEnable: id => isImageMethodKey(id)?methodEditor.open({id,review:true}):methodEnabler.enable(id) });
  // saved custom methods come back when the page opens; from then on every change in the registry is saved
  methodPersistence = createPersistence({ store: openStore(), onError: () => notice('自作メソッドをこのブラウザに保存できませんでした。') });
  // saving starts first, so that what recoverFromCrash switches off is saved too
  methodPersistence.load().then(() => { methodPersistence.start(); safety.recoverFromCrash(); }, () => notice('保存した自作メソッドを読み込めませんでした。'));
  addEventListener('pagehide', () => safety.pageHide());
  $('seq-canvas').addEventListener('webglcontextlost', () => safety.contextLost());
  mesh = new THREE.Mesh(geoCache.get('sphere'), variants.base);
  mesh.frustumCulled = false;
  scene.add(mesh);
  backdrop = new THREE.Mesh(new THREE.PlaneGeometry(planeW, planeH), new THREE.MeshBasicMaterial({ map: blank, depthWrite: false }));
  backdrop.position.z = -4; backdrop.renderOrder = -1; backdrop.visible = false;
  scene.add(backdrop);
  wire();
  timeline = createTimeline($('seq-timeline'), timelineApi);
  await loadModelLibrary();
  const params = new URLSearchParams(location.search);
  let restored = false;
  if (!params.has('empty') && !params.has('new')) {
    try {
      const saved = await loadAutosave();
      if (saved?.json&&(saved.json.slides?.length||saved.json.lyricDocument||saved.json.audio)) { await restoreProject(saved.json, saved.blobs); restored = true; notice('前回の続きを開いたよ（「新規」で空から始められます）'); }
    } catch (e) { console.warn('autosave restore', e); }
  }
  if (!restored && !params.has('empty')) {
    for (let i = 0; i < 4; i++) addSlide(sampleCanvas(i), `サンプル ${i + 1}`);
    await prepareShapes();
  }
  ready = !params.has('empty') || params.has('autosave');   // test pages opened with ?empty never overwrite the saved project
  fileHandle = ready ? await linkedFile() : null;
  if (fileHandle) fileOk = await filePermission(fileHandle).catch(() => false);
  showSaveStatus();
  history.clear();
  timeline.fit();
  resize();
  requestAnimationFrame(tick);
  attachWorkshopLink({notify:notice,beforeApply:item=>{
    if(seq.recording)throw Error('書き出しが終わってから適用してください。');
    if(item.kind==='text'){if(seq.selection?.kind!=='lyric'||!lyricSelectedId)throw Error('タイムラインの歌詞を選んでから使ってください。');return {lyricId:lyricSelectedId,document:seq.lyricDocument};}
    if(seq.selection?.kind!=='tr'||!seq.transitions[seq.selection.i])throw Error('タイムラインの◆変形を選んでから使ってください。');
    return {tr:seq.transitions[seq.selection.i]};
  },apply:async(item,target,activate)=>{
    if(seq.recording)throw Error('書き出しが終わってから適用してください。');
    if(item.kind==='text'){
      if(seq.lyricDocument!==target.document)throw Error('歌詞が変更されました。もう一度適用してください。');
      await lyricAction({type:'lyric-style',id:target.lyricId,patch:item.motion});
    }else{
      const tr=target.tr;if(!seq.transitions.includes(tr))throw Error('変形が変更されました。もう一度適用してください。');
      const method=activate();edit(()=>{tr.method=method.id;normalizeImageTransition(tr)});showTab('edit');
    }
  }});
  window.unfoldSeq = { lyricAction, setLyricDocument, exportVideo, seq, addImageFromUrl, addImageBlob, addSlide, prepareShapes, undo, redo, flushSave, timelineApi, shuffleTransitions, loadAudio, setLyrics, detectTempo, buildLyricMV, renderAt, totalSeconds, exportWebM, refreshUI, exportProjectBlob: () => exportFile(stateForSave()), openProjectFile };
  window.unfoldMethods = { registerCustom, unregisterCustom, setCustomStatus, listCustom, variants, editor: methodEditor, persistence: methodPersistence, safety, enabler: methodEnabler, transfer: { importFile: importMethodFile, importText: importMethodText, download: downloadMethodFile } };
} catch (e) {
  console.error(e);
  $('seq-notice').textContent = '3D表示を開始できませんでした。WebGL対応のChromeで開いてね。';
  $('seq-notice').classList.add('show');
}
