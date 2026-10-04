// UI preference only: never changes a project's camera, timing or export size.
const main = document.querySelector('main.seq3');
const panel = main.querySelector('aside.right');
const handle = document.createElement('div');
const key = 'unfold-sequence-panel-width';
handle.className = 'panel-resizer';
handle.tabIndex = 0;
handle.setAttribute('role', 'separator');
handle.setAttribute('aria-orientation', 'vertical');
handle.setAttribute('aria-label', '編集パネルの幅');
handle.setAttribute('aria-controls', 'sequence-edit-panel');
handle.title = '左へドラッグで広げる・左右キーで調整・ダブルクリックで元に戻す';
panel.id = 'sequence-edit-panel';
main.append(handle);
let preferred = 340;
try { const saved = Number(localStorage.getItem(key)); if (Number.isFinite(saved) && saved >= 340) preferred = saved; } catch {}
const maximum = () => Math.max(340, Math.min(800, main.clientWidth - 610));
function apply(width, save = false) {
  const value = Math.round(Math.max(340, Math.min(maximum(), width)));
  main.style.setProperty('--edit-panel-width', `${value}px`);
  handle.setAttribute('aria-valuemin', '340');
  handle.setAttribute('aria-valuemax', String(maximum()));
  handle.setAttribute('aria-valuenow', String(value));
  if (save) {
    preferred = value;
    try { localStorage.setItem(key, String(value)); } catch {}
  }
}
let drag = null;
handle.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  e.preventDefault();
  handle.focus();
  drag = { id: e.pointerId, x: e.clientX, width: panel.getBoundingClientRect().width };
  handle.setPointerCapture(e.pointerId);
  main.classList.add('resizing-panel');
});
handle.addEventListener('pointermove', e => {
  if (drag?.id === e.pointerId) apply(drag.width + drag.x - e.clientX);
});
function finish(e) {
  if (!drag || drag.id !== e.pointerId) return;
  drag = null;
  main.classList.remove('resizing-panel');
  apply(Number(handle.getAttribute('aria-valuenow')), true);
}
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) handle.addEventListener(event, finish);
handle.addEventListener('dblclick', () => apply(340, true));
handle.addEventListener('keydown', e => {
  const now = Number(handle.getAttribute('aria-valuenow'));
  const widths = { ArrowLeft: now + 20, ArrowRight: now - 20, Home: 340, End: maximum() };
  if (!(e.key in widths)) return;
  e.preventDefault();
  apply(widths[e.key], true);
});
window.addEventListener('resize', () => apply(preferred));
apply(preferred);
