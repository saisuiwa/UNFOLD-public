// Colour shapes that come with the app: GLBs in assets/models, listed with the built-in shapes and drawn in their own colours
// (tools/make_colour_samples.py makes them; colour-sample.glb is tools/make_colour_sample_glb.py). Ids start with "c-".
// Each is read on first use and kept. `fit: 'frame'` ones are laid out to fill the picture (see model-import.js) and are not pulled back.
import {importModel} from './model-import.js?v=13';

export const COLOUR_SHAPES = [
  {id: 'c-sample', name: 'カラー見本', icon: '◐', file: 'colour-sample.glb', colors: ['#ff6b6b', '#ffd93d', '#4dabf7']},
  {id: 'c-watermelon', name: 'スイカ', icon: '◒', file: 'watermelon.glb', colors: ['#7cc35a', '#2e8b3a', '#ff6b6b']},
  {id: 'c-donut', name: 'ドーナツ', icon: '◍', file: 'donut.glb', colors: ['#f48fb1', '#ffd54f', '#d99a52']},
  {id: 'c-saturn', name: '土星', icon: '♄', file: 'saturn.glb', colors: ['#eedfba', '#d8b27a', '#c9935a']},
  {id: 'c-icecream', name: 'アイス', icon: '▽', file: 'icecream.glb', colors: ['#a5e3c8', '#f6a6c1', '#e0a85a']},
  {id: 'c-snowman', name: '雪だるま', icon: '☃', file: 'snowman.glb', colors: ['#ffffff', '#b3e5fc', '#ff7a1a']},
  {id: 'c-solar', name: '太陽系', icon: '☉', file: 'solar.glb', colors: ['#ffb300', '#2e7dd7', '#d84315']},
  {id: 'c-blocks', name: '積み木', icon: '▤', file: 'blocks.glb', colors: ['#ff5252', '#ffd740', '#69f0ae', '#40c4ff']},
  {id: 'c-stardust', name: '星くず', icon: '✦', file: 'stardust.glb', colors: ['#ffd54f', '#f06292', '#64b5f6']},
  {id: 'c-rubik', name: 'ルービック', icon: '▦', file: 'rubik.glb', colors: ['#ff8f00', '#fafafa', '#1e88e5']},
  {id: 'c-balloons', name: '風船', icon: '❍', file: 'balloons.glb', colors: ['#ff5252', '#ffd740', '#7c4dff']},
  {id: 'c-gems', name: '宝石', icon: '◆', file: 'gems.glb', colors: ['#00bcd4', '#e91e63', '#7c4dff']},
  {id: 'c-dna', name: 'DNA', icon: '≋', file: 'dna.glb', colors: ['#ff4081', '#40c4ff', '#b2ff59']},
  {id: 'c-macarons', name: 'マカロン', icon: '⊜', file: 'macarons.glb', colors: ['#f8bbd0', '#b2dfdb', '#fff59d']},
  {id: 'c-dominoes', name: 'ドミノ', icon: '▮', file: 'dominoes.glb', colors: ['#ff1744', '#76ff03', '#2979ff']},
  {id: 'c-confetti', name: '紙吹雪', icon: '✲', file: 'confetti.glb', fit: 'frame', colors: ['#ff1744', '#ffea00', '#00e5ff', '#d500f9']},
  {id: 'c-hearts', name: 'ハート吹雪', icon: '♥', file: 'hearts.glb', fit: 'frame', colors: ['#ff1744', '#ff80ab', '#e040fb']},
];
const BY_ID = new Map(COLOUR_SHAPES.map(s => [s.id, s]));

export const isColourShape = id => typeof id === 'string' && BY_ID.has(id);
export const colourShape = id => BY_ID.get(id);
export const fillsFrame = id => BY_ID.get(id)?.fit === 'frame';

const cache = new Map();
// -> the same layout importModel gives a GLB (with `color`). opts.ordered: the picture laid on by position, as for a saved GLB.
export function loadColourShape(id, {ordered = false} = {}) {
  const s = BY_ID.get(id);
  if (!s) return Promise.reject(new Error('この形は見つかりません。'));
  const key = id + (ordered ? ':ordered' : '');
  if (!cache.has(key)) cache.set(key, fetch(new URL(`./assets/models/${s.file}`, import.meta.url))
    .then(r => { if (!r.ok) throw new Error(`${s.name}の形を読み込めませんでした（${r.status}）。`); return r.arrayBuffer(); })
    .then(buffer => importModel(buffer, {colors: true, ordered}))
    .catch(e => { cache.delete(key); throw e; }));
  return cache.get(key);
}

// the button's icon and name in the shape's own colours, so the colour shapes read apart from the plain built-in ones
export function paintColourLabel(el, id) {
  const s = BY_ID.get(id); if (!s) return;
  el.classList.add('colour-name');
  el.style.setProperty('--colour-grad', `linear-gradient(90deg,${s.colors.join(',')})`);
}
