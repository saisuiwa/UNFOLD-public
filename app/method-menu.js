// The small menu behind the ⚙ of a custom tile: edit, copy, delete (asks twice), and "try again" for a method that was switched off.
import { getCustom, onRegistryChange, setCustomStatus } from './method-registry.js';

const STATUS_TEXT = { disabled: '停止中', quarantined: '未確認', crashed: '落ちた' };
export const statusText = status => STATUS_TEXT[status] ?? '';

let openMenu = null;
export function closeMethodMenu() { openMenu?.(); }

export function openMethodMenu(anchor, id, { onEdit, onDuplicate, onDelete, onEnable = null, onReview = null, onExport = null }) {
  closeMethodMenu();
  const record = getCustom(id);
  if (!record) return;
  const menu = document.createElement('div');
  menu.className = 'method-menu'; menu.setAttribute('role', 'menu');
  const title = document.createElement('div');
  title.className = 'mm-title'; title.textContent = record.name;
  if (record.status !== 'ok') {
    const badge = document.createElement('span');
    badge.className = 'mm-badge'; badge.textContent = statusText(record.status);
    title.append(badge);
  }
  menu.append(title);
  if (record.status !== 'ok' && record.reason) {
    const reason = document.createElement('div');
    reason.className = 'mm-reason'; reason.textContent = record.reason;
    menu.append(reason);
  }
  const item = (label, action, className = '') => {
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'menuitem'); b.textContent = label;
    if (className) b.className = className;
    b.onclick = () => action(b);
    menu.append(b);
    return b;
  };
  // an unchecked method (from a file of someone else) is not switched back on by "try again": it has to be checked, or read and saved
  if (record.status === 'quarantined') {
    if (onEnable) item('有効にする（確認してから）', () => { closeMethodMenu(); onEnable(id); });
    item('コードを見る', () => { closeMethodMenu(); (onReview ?? onEdit)(id); });
  } else {
    if (record.status !== 'ok') item('もう一度試す', () => { closeMethodMenu(); setCustomStatus(id, 'ok', ''); });
    item('編集', () => { closeMethodMenu(); onEdit(id); });
  }
  item('複製', () => { closeMethodMenu(); onDuplicate(id); });
  if (onExport) item('ファイルに保存（.unfoldmethod）', () => { closeMethodMenu(); onExport(id); });
  let armed = false, timer = 0;
  item('削除', b => {
    if (!armed) { armed = true; b.textContent = 'もう一度押すと削除します'; timer = setTimeout(() => { armed = false; b.textContent = '削除'; }, 3000); return; }
    clearTimeout(timer); closeMethodMenu(); onDelete(id);
  }, 'danger');
  document.body.append(menu);

  const box = anchor.getBoundingClientRect();
  menu.style.left = `${Math.max(8, Math.min(box.left, innerWidth - menu.offsetWidth - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(box.bottom + 4, innerHeight - menu.offsetHeight - 8))}px`;

  const away = e => { if (!menu.contains(e.target)) closeMethodMenu(); };
  const escape = e => { if (e.key === 'Escape') closeMethodMenu(); };
  const stopWatching = onRegistryChange(() => closeMethodMenu());
  setTimeout(() => { document.addEventListener('pointerdown', away, true); document.addEventListener('keydown', escape, true); }, 0);
  openMenu = () => {
    clearTimeout(timer); stopWatching();
    document.removeEventListener('pointerdown', away, true); document.removeEventListener('keydown', escape, true);
    menu.remove(); openMenu = null;
  };
}
