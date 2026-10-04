// Handing a custom method to someone else (or to another browser) as a file: saving one, and bringing one in.
// Shared by the single-image page and the sequence page. A method that comes in is always unchecked ('quarantined') until it is enabled.
import { METHOD_FILE, buildMethodFile, methodFileName, parseMethodFile } from './method-file.js';
import { planImport, registerQuarantined } from './method-project.js';
import { sourceHash } from './method-library.js';
import { getCustom, listCustom, newCustomId } from './method-registry.js';

// records: [{ id, name, symbol, vertex }] — saves them as one .unfoldmethod file named after the first
export function downloadMethodFile(records, { notify = () => {} } = {}) {
  const name = methodFileName(records[0]);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([buildMethodFile(records)], { type: 'application/octet-stream' }));
  a.download = name; a.hidden = true;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  notify(`「${name}」をファイルに保存したよ（ダウンロードフォルダを見てね）。別のブラウザや人に渡すときは、「ファイルから読み込み」で開いてね。`);
}

export function exportMethod(id, options) {
  const record = getCustom(id);
  if (record) downloadMethodFile([record], options);
}

// text of a .unfoldmethod file -> the methods in it come in unchecked; the same code that is already here is not added twice
export async function importMethodText(text, { notify = () => {} } = {}) {
  const { methods, problems } = parseMethodFile(text);
  if (!methods.length) { notify(problems[0] ?? 'メソッドが入っていませんでした。'); return { created: 0, reused: 0, problems }; }
  const plan = await planImport({ embedded: methods, local: listCustom().map(c => ({ id: c.id, vertex: c.vertex })), hash: sourceHash, newId: newCustomId });
  registerQuarantined(plan.created);
  const names = plan.created.slice(0, 3).map(m => `「${m.name}」`).join('');
  const notes = [
    plan.created.length ? `${names}${plan.created.length > 3 ? `ほか${plan.created.length - 3}個` : ''}を未確認で取り込んだよ。コードを確認してから「有効にする」を押してね。` : '',
    plan.reused.length ? (plan.created.length ? `（同じものが手元にあった${plan.reused.length}個は、そのまま使うよ）` : '同じメソッドが、もう入っているよ。') : '',
    problems.length ? `読み込めなかったものが${problems.length}個あったよ。` : '',
  ].filter(Boolean);
  notify(notes.join(' '));
  return { created: plan.created.length, reused: plan.reused.length, problems };
}

export async function importMethodFile(file, options = {}) {
  if (file.size > METHOD_FILE.maxChars * 3) { options.notify?.('ファイルが大きすぎます。自作メソッドのファイルではないかもしれません。'); return { created: 0, reused: 0, problems: ['too big'] }; }
  let text;
  try { text = await file.text(); } catch { options.notify?.('ファイルを開けませんでした。'); return { created: 0, reused: 0, problems: ['unreadable'] }; }
  return importMethodText(text, options);
}

// no `accept` on purpose: some browsers grey out files with an extension they do not know; whatever is chosen is checked anyway
export function pickMethodFile(options = {}) {
  const input = document.createElement('input');
  input.type = 'file';
  input.onchange = () => { const file = input.files[0]; if (file) importMethodFile(file, options); };
  input.click();
}
