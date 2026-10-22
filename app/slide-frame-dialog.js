// The dialog that asks how a picture sits in the 16:9 frame: whole, filling the frame (choose which part), or cut out freely.
// It opens when a picture far from 16:9 is added, and again from the slide's panel ("切り抜き・収め方を調整").
//   askSlideFrame({ img, name, bg, fill, W, H, position, total, initial, adjust })
//     → Promise of null (backed out) or { frame, choice, rest }
//       frame:  what to keep on the slide (undefined = nothing: the project-wide setting decides)
//       choice: { mode: 'whole' | 'screen' | 'free', cx, cy, zoom }, for "残りも同じ設定で" (never for a free cut-out)
//       rest:   true when "残りも同じ設定で" was pressed
//   position / total: which of the pictures being added this is (the first of 3, ...); both left out when a slide is being adjusted.
//   initial: the slide's frame, when adjusting one that has a frame; adjust: true when a picture already in is being adjusted (frame or not).
//   W, H: the frame's size (1920×1080 in the sequence; the output's shape in the single-picture page).
import { aspectCrop, cleanFrame, coverLoss, framePlacement } from './slide-frame.js?v=1';

const STYLE_ID = 'slide-frame-dialog-style';
const CSS = `
.sfd-back{position:fixed;inset:0;z-index:2000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(5,9,9,.72)}
.sfd{box-sizing:border-box;width:min(940px,100%);max-height:100%;overflow:auto;background:var(--panel,#171e1f);color:var(--ink,#eef0e2);border:1px solid var(--line,#2a3334);border-radius:10px;padding:18px 20px 16px;font:14px/1.6 system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif}
.sfd h2{margin:0 0 4px;font-size:16px;display:flex;gap:10px;align-items:baseline}
.sfd h2 small{font-size:12px;color:var(--dim,#96a19b);font-weight:400}
.sfd .sfd-note{margin:0 0 12px;color:var(--dim,#96a19b);font-size:13px}
.sfd-body{display:flex;gap:18px;flex-wrap:wrap}
.sfd-left{flex:1 1 360px;min-width:0}
.sfd-right{flex:1 1 280px;min-width:0;display:flex;flex-direction:column;gap:10px}
.sfd-stage{position:relative;display:inline-block;line-height:0;touch-action:none;user-select:none;-webkit-user-select:none;border-radius:4px;outline-offset:3px;max-width:100%;overflow:hidden}   /* overflow: the dimming shadow of the kept part stays on the picture */
.sfd-stage canvas{display:block;border-radius:4px;background:#000}
.sfd-crop{position:absolute;box-sizing:border-box;border:2px solid var(--accent,#d9f878);box-shadow:0 0 0 9999px rgba(8,12,12,.62);cursor:move}
.sfd-crop[hidden]{display:none}
.sfd-crop i{position:absolute;width:18px;height:18px;background:var(--accent,#d9f878);border:2px solid #111718;box-sizing:border-box}
.sfd-crop i[data-h=nw]{left:-2px;top:-2px;cursor:nwse-resize}.sfd-crop i[data-h=ne]{right:-2px;top:-2px;cursor:nesw-resize}
.sfd-crop i[data-h=sw]{left:-2px;bottom:-2px;cursor:nesw-resize}.sfd-crop i[data-h=se]{right:-2px;bottom:-2px;cursor:nwse-resize}
.sfd-zoom{display:flex;gap:10px;align-items:center;margin-top:10px;font-size:13px;color:var(--dim,#96a19b)}
.sfd-zoom[hidden]{display:none}.sfd-zoom input{flex:1}
.sfd-modes{display:flex;flex-direction:column;gap:6px;border:0;margin:0;padding:0}
.sfd-modes label{display:flex;gap:9px;align-items:flex-start;padding:8px 10px;border:1px solid var(--line,#2a3334);border-radius:8px;cursor:pointer}
.sfd-modes label:has(input:checked){border-color:var(--accent,#d9f878);background:rgba(217,248,120,.07)}
.sfd-modes label:has(input:focus-visible){outline:2px solid var(--accent,#d9f878);outline-offset:2px}
.sfd-modes input{margin-top:4px}.sfd-modes b{display:block;font-weight:600}.sfd-modes span{display:block;font-size:12px;color:var(--dim,#96a19b)}
.sfd-result{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--dim,#96a19b)}
.sfd-result canvas{width:100%;max-width:320px;aspect-ratio:16/9;border:1px solid var(--line,#2a3334);border-radius:4px;background:#000}
.sfd-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;margin-top:14px}
.sfd-actions button{font:inherit;color:var(--ink,#eef0e2);background:transparent;border:1px solid var(--line,#2a3334);border-radius:7px;padding:7px 14px;cursor:pointer}
.sfd-actions button:hover{border-color:var(--dim,#96a19b)}.sfd-actions button:focus-visible{outline:2px solid var(--accent,#d9f878);outline-offset:2px}
.sfd-actions button.sfd-main{background:var(--accent,#d9f878);color:#111718;border-color:var(--accent,#d9f878);font-weight:700}
.sfd-actions .sfd-gap{flex:1}
`;
const MIN_SIDE = .04;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
// props become properties; attrs (role, aria-*) are set as attributes, which every browser understands
const el = (tag, props = {}, ...kids) => { const { attrs, ...rest } = props, e = Object.assign(document.createElement(tag), rest); for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v); e.append(...kids); return e; };
const ratioWord = (W, H) => Math.abs(W / H - 16 / 9) < .01 ? '16:9' : Math.abs(W / H - 1) < .01 ? '1:1' : Math.abs(W / H - 9 / 16) < .01 ? '9:16' : `${W}:${H}`;
const shapeWord = (w, h) => {
  const r = w / h;
  if (Math.abs(r - 1) < .04) return '正方形';
  return `${r > 1 ? '横長' : '縦長'}（比率 ${r >= 1 ? r.toFixed(2) + ' : 1' : '1 : ' + (1 / r).toFixed(2)}）`;
};

