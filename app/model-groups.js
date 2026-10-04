// Groups ("tabs") for the saved GLBs: with dozens of shapes in the library, the list is switched by tab instead of scrolled.
// A group is just a short text kept in the model's metadata (`group`); a model without one is "未分類". The pure functions here are tested
// (tools/test/model-groups.test.mjs); the two small DOM helpers at the bottom are shared by the sequence page and the one-picture page.

export const DEFAULT_GROUPS = ['動物・生き物', '植物', '乗り物', '楽器・音楽', '人物', 'もの・風景', 'キャラクター'];
export const ALL = '*';          // the "すべて" tab
export const UNGROUPED = '';     // models without a group
export const UNGROUPED_LABEL = '未分類';
export const MAX_GROUP_LENGTH = 20;

// a group name typed by the user: trimmed, no control characters, not the reserved "all" marker, short enough
export function cleanGroupName(raw) {
  if (typeof raw !== 'string') return '';
  const s = raw.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_GROUP_LENGTH);
  return s === ALL || s === UNGROUPED_LABEL ? '' : s;
}

export const groupOf = model => cleanGroupName(model?.group);

// the groups to offer, in a stable order: the standard ones first (in their order), then the user's own ones alphabetically
export function groupNames(models, { includeDefaults = false } = {}) {
  const used = new Set(models.map(groupOf).filter(Boolean));
  if (includeDefaults) for (const g of DEFAULT_GROUPS) used.add(g);
  const std = DEFAULT_GROUPS.filter(g => used.has(g));
  const own = [...used].filter(g => !DEFAULT_GROUPS.includes(g)).sort((a, b) => a.localeCompare(b, 'ja'));
  return [...std, ...own];
}

// [{ key, label, count }] for the tab strip: すべて, every group in use, and 未分類 when some model has none
export function tabList(models) {
  const counts = new Map();
  for (const m of models) counts.set(groupOf(m), (counts.get(groupOf(m)) || 0) + 1);
  const tabs = [{ key: ALL, label: 'すべて', count: models.length }];
  for (const g of groupNames(models)) tabs.push({ key: g, label: g, count: counts.get(g) || 0 });
  if (counts.get(UNGROUPED)) tabs.push({ key: UNGROUPED, label: UNGROUPED_LABEL, count: counts.get(UNGROUPED) });
  return tabs;
}

// tabs make sense once there is something to switch between
export const wantsTabs = models => models.length > 8 || tabList(models).length > 2;

export const inGroup = (model, active) => active === ALL || groupOf(model) === active;
export const filterByGroup = (models, active) => models.filter(m => inGroup(m, active));

// the tab to show: the remembered one, unless it no longer exists (then すべて)
export function validActive(models, active) {
  return tabList(models).some(t => t.key === active) ? active : ALL;
}

// ---------------------------------------------------------------- DOM helpers --
const store = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, v) { try { localStorage.setItem(key, v); } catch { /* private mode: the tab is simply not remembered */ } },
};
export const loadActive = key => store.get(key) ?? ALL;
export const saveActive = (key, v) => store.set(key, v);

// A strip of tab buttons (role=tablist). onSelect(key) is called on click; the strip scrolls sideways when it does not fit.
export function renderTabs(models, active, onSelect) {
  const strip = document.createElement('div');
  strip.className = 'group-tabs'; strip.setAttribute('role', 'tablist'); strip.setAttribute('aria-label', 'GLBのグループ');
  for (const t of tabList(models)) {
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(t.key === active));
    b.dataset.group = t.key; b.title = `${t.label}（${t.count}個）`;
    b.append(document.createTextNode(t.label));
    const n = document.createElement('small'); n.textContent = String(t.count); b.append(n);
    b.onclick = () => onSelect(t.key);
    strip.append(b);
  }
  return strip;
}

// A <select> to put one model in a group (or a new one). onChange(groupName) gets the cleaned name ('' = 未分類).
export function groupSelect(models, current, onChange) {
  const sel = document.createElement('select');
  sel.className = 'group-select'; sel.setAttribute('aria-label', 'グループ');
  const add = (value, label) => { const o = document.createElement('option'); o.value = value; o.textContent = label; sel.append(o); };
  add('', UNGROUPED_LABEL);
  for (const g of groupNames(models, { includeDefaults: true })) add('g:' + g, g);
  add('new', '＋ 新しいグループ…');
  sel.value = current ? 'g:' + current : '';
  if (sel.value !== (current ? 'g:' + current : '')) { add('g:' + current, current); sel.value = 'g:' + current; }
  sel.onchange = () => {
    if (sel.value === 'new') {
      const name = cleanGroupName(prompt(`新しいグループの名前（${MAX_GROUP_LENGTH}文字まで）`) || '');
      if (!name) { sel.value = current ? 'g:' + current : ''; return; }
      onChange(name);
    } else onChange(sel.value.startsWith('g:') ? sel.value.slice(2) : '');
  };
  return sel;
}
