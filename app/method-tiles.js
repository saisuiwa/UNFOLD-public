// The tiles of the method grid, shared by the single-image page and the sequence page:
// the 37 built-in methods, then every custom one (blue frame, ⚙ menu, a badge when it is not usable), then the "＋自作メソッド" tile.
import { BUILTIN_KEYS, getCustom, isCustomKey, listCustom, methodIcon, methodLabel } from './method-registry.js';
import { statusText } from './method-menu.js';

function face(key) {
  const [symbol, en] = methodIcon(key);
  const sym = document.createElement('span');
  sym.className = 'symbol'; sym.textContent = symbol;
  const small = document.createElement('small');
  small.textContent = en;
  return [sym, methodLabel(key), small];
}

function tile(key, { onPick, onMenu }) {
  const button = document.createElement('button');
  button.type = 'button'; button.dataset.method = key; button.setAttribute('aria-pressed', 'false');
  button.append(...face(key));
  if (!isCustomKey(key)) { button.onclick = e => onPick(key, e); return button; }

  const record = getCustom(key), usable = record.status === 'ok';
  button.classList.add('added');
  if (!usable) { button.classList.add('unusable'); button.querySelector('small').textContent = statusText(record.status); }
  const gear = document.createElement('button');
  gear.type = 'button'; gear.className = 'tile-gear'; gear.textContent = '⚙';
  gear.title = `${record.name}のメニュー`; gear.setAttribute('aria-label', gear.title);
  button.onclick = e => (usable ? onPick(key, e) : onMenu(key, gear));
  gear.onclick = e => { e.stopPropagation(); onMenu(key, gear); };
  const wrap = document.createElement('div');
  wrap.className = 'method-tile';
  wrap.append(button, gear);
  return wrap;
}

function addTile(onAdd) {
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'add-method';
  const sym = document.createElement('span');
  sym.className = 'symbol'; sym.textContent = '＋';
  const small = document.createElement('small');
  small.textContent = 'NEW';
  button.append(sym, '自作メソッド', small);
  button.onclick = () => onAdd();
  return button;
}

// "ファイルから読み込み": a method somebody handed over as a .unfoldmethod file (it is the same kind of tile as "＋自作メソッド")
function importTile(onImport) {
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'add-method import-method';
  const sym = document.createElement('span');
  sym.className = 'symbol'; sym.textContent = '⇩';
  const small = document.createElement('small');
  small.textContent = 'IMPORT';
  button.append(sym, 'ファイルから読み込み', small);
  button.onclick = () => onImport();
  return button;
}

// rebuilds the tiles only when the list (or a name, symbol or status in it) changed; returns whether it did
export function syncMethodTiles(grid, { onPick, onAdd, onMenu, onImport = null, tag = null }) {
  const keys = [...BUILTIN_KEYS, ...listCustom().map(c => c.id)];
  const signature = keys.map(k => `${k}|${methodLabel(k)}|${methodIcon(k)[0]}|${getCustom(k)?.status ?? ''}`).join(',');
  if (grid.dataset.signature === signature) return false;
  grid.dataset.signature = signature;
  grid.replaceChildren(...keys.map(k => tile(k, { onPick, onMenu })), addTile(onAdd), ...(onImport ? [importTile(onImport)] : []));
  if (tag) tag.textContent = `${keys.length} METHODS`;
  return true;
}

// the buttons that stand for a method (the ⚙ and the "＋" tile are not among them)
export const methodButtons = grid => [...grid.querySelectorAll('button[data-method]')];
