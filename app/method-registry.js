import {workshopField} from './workshop-settings.js';
// Every 崩れ方 (method) in one place: the 29 built-in ones — their position in this list is the number the shader uses —
// and the custom ones users add. Saving custom methods is method-library.js's job; this module only keeps what is loaded now.
export const BUILTIN_METHODS = [
  ['crumple', 'くしゃくしゃ', '▱', 'CRUMPLE'], ['scatter', 'ばらばら', '⠿', 'SCATTER'], ['twist', 'ねじれ', '〰', 'TWIST'],
  ['wave', '波打ち', '≋', 'WAVE'], ['shatter', '砕ける', '✦', 'SHATTER'], ['peel', 'めくれ', '◸', 'PEEL'],
  ['melt', 'とける', '⌇', 'MELT'], ['fold', '折りたたみ', '⋀', 'FOLD'], ['shred', 'シュレッダー', '⦀', 'SHRED'],
  ['mosaic', 'モザイク', '▦', 'MOSAIC'], ['vortex', '渦に吸い込み', '◌', 'VORTEX'], ['confetti', '星とハート', '☆♡', 'CONFETTI'],
  ['dust', '塵になる', '⁘', 'DUST'], ['sparkle', 'きらめき', '✧', 'SPARKLE'], ['burst', '爆発', '✺', 'BURST'],
  ['swarm', '群れ', '⟳', 'SWARM'], ['rain', '雨', '⫶', 'RAIN'], ['snow', '雪', '❄', 'SNOW'],
  ['bubbles', '泡', '○', 'BUBBLES'], ['halftone', '網点', '⠶', 'HALFTONE'], ['ripple', '波紋', '◎', 'RIPPLE'],
  ['galaxy', '銀河', '✦', 'GALAXY'], ['tornado', '竜巻', '⌇', 'TORNADO'], ['wind', '風で飛ぶ', '≈', 'WIND'],
  ['blinds', 'ブラインド', '☰', 'BLINDS'], ['flip', 'タイル反転', '◧', 'FLIP'], ['glitch', 'グリッチ', '▚', 'GLITCH'],
  ['petals', '花びらが舞う', '❀', 'PETALS'], ['line', '線で描かれる', '✎', 'LINE DRAW'],
];
export const BUILTIN_KEYS = BUILTIN_METHODS.map(m => m[0]);
export const BUILTIN_IDS = Object.fromEntries(BUILTIN_KEYS.map((k, i) => [k, i]));
const BUILTIN_INFO = new Map(BUILTIN_METHODS.map(([key, label, symbol, en]) => [key, { label, symbol, en }]));
export const DEFAULT_KEY = 'crumple';
export const CUSTOM_PREFIX = 'cm-';
import {isImageMethodKey,cleanImageCode} from './image-method-format.js';
export {isImageMethodKey};
export const isCustomKey = key => typeof key === 'string' && (key.startsWith(CUSTOM_PREFIX)||isImageMethodKey(key));
// a new id for a custom method (crypto.randomUUID exists on https and localhost; elsewhere a random string stands in)
export const newCustomId = () => `${CUSTOM_PREFIX}${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`}`;

const customs = new Map(), listeners = new Set();
const emit = () => { for (const fn of [...listeners]) fn(); };
export function onRegistryChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

// vertex: the user's GLSL (it defines userMethod). rev goes up whenever the code is registered again, so cached shaders can tell they are stale.
// status: 'ok' | 'quarantined' | 'disabled' | 'crashed' — only 'ok' ones are used.
export function registerCustom({ id, name, symbol = '◆', vertex, code, workshop, status = 'ok', reason = '' }) {
  if (!isCustomKey(id)) throw new Error(`自作メソッドのidは "${CUSTOM_PREFIX}" で始めてね: ${id}`);
  const previous = customs.get(id);
  customs.set(id, { id, name: name || id, symbol: [...String(symbol || '◆')][0], vertex: String(vertex ?? ''), ...(isImageMethodKey(id)?{code:cleanImageCode(code)}:{}), ...workshopField(workshop??previous?.workshop), status, reason, rev: (previous?.rev ?? 0) + 1 });
  emit();
}
export function unregisterCustom(id) { if (customs.delete(id)) emit(); }
export function setCustomStatus(id, status, reason = '') {
  const record = customs.get(id);
  if (!record) return;
  record.status = status; record.reason = reason;
  emit();
}
export const getCustom = id => customs.get(id);
export const listCustom = () => [...customs.values()];

export const isUsable = key => isCustomKey(key) ? customs.get(key)?.status === 'ok' : typeof key === 'string' && Object.hasOwn(BUILTIN_IDS, key);
// the key itself when it can be used, otherwise the default method (a deleted, unchecked or broken custom method degrades to this)
export const resolveKey = key => key && isUsable(key) ? key : DEFAULT_KEY;

export const methodLabel = key => BUILTIN_INFO.get(key)?.label ?? customs.get(key)?.name ?? String(key);
export function methodIcon(key) {
  const builtin = BUILTIN_INFO.get(key);
  if (builtin) return [builtin.symbol, builtin.en];
  const custom = customs.get(key);
  return custom ? [custom.symbol, custom.code?'JS · PHYSICS':'CUSTOM'] : ['◆', String(key).toUpperCase()];
}
// [[key, label], ...] for <select>s: the built-in methods, then the usable custom ones. `current` stays in the list even when it can't be used.
export function methodEntries(current = '') {
  const entries = BUILTIN_METHODS.map(([key, label]) => [key, label]);
  for (const c of customs.values()) if (c.status === 'ok' || c.id === current) entries.push([c.id, c.status === 'ok' ? c.name : `${c.name}（使えません）`]);
  return entries;
}
