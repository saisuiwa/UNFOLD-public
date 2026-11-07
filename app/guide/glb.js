// GLB shelf: lists the catalogue (glb-catalog.json, thumbnails next to it), and adds a model to this browser's library
// (the same IndexedDB the app pages read) by downloading it from the GLB host. Nothing is uploaded anywhere.
import { listModels } from '../model-library.js?v=5';
import { ALL, UNGROUPED } from '../model-groups.js?v=1';

const MAX_SAVED = 100;
const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
// where the .glb files live (a separate static host, so a site update never re-uploads hundreds of MB); ?base= is for local testing only
const GLB_BASE = (() => {
  const q = local ? new URLSearchParams(location.search).get('base') : null;
  const base = q && /^https?:\/\//.test(q) ? q : 'https://glb.saisuiwa.com/';
  return base.endsWith('/') ? base : base + '/';
})();

const $ = id => document.getElementById(id);
const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* not remembered */ } } };
let catalog = null, host = 'checking', have = new Set(), grey = new Map(), tab = store.get('unfold-glb-shelf-tab') ?? ALL, query = '', busy = false;

const fmtMB = b => (b / 1048576).toFixed(1) + 'MB';
const setStatus = (text, cls = '') => { const s = $('status'); s.textContent = text; s.className = 'status ' + cls; };

// have: names already in this browser. grey: shelf id → saved copies that are the old grey (untextured) file of
// that shelf model — same name and exactly its old byte size, so a GLB of your own with the same name is never touched.
async function refreshHave() {
  let saved = [];
  try { saved = await listModels(); } catch { /* no library */ }
  have = new Set(saved.map(m => m.name));
  grey = new Map();
  for (const m of catalog?.models || []) {
    const old = saved.filter(s => s.name === m.name && m.greyBytes && s.bytes === m.greyBytes);
    if (old.length) grey.set(m.id, old);
  }
}

async function checkHost() {
  try {
    const r = await fetch(GLB_BASE + 'manifest.json', { mode: 'cors', cache: 'no-store' });
    host = r.ok ? 'ok' : 'down';
  } catch { host = 'down'; }
  const note = $('hostNote');
  note.hidden = host === 'ok';
  if (host !== 'ok') { note.className = 'note warn'; note.textContent = 'GLBファイルの置き場は、いま準備中です。もう少ししてから、もう一度開いてください（形の一覧と見た目は先に見られます）。'; }
}

function visible() {
  const q = query.trim().toLowerCase();
  return catalog.models.filter(m => (tab === ALL || m.group === tab) && (!q || m.name.toLowerCase().includes(q) || m.id.includes(q)));
}

function renderTabs() {
  const counts = new Map(); for (const m of catalog.models) counts.set(m.group, (counts.get(m.group) || 0) + 1);
  const tabs = [{ key: ALL, label: 'すべて', n: catalog.models.length }, ...catalog.groups.map(g => ({ key: g.name, label: g.name, n: counts.get(g.name) || 0 }))];
  if (!tabs.some(t => t.key === tab)) tab = ALL;
  $('tabs').replaceChildren(...tabs.map(t => {
    const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(t.key === tab));
    b.append(document.createTextNode(t.label)); const n = document.createElement('small'); n.textContent = t.n; b.append(n);
    b.onclick = () => { tab = t.key; store.set('unfold-glb-shelf-tab', tab); render(); };
    return b;
  }));
}

function card(m) {
  const el = document.createElement('article'); el.className = 'glb' + (have.has(m.name) ? ' added' : '');
  const img = document.createElement('img'); img.src = `./thumbs/${m.id}.webp`; img.alt = m.name; img.loading = 'lazy'; img.width = 256; img.height = 256;
  const body = document.createElement('div'); body.className = 'body';
  const h = document.createElement('h3'); h.textContent = m.name;
  const meta = document.createElement('div'); meta.className = 'meta'; meta.textContent = `${fmtMB(m.bytes)} ・ ${Math.round(m.triangles / 10000)}万面`;
  const acts = document.createElement('div'); acts.className = 'acts';
  const add = document.createElement('button'); add.type = 'button'; add.className = 'btn lime small';
  const done = have.has(m.name), old = grey.has(m.id);
  if (old) {
    el.classList.add('grey');
    const note = document.createElement('div'); note.className = 'meta oldnote'; note.textContent = '入っているのは色なしの古い版';
    meta.after(note);
    add.textContent = '色つきに入れ替え'; add.disabled = host !== 'ok' || busy;
    add.onclick = () => replaceMany([m]);
  } else {
    add.textContent = done ? '追加済み ✓' : 'UNFOLDに追加'; add.disabled = done || host !== 'ok' || busy;
    add.onclick = () => addMany([m]);
  }
  acts.append(add); body.append(h, meta, acts); el.append(img, body);
  return el;
}

