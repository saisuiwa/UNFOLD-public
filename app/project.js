import {cleanLyricDocument} from './lyric-document.js?v=2';
// Project persistence for the sequence editor: autosave into this browser (IndexedDB) and a single-file .unfold export.
// Pictures and the song are stored once each as blobs ("assets"); the project itself is plain JSON that points at them.
const DB = 'unfold-projects', PROJECTS = 'projects', ASSETS = 'assets', MAGIC = 'UNFOLD-PROJECT-1\n';

function open() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) return reject(new Error('このブラウザでは自動保存を使えません。'));
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore(PROJECTS); r.result.createObjectStore(ASSETS); };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error || new Error('保存場所を開けませんでした。'));
  });
}
async function tx(stores, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(stores, mode);
    let out;
    fn(t, v => { out = v; });
    t.oncomplete = () => { db.close(); resolve(out); };
    t.onerror = t.onabort = () => { db.close(); reject(t.error || new Error('保存に失敗しました。')); };
  });
}

// ------------------------------------------------------------- assets --
// Every picture / song the editor uses gets a stable id and keeps its original bytes.
const registry = new WeakMap();   // HTMLImageElement | canvas | AudioBuffer-owner → {id, blob, type}
let serial = 0;
export function registerAsset(obj, blob, id) {
  const rec = { id: id || `a${Date.now().toString(36)}${(serial++).toString(36)}${Math.random().toString(36).slice(2, 6)}`, blob, type: blob?.type || '' };
  registry.set(obj, rec);
  return rec;
}
export async function assetOf(obj) {
  let rec = registry.get(obj);
  if (rec?.blob) return rec;
  if (obj instanceof HTMLCanvasElement) {   // generated pictures (samples, blank frames) are saved as PNG
    const blob = await new Promise(r => obj.toBlob(r, 'image/png'));
    return registerAsset(obj, blob, rec?.id);
  }
  if (obj instanceof HTMLImageElement && obj.src) {
    const blob = await (await fetch(obj.src)).blob();
    return registerAsset(obj, blob, rec?.id);
  }
  throw new Error('保存できない画像があります。');
}
export async function imageFromBlob(blob) {
  const url = URL.createObjectURL(blob), img = new Image();
  img.src = url;
  await img.decode();
  return img;   // the object URL stays alive: the image may be re-read when saving
}

// -------------------------------------------------------- undo / redo --
export function createHistory(limit = 120) {
  const past = [], future = [];
  return {
    push(snap) { past.push(snap); if (past.length > limit) past.shift(); future.length = 0; },
    undo(current) { if (!past.length) return null; future.push(current); return past.pop(); },
    redo(current) { if (!future.length) return null; past.push(current); return future.pop(); },
    get canUndo() { return past.length > 0; },
    get canRedo() { return future.length > 0; },
    clear() { past.length = future.length = 0; },
  };
}

// ------------------------------------------------------- serialisation --
// state: {settings, slides:[{name, img?, lyric?, hold}], transitions, lyrics, audio:{owner, name}|null}
async function toJSON(state) {
  const assets = new Map();
  const ref = async obj => { if (!obj) return null; const a = await assetOf(obj); assets.set(a.id, a); return a.id; };
  const slides = [];
  for (const s of state.slides) {
    slides.push({ name: s.name, hold: s.hold ?? null, fx: s.fx ?? null, cam: s.cam ?? null, img: await ref(s.img),
      lyric: s.lyric ? { text: s.lyric.text, k: s.lyric.k ?? null, seed: s.lyric.seed, lineId: s.lyric.lineId ?? null, img: await ref(s.lyric.img) } : null });
  }
  const audio = state.audio ? { name: state.audio.name, asset: await ref(state.audio.owner) } : null;
  const json = { version: 1, savedAt: Date.now(), settings: state.settings, slides, transitions: state.transitions, lyrics: state.lyrics, audio };
  if(state.lyricDocument){json.lyricDocument=cleanLyricDocument(state.lyricDocument);json.version=3;}
  return { json, assets };
}

