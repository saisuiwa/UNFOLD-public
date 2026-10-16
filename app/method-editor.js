import { createRenderControls } from './render-look-controls.js?v=2';
// The custom-method editor: a <dialog> with a code box, a live preview and the checks that stand between the code and "save".
import { LIMITS, checkSource } from './method-guard.js';
import { compileUserMethod } from './custom-method.js';
import { getCustom, newCustomId, registerCustom } from './method-registry.js';
import { describeGlError } from './method-messages.js';
import { NEW_METHOD_SOURCE, SAMPLES, SAMPLE_GROUPS, aiTemplate } from './method-samples.js?v=14';
import { createPreview, makeTestImage } from './method-preview.js?v=4';
import { TRIAL, describeTrialPass } from './method-trial.js';
import { DRAFT_KEY } from './method-safety.js';

const readDraft = () => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY)); } catch { return null; } };
const writeDraft = draft => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* private mode: no draft */ } };
const clearDraft = () => { try { localStorage.removeItem(DRAFT_KEY); } catch { /* nothing to clear */ } };

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}
const MARKS = { ok: '✓', ng: '✗', wait: '…', skip: '–', warn: '!' };

export function createMethodEditor({ vertexShader, fragmentShader, getPreviewImage = () => null, getRenderLook = () => undefined, onApplyRenderLook = null, notify = () => {}, onSaved = () => {}, onExportFile = null, trial = null, safety = null }) {
  let ui = null, preview = null, current = { id: null }, frame = 0, timer = 0, token = 0, startedAt = 0;
  const results = { guard: null, compile: null, compiling: false, trial: null, trialing: false };
  let armed = 0, crashedDraft = false, imageToken = 0, chosenImage = null, chosenImageName = '';
  // the draft is marked while it is compiled and tried; two checks can overlap, so count
  const arm = () => { if (armed++ === 0) safety?.armDraft(); };
  const disarm = () => { if (--armed === 0) safety?.disarmDraft(); };

  function build() {
    const close = el('button', { type: 'button', id: 'method-close', className: 'md-x', textContent: '×' });
    close.setAttribute('aria-label', '閉じる');
    const head = el('div', { className: 'md-head' }, el('h2', { id: 'method-title' }, '自作メソッド'), close);

    const name = el('input', { id: 'method-name', type: 'text', maxLength: 20, placeholder: '例：流星群' });
    name.title = '方法の一覧に出る名前（20文字まで）';
    const symbol = el('input', { id: 'method-symbol', type: 'text', maxLength: 2, placeholder: '例：★' });
    symbol.title = 'タイルの上に出る1文字（絵文字でもOK）';
    const samples = el('select', { id: 'method-samples' }, el('option', { value: '', textContent: 'プリセット…' }),
      ...SAMPLE_GROUPS.map(([category, label]) => el('optgroup', { label }, ...SAMPLES.filter(s => s.category === category).map(s => el('option', { value: s.key, textContent: s.name })))));
    const ai = el('button', { type: 'button', id: 'method-ai', textContent: 'AIに頼むひな形をコピー' });
    const copy = el('button', { type: 'button', id: 'method-copy', textContent: 'userMethodをコピー' });
    const clear = el('button', { type: 'button', id: 'method-clear', textContent: 'コードを消す', title: 'コードを全部消して、まっさらにします' });
    const labelled = (caption, control) => el('label', { className: 'md-field' }, el('span', { className: 'md-cap' }, caption), control);
    const fields = el('div', { className: 'md-fields' }, labelled('名前（一覧に出る名前）', name), labelled('アイコン（タイルの1文字）', symbol), samples, copy, ai, clear);

    const gutter = el('div', { id: 'method-gutter', className: 'md-gutter' });
    const code = el('textarea', { id: 'method-code', className: 'md-code', spellcheck: false, wrap: 'off' });
    code.setAttribute('autocapitalize', 'off'); code.setAttribute('autocomplete', 'off'); code.setAttribute('aria-label', 'コード');
    const editor = el('div', { className: 'md-editor' }, gutter, code);

    const guardRow = el('div', { id: 'method-guard', className: 'md-check' });
    const compileRow = el('div', { id: 'method-compile', className: 'md-check' });
    const trialRow = el('div', { id: 'method-trial', className: 'md-check' });
    const recheck = el('button', { type: 'button', id: 'method-recheck', className: 'md-recheck', textContent: 'チェックする', hidden: true });
    const errors = el('ul', { id: 'method-errors', className: 'md-errors' });
    const checks = el('div', { className: 'md-checks' }, guardRow, compileRow, trialRow, recheck);
    const hint = el('details', { className: 'md-hint' }, el('summary', {}, '書き方のヒント'),
      el('ul', {},
        el('li', {}, '`vec3 userMethod(vec2 p, float amount)` を1つ書く。p は位置、amount は崩れ具合（0 で元の絵）。'),
        el('li', {}, `ループは userMethod の中だけで、for (int i = 0; i < 24; i++) の形。1つ${LIMITS.maxLoop}回まで、合計${LIMITS.loopBudget}回まで。`),
        el('li', {}, `while・do・discard・# の行・uniform の宣言は使えません。${LIMITS.maxChars}文字まで。`),
        el('li', {}, '道具: hash() rot() cell partC() ph() uTime uSeed uSize。粒の見た目は gKind（1〜9。9 は線画）で選びます。')));

    const canvas = el('canvas', { id: 'method-canvas', className: 'md-canvas' });
    const progress = el('input', { id: 'method-progress', type: 'range', min: 0, max: .8, step: .01, value: .48 });
    progress.setAttribute('aria-label', '崩れ具合');
    const loop = el('input', { id: 'method-loop', type: 'checkbox', checked: true });
    const amountValue = el('output', { id: 'method-amount-value', textContent: '0.48' });
    amountValue.setAttribute('for', 'method-progress');
    const controls = el('div', { className: 'md-preview-controls' }, el('label', { htmlFor: 'method-progress' }, '崩れ具合 amount'), amountValue, progress, el('label', {}, loop, ' 自動で動かす'));
    const imageInput = el('input', { type: 'file', id: 'method-image', accept: 'image/png,image/jpeg,image/webp', hidden: true });
    const imageButton = el('button', { type: 'button', id: 'method-image-button', textContent: '画像を変更' });
    const imageReset = el('button', { type: 'button', id: 'method-image-reset', textContent: '本体の画像に戻す' });
    const imageName = el('span', { id: 'method-image-name', textContent: '本体の画像' });
    const imageControls = el('div', { className: 'md-image-controls' }, imageButton, imageReset, imageInput, imageName);
    const status = el('p', { id: 'method-status', className: 'md-status' });
    status.setAttribute('role', 'status');
    const amountHint = el('p', { className: 'md-preview-hint', textContent: '0.00で原画 ／ 0.80で最大。画像変更はこのプレビューだけに適用します。' });

    const left = el('div', { className: 'md-col' }, fields, editor, checks, errors, hint);
    const lookControls = createRenderControls({ value: getRenderLook(), preview: true, onChange: value => preview?.setLook(value), onApply: onApplyRenderLook ? value => { onApplyRenderLook(value); status.textContent = '本体と動画書き出しに表示設定を適用しました。'; } : null });
    const right = el('div', { className: 'md-col' }, imageControls, canvas, controls, amountHint, status, lookControls.element);
    const save = el('button', { type: 'button', id: 'method-save', className: 'primary', textContent: '保存' });
    const cancel = el('button', { type: 'button', id: 'method-cancel', textContent: 'キャンセル' });
    const fileBtn = el('button', { type: 'button', id: 'method-file', className: 'md-file', textContent: 'ファイルに保存', title: '今の内容を .unfoldmethod ファイルにして保存します（別のブラウザや人に渡せます）', hidden: !onExportFile });
    const dialog = el('dialog', { id: 'method-dialog', className: 'method-dialog' }, head, el('div', { className: 'md-body' }, left, right), el('div', { className: 'md-foot' }, fileBtn, cancel, save));
    dialog.setAttribute('aria-labelledby', 'method-title');
    document.body.append(dialog);

    // the page's own shortcuts (space = play, ⌘Z = undo …) must not fire while typing here
    dialog.addEventListener('keydown', e => e.stopPropagation());
    code.addEventListener('keydown', e => {
      if (e.key !== 'Tab' || e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      code.setRangeText('  ', code.selectionStart, code.selectionEnd, 'end');
      onEdit();
    });
    code.addEventListener('input', onEdit);
    code.addEventListener('scroll', () => { gutter.scrollTop = code.scrollTop; });
    name.addEventListener('input', updateSave);
    symbol.addEventListener('input', updateSave);
    samples.addEventListener('change', () => {
      const sample = SAMPLES.find(s => s.key === samples.value);
      samples.value = '';
      if (!sample) return;
      code.value = sample.source;
      if (!name.value.trim()) { name.value = sample.name; symbol.value = sample.symbol; }
      onEdit();
    });
    ai.addEventListener('click', copyTemplate);
    copy.addEventListener('click', copySource);
    imageButton.addEventListener('click', () => imageInput.click());
    imageInput.addEventListener('change', () => changeImage(imageInput.files[0]));
    imageReset.addEventListener('click', () => {
      imageToken++; chosenImage = null; chosenImageName = '';
      preview.setImage(getPreviewImage() ?? makeTestImage());
      imageName.textContent = '本体の画像'; status.textContent = '本体の画像に戻しました。';
    });
    progress.addEventListener('input', () => { loop.checked = false; amountValue.textContent = Number(progress.value).toFixed(2); });
    save.addEventListener('click', saveMethod);
    cancel.addEventListener('click', () => closeEditor());
    fileBtn.addEventListener('click', exportToFile);
    clear.addEventListener('click', clearCode);
    close.addEventListener('click', () => closeEditor());
    dialog.addEventListener('close', cleanup);
    recheck.addEventListener('click', () => { crashedDraft = false; recheck.hidden = true; runChecks(); });
    return { dialog, name, symbol, samples, ai, gutter, code, guardRow, compileRow, trialRow, recheck, errors, canvas, progress, amountValue, loop, save, imageInput, imageName, status, lookControls };
  }

  function setRow(row, label, state) {
    row.className = `md-check ${state}`;
    row.replaceChildren(el('span', { className: 'mark', textContent: MARKS[state] }), label);
  }
  function renderGutter(marks) {
    const lines = ui.code.value.split('\n').length;
    ui.gutter.replaceChildren(...Array.from({ length: lines }, (_, i) => el('div', { className: marks.has(i + 1) ? 'err' : '', textContent: String(i + 1) })));
    ui.gutter.scrollTop = ui.code.scrollTop;
  }
  function updateSave() {
    const tried = !trial || (results.trial && !results.trial.heavy && !results.trial.failed && !results.trialing);
    ui.save.disabled = !(results.guard?.ok && results.compile && results.compile.length === 0 && !results.compiling && tried);
  }
  // [state, text] for the trial-render row
  function trialSummary() {
    const { guard, compile, trial: t, trialing } = results;
    if (!guard?.ok || !compile || compile.length) return ['skip', '試し描画（重さ・映り方）'];
    if (trialing || !t) return ['wait', '試し描画（重さ・映り方）'];
    const times = t.ratio == null ? '' : `標準の重いメソッドの約${t.ratio.toFixed(1)}倍`;
    if (t.failed) return ['ng', `試し描画に失敗しました（${t.failed}）`];
    if (t.heavy) return ['ng', `重すぎます（${times || '標準の重いメソッドよりずっと重い'}。${TRIAL.factor}倍まで）`];
    if (t.blank) return ['warn', '何も映っていません（保存はできます）'];
    if (t.unchanged) return ['warn', '元の絵と変わっていません（保存はできます）'];
    return ['ok', `試し描画（重さ ${describeTrialPass(t)}）`];
  }
  function show() {
    const { guard, compile, compiling } = results;
    setRow(ui.guardRow, '書き方（簡易チェック）', guard ? (guard.ok ? 'ok' : 'ng') : 'wait');
    setRow(ui.compileRow, 'コンパイル（GPU）', !guard?.ok ? 'skip' : compiling || !compile ? 'wait' : compile.length ? 'ng' : 'ok');
    ui.trialRow.hidden = !trial;
    if (trial) { const [state, text] = trialSummary(); setRow(ui.trialRow, text, state); }
    const items = [], marks = new Set();
    const item = (line, text, original = '') => el('li', {}, `${line ? `${line}行目: ` : ''}${text}`, ...(original ? [el('small', { textContent: original })] : []));
    for (const e of guard?.errors ?? []) { items.push(item(e.line, e.message)); if (e.line) marks.add(e.line); }
    for (const e of compile ?? []) { const ja = describeGlError(e.message); items.push(item(e.line, ja, ja === e.message ? '' : e.message)); if (e.line) marks.add(e.line); }
    ui.errors.replaceChildren(...items);
    renderGutter(marks);
    updateSave();
  }

  function onEdit() {
    token++; // invalidate a compile immediately, including the debounce interval
    crashedDraft = false; ui.recheck.hidden = true;
    results.guard = null; results.compile = null; results.compiling = false; results.trial = null; results.trialing = false;
    clearTimeout(timer);
    timer = setTimeout(runChecks, 350);
    show();
  }
  async function runChecks() {
    if (!preview || !ui.dialog.open) return;
    const mine = ++token, source = ui.code.value;
    const guard = checkSource(source);
    results.guard = guard; results.compile = null; results.compiling = false; results.trial = null; results.trialing = false;
    if (!guard.ok) { show(); return; }
    writeDraft({ id: current.id, name: ui.name.value, symbol: ui.symbol.value, source });
    arm();
    results.compiling = true; show();
    let errors;
    try { errors = await compileUserMethod(preview.renderer, { vertexShader, fragmentShader, source }); }
    catch (error) { errors = [{ slot: null, line: null, message: String(error?.message || error) }]; }
    if (mine !== token || !ui.dialog.open) { disarm(); return; }       // typed again meanwhile, or the editor was closed
    results.compiling = false; results.compile = errors;
    if (errors.length) { disarm(); show(); return; }
    preview.setSource(source);
    if (!trial) { disarm(); show(); return; }
    results.trialing = true; show();
    let outcome;
    try { outcome = await trial.run(source); }
    catch (error) { outcome = { failed: String(error?.message || error) }; }
    disarm();
    if (mine !== token || !ui.dialog.open) return;
    results.trialing = false; results.trial = outcome;
    show();
  }

  // empties the code box the way typing does, so ⌘Z / Ctrl+Z can bring it back where the browser allows; the checks then say the code is empty
  function clearCode() {
    if (!ui.code.value) return;
    ui.code.focus(); ui.code.select();
    const native = !!document.execCommand?.('delete');
    if (!native) { ui.code.value = ''; ui.code.dispatchEvent(new Event('input', { bubbles: true })); }
    notify(native ? 'コードを消したよ（⌘Z / Ctrl+Z で元に戻せます）。' : 'コードを消したよ。');
  }
  // what the name and symbol fields say (with the same defaults for both ways out: saving here and saving as a file)
  function fieldValues() {
    const name = ui.name.value.trim().slice(0, 20) || '自作メソッド';
    return { name, symbol: [...ui.symbol.value.trim()][0] || [...name][0] };
  }
  // the code as it is now, whether or not it has been checked: handing it on is the user's choice, and whoever opens it has it checked again
  function exportToFile() {
    if (!ui.code.value.trim()) { notify('コードが空だよ。'); return; }
    onExportFile?.({ id: current.id ?? newCustomId(), ...fieldValues(), vertex: ui.code.value });
  }
  function saveMethod() {
    if (ui.save.disabled) return;
    const { name, symbol } = fieldValues();
    const id = current.id ?? newCustomId();
    registerCustom({ id, name, symbol, vertex: ui.code.value });
    clearDraft();
    closeEditor();
    notify(`「${name}」を保存したよ。`);
    onSaved(id);
  }
  async function copySource() {
    const source = ui.code.value;
    if (!source.trim()) { ui.status.textContent = 'コードが空です。'; return; }
    try {
      await navigator.clipboard.writeText(source);
      ui.status.textContent = 'userMethodをコピーしました。';
    } catch {
      ui.code.focus(); ui.code.select();
      ui.status.textContent = 'コピーできなかったためコードを選択しました。⌘C / Ctrl+Cでコピーできます。';
    }
  }

  async function changeImage(file) {
    if (!file) return;
    const mine = ++imageToken;
    ui.imageInput.value = '';
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 20 * 1024 * 1024) {
      ui.status.textContent = '20 MB以下のPNG・JPG・WebPを選んでください。'; return;
    }
    ui.status.textContent = '画像を読み込み中…';
    const url = URL.createObjectURL(file), image = new Image();
    try {
      image.src = url; await image.decode();
      if (mine !== imageToken || !ui.dialog.open) return;
      if (image.naturalWidth * image.naturalHeight > 80e6) throw new Error('大きすぎる画像');
      const scale = Math.min(1, 4096 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      preview.setImage(canvas); chosenImage = canvas; chosenImageName = file.name;
      ui.imageName.textContent = file.name;
      ui.status.textContent = scale < 1 ? '画像を変更しました（長辺4096pxに調整）。' : '画像を変更しました。';
    } catch {
      if (mine === imageToken && ui.dialog.open) ui.status.textContent = '画像を読み込めませんでした。別のPNG・JPG・WebPを選んでください。';
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function copyTemplate() {
    try { await navigator.clipboard.writeText(aiTemplate()); notify('AIに頼むひな形をコピーしたよ。チャットに貼って、作りたい動きを書き足してね。'); }
    catch { notify('コピーできませんでした。ブラウザの許可を確認してね。'); }
  }

  function tick(now) {
    frame = requestAnimationFrame(tick);
    if (!preview || !ui.dialog.open || document.hidden) return;
    if (ui.loop.checked) {
      const t = ((now - startedAt) / 4200) % 1;
      ui.progress.value = ((t < .5 ? t * 2 : 2 - t * 2) * .8).toFixed(2);
    }
    ui.amountValue.textContent = Number(ui.progress.value).toFixed(2);
    preview.setAmount(Number(ui.progress.value));
  }
  // the preview (and its GPU context) is made once and kept: a canvas whose context was given up can't get a new one,
  // and a compile that is still running must not lose its renderer under it
  function cleanup() {
    cancelAnimationFrame(frame); clearTimeout(timer); token++; imageToken++;
  }
  function closeEditor() {
    if (ui?.dialog.open) ui.dialog.close();      // fires "close" -> cleanup
    else cleanup();
  }

  function open({ id = null, copyOf = null, review = false } = {}) {
    if (ui?.dialog.open) return;
    ui ??= build();
    const base = getCustom(copyOf ?? id);
    const draft = copyOf || review ? null : readDraft();
    let start;
    crashedDraft = false;
    if (draft && (draft.id ?? null) === (id ?? null)) { start = draft; crashedDraft = !!draft.crashed; if (!crashedDraft) notify('前回の下書きを復元したよ。'); }
    else if (base) start = { id: copyOf ? null : id, name: copyOf ? `${base.name}のコピー` : base.name, symbol: base.symbol, source: base.vertex };
    else start = { id: null, name: '', symbol: '', source: NEW_METHOD_SOURCE };
    current = { id: start.id ?? null };
    ui.name.value = start.name ?? ''; ui.symbol.value = start.symbol ?? ''; ui.code.value = start.source ?? '';
    results.guard = null; results.compile = null; results.compiling = false; results.trial = null; results.trialing = false;
    // a draft that crashed, or code that came from someone else, is not run until the user presses "チェックする"
    const hold = review ? '他の人から取り込んだメソッドです。コードを読んで、よければ「チェックする」を押してね（保存すると有効になります）。'
      : crashedDraft ? '前回このコードを試したときに、ブラウザが落ちたかもしれません。内容を見直してから「チェックする」を押してね。' : '';
    crashedDraft = !!hold;
    ui.recheck.hidden = !hold;
    ui.dialog.showModal();
    const box = ui.canvas.getBoundingClientRect();
    preview ??= createPreview(ui.canvas, { vertexShader, fragmentShader });
    ui.lookControls.setValue(getRenderLook());
    preview.setLook(ui.lookControls.value);
    preview.resize(Math.max(200, box.width), Math.max(112, box.width * 9 / 16));
    preview.setSource(null);
    preview.setImage(chosenImage ?? getPreviewImage() ?? makeTestImage());
    ui.imageName.textContent = chosenImageName || '本体の画像';
    ui.status.textContent = '';
    startedAt = performance.now();
    frame = requestAnimationFrame(tick);
    show();
    if (hold) notify(hold);
    else runChecks();
  }

  return { open, close: closeEditor, get isOpen() { return !!ui?.dialog.open; } };
}
