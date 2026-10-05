// Custom methods inside a .unfold file: which ones go in, how a file from someone else is checked, and how its ids are matched with what is here.
// A file is not trusted: only the fields we use are kept, sizes are limited, and the hash is worked out from the code (never read from the file).
import {cleanImageCode,isImageMethodKey,newImageMethodId,imageMethodIdentity} from './image-method-format.js';
import { LIMITS } from './method-guard.js';
import { CUSTOM_PREFIX, DEFAULT_KEY, isCustomKey, registerCustom } from './method-registry.js';

export const IMPORTED_REASON = 'ファイルから取り込みました。コードを確認してから有効にしてね。';
export const PROJECT_METHODS = { maxCount: 50, maxName: 20, maxId: 80, maxChars: LIMITS.maxChars, newestVersion: 4 };

// the custom methods the transitions use, once each
export function usedMethodIds(transitions) {
  const ids = new Set();
  for (const tr of transitions ?? []) for (const key of [tr?.method, tr?.method2]) if (isCustomKey(key)) ids.add(key);
  return [...ids];
}

// what goes into the file for those methods that exist here (look and params are for later)
export function collectMethods(transitions, getCustom) {
  const out = [];
  for (const id of usedMethodIds(transitions)) {
    const c = getCustom(id);
    if (c) out.push({ id: c.id, name: c.name, symbol: c.symbol, ...(c.code?{engine:'image-js',code:cleanImageCode(c.code)}:{vertex:c.vertex}), look: null, params: [] });
  }
  return out;
}

// 2 only when methods are inside, so a project without custom methods stays a version 1 file that older pages can open
export const projectVersion = methods => (methods?.some(m=>m.code)?4:methods?.length?2:1);

// `raw` is json.methods of a file somebody gave us. Returns the entries that are fine and a Japanese line for every one that was dropped.
export function validateEmbedded(raw, version = PROJECT_METHODS.newestVersion) {
  const methods = [], problems = [];
  if (raw === undefined || raw === null) return { methods, problems };
  if (typeof version === 'number' && version > PROJECT_METHODS.newestVersion) return { methods, problems: ['新しい形式のファイルなので、メソッドは取り込みませんでした。'] };
  if (!Array.isArray(raw)) return { methods, problems: ['メソッドの一覧の形が正しくないので、取り込みませんでした。'] };
  const seen = new Set();
  let cut = false;
  raw.forEach((m, i) => {
    const label = `${i + 1}番目のメソッド`;
    if (methods.length >= PROJECT_METHODS.maxCount) {
      if (!cut) { cut = true; problems.push(`メソッドが多すぎます（${PROJECT_METHODS.maxCount}個まで）。残りは取り込みませんでした。`); }
      return;
    }
    if (!m || typeof m !== 'object') { problems.push(`${label}は、形が正しくありません。`); return; }
    if (typeof m.id !== 'string' || !isCustomKey(m.id) || m.id.length > PROJECT_METHODS.maxId) { problems.push(`${label}は、idが正しくありません。`); return; }
    if (seen.has(m.id)) { problems.push(`${label}は、同じidが2回あるので取り込みませんでした。`); return; }
    if(isImageMethodKey(m.id)||m.code||m.engine==='image-js'){
      try {if(!isImageMethodKey(m.id)||m.engine!=='image-js'||version<4)throw Error('画像メソッドの形式が不正です。');const code=cleanImageCode(m.code);seen.add(m.id);methods.push({id:m.id,name:String(m.name||'画像コード').slice(0,20),symbol:String(m.symbol||'◈').slice(0,2),engine:'image-js',code});}catch(e){problems.push(label+'：'+e.message)}return;
    }
    if (typeof m.vertex !== 'string' || !m.vertex.trim()) { problems.push(`${label}は、コードがありません。`); return; }
    if (m.vertex.length > PROJECT_METHODS.maxChars) { problems.push(`${label}は、コードが長すぎます（${PROJECT_METHODS.maxChars}文字まで）。`); return; }
    seen.add(m.id);
    const name = typeof m.name === 'string' ? m.name.trim() : '';
    const clipped = [...name].slice(0, PROJECT_METHODS.maxName).join('') || '取り込んだメソッド';
    const symbol = [...(typeof m.symbol === 'string' ? m.symbol : '')][0] || [...clipped][0];
    methods.push({ id: m.id, name: clipped, symbol, vertex: m.vertex });
  });
  return { methods, problems };
}

// Which local method is each embedded one? By the code (hash), not by the id: the same code is reused, new code gets a new id of its own.
// local: [{ id, vertex }]. hash: async code -> string. newId: () => a new custom id. Returns { map: fileId -> localId, reused: [localId], created: [entry with its new id] }.
export async function planImport({ embedded, local, hash, newId }) {
  const byHash = new Map();
  for (const l of local) { const h = await hash(imageMethodIdentity(l)); if (!byHash.has(h)) byHash.set(h, l.id); }
  const map = new Map(), reused = [], created = [], createdIds = new Set();
  for (const m of embedded) {
    const h = await hash(imageMethodIdentity(m)), same = byHash.get(h);
    if (same) {
      map.set(m.id, same);
      if (!createdIds.has(same) && !reused.includes(same)) reused.push(same);
      continue;
    }
    const id = m.code?newImageMethodId():newId();
    map.set(m.id, id);
    byHash.set(h, id);
    createdIds.add(id);
    created.push({ ...m, id });
  }
  return { map, reused, created };
}

// the transitions with their custom ids replaced by the local ones; a custom id that the file did not bring becomes the default method
export function remapTransitions(transitions, map) {
  const fix = (key, fallback) => {if(isImageMethodKey(key)&&!map.has(key))throw Error('画像コードメソッドが不足しています。対応するメソッドを含めて保存した作品を開いてください。');return isCustomKey(key)?(map.get(key)??fallback):key};
  return (transitions ?? []).map(tr => (tr && typeof tr === 'object' ? { ...tr, method: fix(tr.method, DEFAULT_KEY), method2: fix(tr.method2, '') } : tr));
}

// the methods planImport made new ids for come in unchecked: not compiled or drawn until the user enables them
export function registerQuarantined(created) {
  for (const m of created) registerCustom({ id: m.id, name: m.name, symbol: m.symbol, vertex: m.vertex, code:m.code, status: 'quarantined', reason: IMPORTED_REASON });
}