// two questions at once (two drops in a row) are asked one after the other
let line = Promise.resolve();
export function askSlideFrame(options = {}) {
  const run = () => openDialog(options);
  const answer = line.then(run, run);
  line = answer.catch(() => {});
  return answer;
}

function openDialog({ img, name = '', bg = '#111718', fill = true, W = 1920, H = 1080, position, total, initial, adjust = !!initial } = {}) {
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, A = W / H;
  const remaining = total && position ? total - position : 0;
  if (!document.getElementById(STYLE_ID)) document.head.append(el('style', { id: STYLE_ID, textContent: CSS }));

  // ---- the state: a mode and, outside "whole", the part that is kept
  const full = () => aspectCrop(iw, ih, A);
  const zoomOf = c => Math.max(1, full().w / c.w);
  const start = (() => {
    const f = cleanFrame(initial);
    if (f?.crop && (f.fit ?? (fill ? 'cover' : 'contain')) === 'contain' && Math.abs(f.crop.w * iw / (f.crop.h * ih) / A - 1) >= .002) return { mode: 'free', crop: f.crop };
    if (f?.crop) return { mode: 'screen', crop: f.crop };
    if (f) return { mode: f.fit === 'contain' ? 'whole' : 'screen', crop: aspectCrop(iw, ih, A) };
    return { mode: adjust && fill ? 'screen' : 'whole', crop: aspectCrop(iw, ih, A) };   // no frame yet: the slide fills the frame when the project says so
  })();
  const state = { mode: start.mode, crop: { ...start.crop } };

  return new Promise(resolve => {
    const opener = document.activeElement;
    const id = `sfd-${Math.random().toString(36).slice(2, 7)}`;
    // ---- the picture, with the kept part drawn over it
    const shown = Math.min(1, Math.min(560, innerWidth - 80) / iw, Math.min(420, innerHeight * .46) / ih);
    const cw = Math.max(80, Math.round(iw * shown)), ch = Math.max(45, Math.round(ih * shown)), dpr = Math.min(2, devicePixelRatio || 1);
    const stageCanvas = el('canvas', { width: Math.round(cw * dpr), height: Math.round(ch * dpr) });
    stageCanvas.style.width = cw + 'px'; stageCanvas.style.height = ch + 'px';
    stageCanvas.getContext('2d').drawImage(img, 0, 0, stageCanvas.width, stageCanvas.height);
    const handles = ['nw', 'ne', 'sw', 'se'].map(h => { const i = el('i', { attrs: { 'aria-hidden': 'true' } }); i.dataset.h = h; return i; });
    const crop = el('div', { className: 'sfd-crop' }, ...handles);
    const stage = el('div', { className: 'sfd-stage', tabIndex: 0, attrs: { role: 'group', 'aria-label': '切り抜きの範囲。ドラッグで動かす、矢印キーで少しずつ動かす' } }, stageCanvas, crop);

    const zoom = el('input', { type: 'range', min: 100, max: 400, step: 1, value: 100, attrs: { 'aria-label': '拡大' } });
    const zoomText = el('span', { textContent: '100%' });
    const zoomRow = el('div', { className: 'sfd-zoom' }, el('span', { textContent: '拡大' }), zoom, zoomText);

    const resultCanvas = el('canvas', { width: 320, height: 180 });
    const resultNote = el('div');
    const result = el('div', { className: 'sfd-result' }, el('span', { textContent: '仕上がり（画面に出るところ）' }), resultCanvas, resultNote);

    const radio = (value, title, hint) => {
      const input = el('input', { type: 'radio', name: id, value }); input.onchange = () => setMode(value);
      return { value, input, label: el('label', {}, input, el('div', {}, el('b', { textContent: title }), el('span', { textContent: hint }))) };
    };
    const modes = [
      radio('whole', '全体を見せる', '切らずに全部出します。余りは背景色になります。'),
      radio('screen', '画面いっぱいにする', '画面の形で切り抜きます。枠をドラッグして、見せたいところを選びます。'),
      radio('free', '自由に切り抜く', '好きな形で切り抜いて、その全体を見せます。四隅で大きさを変えられます。'),
    ];

    // ---- the buttons
    const cancel = el('button', { type: 'button', textContent: 'やめる' });
    const reset = initial ? el('button', { type: 'button', textContent: '全体設定に戻す', title: '「画面いっぱいに表示」の設定どおりにします（切り抜きは消えます）' }) : null;
    const rest = remaining > 0 ? el('button', { type: 'button' }) : null;
    const ok = el('button', { type: 'button', className: 'sfd-main', textContent: adjust ? '決定' : '取り込む' });
    const actions = el('div', { className: 'sfd-actions' }, ...(reset ? [reset] : []), el('span', { className: 'sfd-gap' }), cancel, ...(rest ? [rest] : []), ok);

    const title = el('h2', { id: id + '-t' }, '画像の収め方', ...(total > 1 ? [el('small', { textContent: `${position} / ${total} 枚目` })] : []));
    const differs = coverLoss(iw, ih, W, H) > .03, screenWord = `画面（${ratioWord(W, H)}）`;
    const note = el('p', { className: 'sfd-note', textContent: differs ? `「${name || '画像'}」は${shapeWord(iw, ih)}で、${screenWord}と形が違います。画面いっぱいにすると見切れるので、どう収めるか選んでね。` : `「${name || '画像'}」の収め方を選びます。` });
    const body = el('div', { className: 'sfd-body' }, el('div', { className: 'sfd-left' }, stage, zoomRow), el('div', { className: 'sfd-right' }, el('fieldset', { className: 'sfd-modes', attrs: { 'aria-label': '収め方' } }, ...modes.map(m => m.label)), result));
    const box = el('div', { className: 'sfd', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': id + '-t' } }, title, note, body, actions);
    const back = el('div', { className: 'sfd-back' }, box);

    // ---- what is kept, as a frame / a choice
    const choiceNow = () => {
      if (state.mode === 'whole') return { mode: 'whole' };
      const c = state.crop;
      return { mode: state.mode, cx: c.x + c.w / 2, cy: c.y + c.h / 2, zoom: zoomOf(c) };
    };
    const frameNow = () => state.mode === 'whole' ? { fit: 'contain' } : cleanFrame({ fit: state.mode === 'screen' ? 'cover' : 'contain', crop: state.crop });

    function paint() {
      const screen = state.mode === 'screen', free = state.mode === 'free';
      crop.hidden = !(screen || free); zoomRow.hidden = !screen;
      const c = state.crop;
      Object.assign(crop.style, { left: c.x * 100 + '%', top: c.y * 100 + '%', width: c.w * 100 + '%', height: c.h * 100 + '%' });
      for (const m of modes) m.input.checked = m.value === state.mode;
      if (screen) { const z = zoomOf(c); zoom.value = Math.round(z * 100); zoomText.textContent = Math.round(z * 100) + '%'; }
      if (rest) { rest.textContent = `残り${remaining}枚も同じ設定で取り込む`; rest.hidden = free; }
      const x = resultCanvas.getContext('2d'), k = resultCanvas.width / W;
      x.fillStyle = bg; x.fillRect(0, 0, resultCanvas.width, resultCanvas.height);
      const p = framePlacement(iw, ih, frameNow(), fill, W, H);
      x.drawImage(img, p.sx, p.sy, p.sw, p.sh, p.dx * k, p.dy * k, p.dw * k, p.dh * k);
      resultNote.textContent = state.mode === 'whole' ? '全体が見えます（余りは背景色）。' : free ? '切り抜いた全体が見えます。' : '枠の中だけが画面いっぱいに出ます。';
    }
    function setMode(mode) {
      if (mode === state.mode) return;
      const c = state.crop, cx = c.x + c.w / 2, cy = c.y + c.h / 2;
      if (mode === 'screen') state.crop = aspectCrop(iw, ih, A, { cx, cy, zoom: state.mode === 'free' ? 1 : zoomOf(c) });
      else if (mode === 'free' && state.mode === 'whole') state.crop = { x: .1, y: .1, w: .8, h: .8 };
      state.mode = mode; paint();
    }
    function setZoom(z) {
      const c = state.crop;
      state.crop = aspectCrop(iw, ih, A, { cx: c.x + c.w / 2, cy: c.y + c.h / 2, zoom: clamp(z, 1, 4) }); paint();
    }
    zoom.oninput = () => setZoom(Number(zoom.value) / 100);

    // ---- dragging: the middle moves the part, a corner changes its size (in "画面いっぱい" the shape stays the screen's)
    let drag = null;
    const at = e => { const r = stageCanvas.getBoundingClientRect(); return { x: clamp((e.clientX - r.left) / r.width, 0, 1), y: clamp((e.clientY - r.top) / r.height, 0, 1) }; };
    stage.addEventListener('pointerdown', e => {
      if (state.mode === 'whole') return;
      const p = at(e), h = e.target.dataset?.h;
      if (!h && e.target !== crop) { const c = state.crop; state.crop = { ...c, x: clamp(p.x - c.w / 2, 0, 1 - c.w), y: clamp(p.y - c.h / 2, 0, 1 - c.h) }; paint(); }   // a click outside brings the part there
      stage.setPointerCapture(e.pointerId); stage.focus({ preventScroll: true });
      drag = { h, p0: p, c0: { ...state.crop } }; e.preventDefault();
    });
    stage.addEventListener('pointermove', e => {
      if (!drag) return;
      const p = at(e), c0 = drag.c0;
      if (!drag.h) { state.crop = { ...c0, x: clamp(c0.x + p.x - drag.p0.x, 0, 1 - c0.w), y: clamp(c0.y + p.y - drag.p0.y, 0, 1 - c0.h) }; paint(); return; }
      const east = drag.h.includes('e'), south = drag.h.includes('s');
      const ax = east ? c0.x : c0.x + c0.w, ay = south ? c0.y : c0.y + c0.h;       // the opposite corner stays where it is
      const room = { w: east ? 1 - ax : ax, h: south ? 1 - ay : ay };
      let w = clamp(Math.abs(p.x - ax), MIN_SIDE, room.w), h = clamp(Math.abs(p.y - ay), MIN_SIDE, room.h);
      if (state.mode === 'screen') {
        const k = iw / (A * ih);                                                    // height as a fraction when the width is w
        w = Math.max(MIN_SIDE, w); h = w * k;
        if (h > room.h) { h = room.h; w = h / k; }
        if (w > room.w) { w = room.w; h = w * k; }
      }
      state.crop = { x: east ? ax : ax - w, y: south ? ay : ay - h, w, h }; paint();
    });
    const endDrag = () => { drag = null; };
    stage.addEventListener('pointerup', endDrag); stage.addEventListener('pointercancel', endDrag);
    stage.addEventListener('wheel', e => { if (state.mode !== 'screen') return; e.preventDefault(); setZoom(zoomOf(state.crop) * (e.deltaY < 0 ? 1.06 : 1 / 1.06)); }, { passive: false });
    stage.addEventListener('keydown', e => {
      if (state.mode === 'whole') return;
      const step = e.shiftKey ? .05 : .01, c = state.crop, d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (d) { e.preventDefault(); state.crop = { ...c, x: clamp(c.x + d[0], 0, 1 - c.w), y: clamp(c.y + d[1], 0, 1 - c.h) }; paint(); }
      else if (state.mode === 'screen' && (e.key === '+' || e.key === '=')) { e.preventDefault(); setZoom(zoomOf(c) * 1.1); }
      else if (state.mode === 'screen' && (e.key === '-' || e.key === '_')) { e.preventDefault(); setZoom(zoomOf(c) / 1.1); }
    });

    // ---- closing
    const done = value => { back.remove(); removeEventListener('keydown', onKey, true); opener?.focus?.({ preventScroll: true }); resolve(value); };
    cancel.onclick = () => done(null);
    ok.onclick = () => done({ frame: frameNow(), choice: choiceNow(), rest: false });
    if (rest) rest.onclick = () => done({ frame: frameNow(), choice: choiceNow(), rest: true });
    if (reset) reset.onclick = () => done({ frame: undefined, choice: { mode: 'whole' }, rest: false });
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(null); return; }
      if (e.key === 'Tab') {                                                        // keep the focus inside
        const f = [...box.querySelectorAll('button,input,[tabindex="0"]')].filter(x => !x.hidden && !x.closest('[hidden]') && !x.disabled);
        if (!f.length) return;
        const first = f[0], last = f.at(-1);
        if (e.shiftKey && (document.activeElement === first || !box.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (document.activeElement === last || !box.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
      }
    }
    addEventListener('keydown', onKey, true);
    // the page's own shortcuts (space plays, arrows seek) must not act on keys meant for the dialog; Enter decides unless a button or the picture has the focus
    box.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.target.closest?.('button,.sfd-stage')) { e.preventDefault(); ok.click(); }
      e.stopPropagation();
    });
    document.body.append(back);
    paint();
    (modes.find(m => m.value === state.mode)?.input || ok).focus({ preventScroll: true });
  });
}