export async function autosave(state) {
  const { json, assets } = await toJSON(state);
  const keep = new Set(assets.keys());
  await tx([PROJECTS, ASSETS], 'readwrite', t => {
    const store = t.objectStore(ASSETS);
    store.getAllKeys().onsuccess = ev => {
      for (const k of ev.target.result) if (!keep.has(k)) store.delete(k);   // drop pictures no longer used
      for (const [id, a] of assets) if (!ev.target.result.includes(id)) store.put({ blob: a.blob, type: a.type }, id);
    };
    t.objectStore(PROJECTS).put(json, 'current');
  });
  return json.savedAt;
}
export async function loadAutosave() {
  const json = await tx([PROJECTS], 'readonly', (t, done) => { t.objectStore(PROJECTS).get('current').onsuccess = e => done(e.target.result); });
  if (!json) return null;
  const blobs = new Map();
  await tx([ASSETS], 'readonly', t => {
    const store = t.objectStore(ASSETS);
    store.openCursor().onsuccess = e => { const c = e.target.result; if (c) { blobs.set(c.key, c.value.blob); c.continue(); } };
  });
  return { json, blobs };
}
export async function clearAutosave() {
  await tx([PROJECTS, ASSETS], 'readwrite', t => { t.objectStore(PROJECTS).delete('current'); t.objectStore(ASSETS).clear(); });
}

// .unfold file: MAGIC, 4-byte JSON length, JSON (with the byte range of every asset), then the asset bytes
export async function exportFile(state) {
  const { json, assets } = await toJSON(state);
  // custom methods go into files only (not into the autosave of this browser, which keeps its own library): version 2 only when there are some
  if (state.methods?.length) { json.methods = state.methods; json.version = Math.max(json.version,2); }
  let offset = 0;
  json.assets = {};
  const parts = [];
  for (const [id, a] of assets) { json.assets[id] = { offset, size: a.blob.size, type: a.type }; offset += a.blob.size; parts.push(a.blob); }
  const head = new TextEncoder().encode(JSON.stringify(json)), len = new Uint8Array(4);
  new DataView(len.buffer).setUint32(0, head.length, true);
  return new Blob([MAGIC, len, head, ...parts], { type: 'application/octet-stream' });
}
// A real file on disk that autosave keeps up to date (File System Access API, Chrome/Edge).
// Browser storage can be wiped (site data cleared, some embedded browsers reset on restart); this file survives that.
export const canLinkFile = typeof globalThis.showSaveFilePicker === 'function';
export async function linkFile(suggestedName) {
  const handle = await showSaveFilePicker({ suggestedName, types: [{ description: 'UNFOLDプロジェクト', accept: { 'application/octet-stream': ['.unfold'] } }] });
  await tx([PROJECTS], 'readwrite', t => t.objectStore(PROJECTS).put(handle, 'file'));
  return handle;
}
export async function linkedFile() {
  try { return await tx([PROJECTS], 'readonly', (t, done) => { t.objectStore(PROJECTS).get('file').onsuccess = e => done(e.target.result || null); }); }
  catch { return null; }
}
export async function unlinkFile() { await tx([PROJECTS], 'readwrite', t => t.objectStore(PROJECTS).delete('file')); }
export async function filePermission(handle, ask = false) {
  const opts = { mode: 'readwrite' };
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  return ask ? (await handle.requestPermission(opts)) === 'granted' : false;
}
export async function writeLinked(handle, state) {
  const blob = await exportFile(state), w = await handle.createWritable();
  await w.write(blob); await w.close();
  return blob.size;
}
export async function importFile(file) {
  const buf = await file.arrayBuffer(), magic = new TextEncoder().encode(MAGIC);
  if (new TextDecoder().decode(new Uint8Array(buf, 0, magic.length)) !== MAGIC) throw new Error('UNFOLDのプロジェクトファイル（.unfold）を選んでね。');
  const n = new DataView(buf, magic.length, 4).getUint32(0, true), start = magic.length + 4;
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, start, n)));
  if(![1,2,3].includes(json.version))throw new Error('このプロジェクトのバージョンは未対応です。新しいUNFOLDで開いてください。');
  if(json.lyricDocument)json.lyricDocument=cleanLyricDocument(json.lyricDocument);
  const base = start + n, blobs = new Map();
  for (const [id, a] of Object.entries(json.assets || {})) blobs.set(id, new Blob([buf.slice(base + a.offset, base + a.offset + a.size)], { type: a.type }));
  return { json, blobs };
}
