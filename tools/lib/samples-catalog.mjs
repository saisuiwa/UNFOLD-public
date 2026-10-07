// The one list of samples that the preview maker, the page builder and the daily check all read:
// the editor's method samples (method / graphic) and the lyric text motions (text). Add a sample in app/, never here.
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SAMPLES, SAMPLE_GROUPS } from '../../app/method-samples.js';
import { TEXT_MOTIONS } from '../../app/lyric-motion.js';

export const PREVIEW_DIR = fileURLToPath(new URL('../../app/guide/samples/', import.meta.url));
export const GROUPS = [...SAMPLE_GROUPS, ['text', 'テキストモーション']];
// the size limits the previews must stay under (they go into Git, so a few a day must not pile up)
export const MAX_BYTES = { jpg: 80 * 1024, mp4: 400 * 1024 };

// { id, group, key, name, desc, added, poster?, symbol?, source? }: the groups as listed, each in the order it was added (oldest first; the page turns that around)
export function catalog() {
  return GROUPS.flatMap(([group]) => group === 'text'
    ? Object.entries(TEXT_MOTIONS).map(([key, m]) => ({ id: `text-${key}`, group, key, name: m.label, desc: m.desc, added: m.added, poster: m.poster }))
    : SAMPLES.filter(s => s.category === group).map(s => ({ id: `${group}-${s.key}`, group, key: s.key, name: s.name, desc: s.desc, added: s.added, poster: s.poster, symbol: s.symbol, source: s.source })));
}

export const previewFiles = id => ({ jpg: `${PREVIEW_DIR}${id}.jpg`, mp4: `${PREVIEW_DIR}${id}.mp4` });
export const sizeOf = file => (existsSync(file) ? statSync(file).size : 0);
