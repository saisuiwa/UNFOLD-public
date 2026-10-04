// The banner under the method grid: "N unchecked methods" with [コードを見る] [有効にする] for each. It follows the registry by itself.
import { listCustom, onRegistryChange } from './method-registry.js';

export function createQuarantineBanner(container, { onReview, onEnable }) {
  const busy = new Set();
  function render() {
    const list = listCustom().filter(c => c.status === 'quarantined');
    container.hidden = !list.length;
    if (!list.length) { container.replaceChildren(); return; }
    const title = document.createElement('div');
    title.className = 'qb-title';
    title.textContent = `未確認のメソッドが ${list.length} 個あります（他の人のファイルから取り込んだコードです）`;
    const note = document.createElement('div');
    note.className = 'qb-note';
    note.textContent = '確認が終わるまでは使われません。コードを読んでから、有効にしてね。';
    const rows = list.map(c => {
      const row = document.createElement('div');
      row.className = 'qb-row';
      const name = document.createElement('span');
      name.className = 'qb-name'; name.textContent = `${c.symbol} ${c.name}`;
      const view = document.createElement('button');
      view.type = 'button'; view.textContent = 'コードを見る'; view.onclick = () => onReview(c.id);
      const enable = document.createElement('button');
      enable.type = 'button'; enable.textContent = busy.has(c.id) ? '確認中…' : '有効にする'; enable.disabled = busy.has(c.id);
      enable.onclick = async () => { busy.add(c.id); render(); try { await onEnable(c.id); } finally { busy.delete(c.id); render(); } };
      row.append(name, view, enable);
      const wrap = document.createElement('div');
      wrap.append(row);
      // the reason of the last failed check (or the first note) is kept on the method, so it survives a reload
      if (c.reason) { const why = document.createElement('div'); why.className = 'qb-why'; why.textContent = c.reason; wrap.append(why); }
      return wrap;
    });
    container.replaceChildren(title, note, ...rows);
  }
  const stop = onRegistryChange(render);
  render();
  return { render, stop };
}
