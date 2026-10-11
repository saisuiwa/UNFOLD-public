// A one-way box in this browser that carries a finished sequence from sequence.html to STUDIO without a file.
// The sequence puts in the bytes a .unfold file would hold; STUDIO opens them as a new project and then empties the box.
const DB = 'unfold-studio-handoff', STORE = 'box', KEY = 'sequence', MAX_AGE_MS = 30 * 60e3;
const open = () => new Promise((resolve, reject) => {
  if (!globalThis.indexedDB) return reject(new Error('このブラウザでは、STUDIOへの受け渡しを使えません。'));
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => r.result.createObjectStore(STORE);
  r.onsuccess = () => resolve(r.result);
  r.onerror = () => reject(r.error || new Error('受け渡し箱を開けませんでした。'));
});
const done = t => new Promise((resolve, reject) => { t.oncomplete = () => resolve(); t.onerror = t.onabort = () => reject(t.error || new Error('受け渡しに失敗しました。')); });

/** Put the sequence in the box. `trustedSources` are the sources of custom methods the user had already enabled in the sequence. */
export async function putHandoff(blob, { name = 'unfold-project.unfold', trustedSources = [] } = {}) {
  const db = await open();
  try {
    const t = db.transaction(STORE, 'readwrite');
    t.objectStore(STORE).put({ blob, name, trustedSources: [...trustedSources].filter(s => typeof s === 'string'), at: Date.now() }, KEY);
    await done(t);
  } finally { db.close(); }
}

/** Look at the piece in the box without removing it (STUDIO removes it only after the piece is saved as a project, so a reload in between loses nothing). */
export async function peekHandoff({ now = Date.now() } = {}) {
  const db = await open();
  try {
    const t = db.transaction(STORE, 'readonly');
    let item = null;
    await new Promise((resolve, reject) => { const g = t.objectStore(STORE).get(KEY); g.onsuccess = () => { item = g.result || null; resolve(); }; g.onerror = () => reject(g.error); });
    if (!item || !(item.blob instanceof Blob) || now - item.at > MAX_AGE_MS) return null;
    return item;
  } finally { db.close(); }
}

/** Empty the box. */
export async function clearHandoff() {
  const db = await open();
  try { const t = db.transaction(STORE, 'readwrite'); t.objectStore(STORE).delete(KEY); await done(t); } finally { db.close(); }
}