function render() {
  renderTabs();
  const list = visible();
  $('grid').replaceChildren(...list.map(card));
  $('count').textContent = `${list.length}個を表示`;
  const todo = list.filter(m => !have.has(m.name));
  const all = $('addAll');
  all.hidden = !(host === 'ok' && todo.length > 1);
  all.disabled = busy;
  all.textContent = `${tab === ALL ? '表示中の' : 'このグループの'}${todo.length}個を全部追加`;
  all.onclick = () => addMany(todo);
  const olds = list.filter(m => grey.has(m.id));
  const swap = $('replaceAll');
  swap.hidden = !(host === 'ok' && olds.length > 0);
  swap.disabled = busy;
  swap.textContent = `${tab === ALL ? '表示中の' : 'このグループの'}色なし${olds.length}個を色つきに入れ替え`;
  swap.onclick = () => replaceMany(olds);
}

let modules = null;

async function download(m, imp, thumbs) {
  // ?v= skips a grey copy a browser may still cache from before the shelf got its colours (the host ignores the query)
  const res = await fetch(GLB_BASE + m.file + '?v=colour', { mode: 'cors' });
  if (!res.ok) throw new Error(`${m.name} をダウンロードできませんでした（${res.status}）`);
  const buffer = await res.arrayBuffer();
  const data = await imp.importModel(buffer);
  let thumb = ''; try { thumb = thumbs.modelThumb(data.target); } catch (e) { console.warn('thumbnail:', e); }
  return { buffer, data, thumb };
}

// Put the colour file into the saved grey copies in place: no delete + re-add, no 100-model limit, and the works that
// use those models keep them (the saved id does not change).
async function replaceMany(list) {
  list = list.filter(m => grey.has(m.id));
  if (busy || !list.length) return;
  const total = list.reduce((s, m) => s + m.bytes, 0);
  if (list.length > 3 && !confirm(`色なしの${list.length}個を、色つき（約${fmtMB(total)}）に入れ替えます。使っている作品はそのまま色つきになります。よろしいですか？`)) return;
  busy = true; render();
  let ok = 0;
  try {
    const [lib, imp, thumbs] = await load();
    for (const [i, m] of list.entries()) {
      setStatus(`入れ替え中… ${i + 1}/${list.length}　${m.name}`);
      const { buffer, data, thumb } = await download(m, imp, thumbs);
      for (const saved of grey.get(m.id)) await lib.replaceModelFile(saved.id, buffer, data.originalTriangles, thumb);
      ok++;
    }
    setStatus(`${ok}個を色つきに入れ替えました。開いているUNFOLDのページは、開き直すと色つきになります。`, 'ok');
  } catch (e) {
    console.error(e);
    setStatus(`入れ替えられませんでした：${e.message || e}（${ok}個は入れ替え済み）`, 'err');
  } finally {
    busy = false; await refreshHave(); render();
  }
}
async function load() {
  modules ??= await Promise.all([import('../model-library.js?v=5'), import('../model-import.js?v=13'), import('../model-thumb.js?v=1')]);
  return modules;
}

async function addMany(list) {
  if (busy || !list.length) return;
  const total = list.reduce((s, m) => s + m.bytes, 0);
  const room = MAX_SAVED - (await listModels()).length;
  if (room <= 0) { setStatus(`保存できるGLBは${MAX_SAVED}個までです。使わないGLBを、アプリの「追加した立体の形」から削除してね。`, 'err'); return; }
  if (list.length > room) { list = list.slice(0, room); setStatus(`あと${room}個ぶんしか保存できないので、先頭の${room}個だけ追加します。`); }
  if (list.length > 3 && !confirm(`${list.length}個（約${fmtMB(total)}）をダウンロードして、このブラウザに保存します。よろしいですか？`)) return;
  busy = true; render();
  let ok = 0;
  try {
    const [lib, imp, thumbs] = await load();
    for (const [i, m] of list.entries()) {
      setStatus(`追加中… ${i + 1}/${list.length}　${m.name}`);
      const { buffer, data, thumb } = await download(m, imp, thumbs);
      await lib.saveModel(m.name, buffer, data.originalTriangles, thumb, m.group);
      have.add(m.name); ok++;
    }
    setStatus(`${ok}個を追加しました。1枚モード・シーケンスの「追加した形」から選べます。`, 'ok');
  } catch (e) {
    console.error(e);
    setStatus(`追加できませんでした：${e.message || e}（${ok}個は追加済み）`, 'err');
  } finally {
    busy = false; await refreshHave(); render();
  }
}

(async function init() {
  try {
    catalog = await (await fetch('./glb-catalog.json')).json();
  } catch (e) { setStatus('一覧を読み込めませんでした。ページを開き直してね。', 'err'); return; }
  await Promise.all([refreshHave(), checkHost()]);
  $('q').addEventListener('input', e => { query = e.target.value; render(); });
  const olds = [...grey.keys()].length;
  setStatus((host === 'ok' ? `${catalog.models.length}個の形があります。` : `${catalog.models.length}個の形があります（ファイルは準備中）。`)
    + (olds ? `前に入れた色なしの版が${olds}個あります。「色つきに入れ替え」で、そのまま色つきにできます。` : ''));
  render();
})();
