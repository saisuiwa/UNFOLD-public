import {workshopField} from './workshop-settings.js';
// Saving custom methods in this browser (IndexedDB), the way model-library.js keeps GLB files.
// createPersistence() keeps a store in step with the registry: whatever is registered, changed or removed there is written here, so the editor,
// the console and the automatic "disabled" status all end up saved without each of them having to remember to.
import { listCustom, onRegistryChange, registerCustom, getCustom } from './method-registry.js';

const DATABASE = 'unfold-method-library', STORE = 'methods';

// SHA-256 of the code as hex. crypto.subtle only exists on https and localhost; elsewhere a plain FNV-1a hash stands in.
export async function sourceHash(text) {
  const data = new TextEncoder().encode(String(text));
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 2166136261;
  for (const b of data) { h ^= b; h = Math.imul(h, 16777619); }
  return `fnv-${(h >>> 0).toString(16)}`;
}

const signature = c => JSON.stringify([c.name, c.symbol, c.vertex, c.code, c.workshop, c.status, c.reason]);

export function createPersistence({ store, onError = () => {} }) {
  const persisted = new Map();    // id -> signature of what the store holds (or is about to hold)
  const created = new Map();      // id -> createdAt, kept across edits
  let queue = Promise.resolve(), stopListening = null;
  // writes run one after the other; `undo` puts the bookkeeping back when a write fails, so the next registry event retries it
  const enqueue = (job, undo) => { queue = queue.then(job).catch(error => { undo?.(); onError(error); }); };

  function sync() {
    const live = new Map(listCustom().map(c => [c.id, c]));
    for (const c of live.values()) {
      const sig = signature(c), before = persisted.get(c.id);
      if (before === sig) continue;
      persisted.set(c.id, sig);
      if (!created.has(c.id)) created.set(c.id, Date.now());
      const record = { id: c.id, name: c.name, symbol: c.symbol, vertex: c.vertex, ...(c.code?{code:c.code}:{}), ...workshopField(c.workshop), look: null, params: [], status: c.status, reason: c.reason, createdAt: created.get(c.id), updatedAt: Date.now() };
      enqueue(async () => { await store.put({ ...record, hash: await sourceHash(c.code?JSON.stringify(c.code):c.vertex) }); }, () => { if (before === undefined) persisted.delete(c.id); else persisted.set(c.id, before); });
    }
    for (const [id, before] of [...persisted]) {
      if (live.has(id)) continue;
      persisted.delete(id);
      enqueue(() => store.delete(id), () => persisted.set(id, before));
    }
  }

  return {
    // registers every saved method; nothing is written back for them
    async load() {
      const records = await store.list();
      for (const r of records) {
        registerCustom({ id: r.id, name: r.name, symbol: r.symbol, vertex: r.vertex, code:r.code, ...workshopField(r.workshop), status: r.status, reason: r.reason });
        persisted.set(r.id, signature(getCustom(r.id)));
        created.set(r.id, r.createdAt);
      }
      return records.length;
    },
    start() { stopListening ??= onRegistryChange(sync); },
    stop() { stopListening?.(); stopListening = null; },
    flush: () => queue,
  };
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) return reject(new Error('このブラウザでは自作メソッドを保存できません。'));
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('自作メソッドの保存場所を開けませんでした。'));
  });
}

// the real store: { list(), put(record), delete(id) } on IndexedDB
export function openStore() {
  let opening = null;
  const run = async (mode, operate) => {
    const db = await (opening ??= openDatabase());
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      let result;
      operate(transaction.objectStore(STORE), value => { result = value; });
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error || new Error('自作メソッドの保存に失敗しました。'));
      transaction.onabort = () => reject(transaction.error || new Error('自作メソッドの保存が中断されました。'));
    });
  };
  return {
    list: () => run('readonly', (store, done) => { store.getAll().onsuccess = e => done(e.target.result.sort((a, b) => a.createdAt - b.createdAt)); }),
    put: record => run('readwrite', store => { store.put(record); }),
    delete: id => run('readwrite', store => { store.delete(id); }),
  };
}
