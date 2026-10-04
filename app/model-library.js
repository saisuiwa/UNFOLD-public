// Keep GLB originals in this browser. Metadata is separate so listing large models stays fast.
const DATABASE = 'unfold-model-library';
const META = 'metadata';
const FILES = 'files';

function openLibrary() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) return reject(new Error('このブラウザでは形の保存を利用できません。'));
    const request = indexedDB.open(DATABASE, 2);
    request.onupgradeneeded = event => {
      const db = request.result, transaction = request.transaction;
      const metadata = db.createObjectStore(META, { keyPath: 'id' });
      const files = db.createObjectStore(FILES, { keyPath: 'id' });
      if (event.oldVersion === 1 && db.objectStoreNames.contains('models')) {
        const old = transaction.objectStore('models').getAll();
        old.onsuccess = () => {
          for (const { buffer, ...meta } of old.result) {
            metadata.put(meta);
            files.put({ id: meta.id, buffer });
          }
          db.deleteObjectStore('models');
        };
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('形の保存場所を開けませんでした。'));
  });
}

async function transact(stores, mode, operation) {
  const db = await openLibrary();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(stores, mode);
    let result;
    operation(transaction, value => { result = value; });
    transaction.oncomplete = () => { db.close(); resolve(result); };
    transaction.onerror = () => { db.close(); reject(transaction.error || new Error('形の保存に失敗しました。')); };
    transaction.onabort = () => { db.close(); reject(transaction.error || new Error('形の保存が中断されました。')); };
  });
}

export async function listModels() {
  const records = await transact([META], 'readonly', (tx, done) => {
    tx.objectStore(META).getAll().onsuccess = event => done(event.target.result);
  });
  return records.sort((a, b) => a.createdAt - b.createdAt);
}

export function getModel(id) {
  return transact([META, FILES], 'readonly', (tx, done) => {
    let meta, file;
    const finish = () => { if (meta !== undefined && file !== undefined) done(meta && file ? { ...meta, buffer: file.buffer } : undefined); };
    tx.objectStore(META).get(id).onsuccess = event => { meta = event.target.result || null; finish(); };
    tx.objectStore(FILES).get(id).onsuccess = event => { file = event.target.result || null; finish(); };
  });
}

export async function saveModel(name, buffer, triangles, thumb, group = '') {
  const meta = { id: `glb-${crypto.randomUUID()}`, name, bytes: buffer.byteLength, triangles, thumb, createdAt: Date.now() };
  if (group) meta.group = group;   // the tab it is listed under (model-groups.js); models without one are 未分類
  await transact([META, FILES], 'readwrite', tx => {
    tx.objectStore(META).put(meta);
    tx.objectStore(FILES).put({ id: meta.id, buffer });
  });
  return meta;
}

// Merge fields (e.g. a thumbnail made later) into a saved model's metadata.
export function updateModel(id, patch) {
  return transact([META], 'readwrite', (tx, done) => {
    const store = tx.objectStore(META);
    store.get(id).onsuccess = event => {
      const meta = event.target.result;
      if (meta) { Object.assign(meta, patch); store.put(meta); }
      done(meta);
    };
  });
}

export function deleteModel(id) {
  return transact([META, FILES], 'readwrite', tx => {
    tx.objectStore(META).delete(id);
    tx.objectStore(FILES).delete(id);
  });
}
