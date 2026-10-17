// The one list of samples that the preview maker, the page builder and the daily check all read. Add a sample in app/, never here.
//   method, graphic   GLSL custom methods (app/method-samples.js)                          the editor's presets and the workshop's "GLSL" samples
//   image             JavaScript image methods (app/image-method-daily.js)                  the workshop's "image / solid / physics" samples
//   codetext          text code motions (app/code-motion-daily.js)                          the workshop's "text motion" samples
//   effect            decorations that go behind or around the text (the entries of the same file marked shelf: 'effect')   the workshop's "エフェクト" tab
//   cutpart           parts of STUDIO's カット割り (app/studio/cuts/daily-parts.js)        joined to the part tables; おまかせ「✂ カット割り」 picks them
//   text              the preset text motions (TEXT_MOTIONS in app/lyric-motion.js)         the "動き" select of a lyric line
// The daily routine adds one each of method and image, and many cut parts (since 2026-10-18; before that one codetext a day). graphic, text and codetext stay, but nothing new goes in.
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SAMPLES, SAMPLE_GROUPS } from '../../app/method-samples.js';
import { TEXT_MOTIONS } from '../../app/lyric-motion.js';
import { DAILY_IMAGE_METHODS } from '../../app/image-method-daily.js';
import { DAILY_CODE_MOTIONS } from '../../app/code-motion-daily.js';
import { DAILY_CUT_PARTS } from '../../app/studio/cuts/daily-parts.js';
import { AXES } from '../../app/studio/cuts/kit.js';

export const PREVIEW_DIR = fileURLToPath(new URL('../../app/guide/samples/', import.meta.url));
export const GROUPS = [...SAMPLE_GROUPS, ['image', '画像・立体・物理（JavaScript）'], ['codetext', '文字モーション（コード）'], ['effect', 'エフェクト（文字の後ろや周りの装飾）'], ['cutpart', 'カット割りの部品（STUDIO）'], ['text', '文字の動き（かんたん設定）']];
export const DAILY_GROUPS = ['method', 'image', 'cutpart'];                                   // what the routine adds every day: one method, one image method, many cut parts
export const CUT_PARTS_FROM = '2026-10-18';                                                   // the first day of the cut part quota (before it: one codetext a day)
export const DAILY_CUT_PARTS_MIN = 6;                                                          // the fewest cut parts a day (the routine aims at about 8)
export const AXIS_NAMES = AXES;
// the size limits the previews must stay under (they go into Git, so a few a day must not pile up)
export const MAX_BYTES = { jpg: 80 * 1024, mp4: 600 * 1024 };

// { id, group, key, name, desc, added, poster?, symbol?, source?, code? }: the groups as listed, each in the order it was added (oldest first; the page turns that around)
export function catalog() {
  return GROUPS.flatMap(([group]) => {
    if (group === 'text') return Object.entries(TEXT_MOTIONS).map(([key, m]) => ({ id: `text-${key}`, group, key, name: m.label, desc: m.desc, added: m.added, poster: m.poster }));
    if (group === 'image') return DAILY_IMAGE_METHODS.map(m => ({ id: `image-${m.key}`, group, key: m.key, name: m.name, desc: m.desc, added: m.added, poster: m.poster, symbol: m.symbol, source: m.code.source, code: m.code }));
    if (group === 'cutpart') return DAILY_CUT_PARTS.map(p => ({ id: `cut-${p.axis}-${p.key}`, group, key: p.key, axis: p.axis, name: p.name, desc: p.desc, added: p.added, poster: p.poster }));
    if (group === 'codetext' || group === 'effect') return DAILY_CODE_MOTIONS.filter(m => (m.shelf === 'effect') === (group === 'effect')).map(m => ({ id: `${group}-${m.key}`, group, key: m.key, name: m.name, desc: m.desc, added: m.added, poster: m.poster, source: m.source }));
    return SAMPLES.filter(s => s.category === group).map(s => ({ id: `${group}-${s.key}`, group, key: s.key, name: s.name, desc: s.desc, added: s.added, poster: s.poster, symbol: s.symbol, source: s.source }));
  });
}

export const previewFiles = id => ({ jpg: `${PREVIEW_DIR}${id}.jpg`, mp4: `${PREVIEW_DIR}${id}.mp4` });
export const sizeOf = file => (existsSync(file) ? statSync(file).size : 0);
