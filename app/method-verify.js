// "有効にする": the checks an unchecked method (one that came in a file from someone else) has to pass before it may be used —
// the text check, the GPU compile and the trial render, the same three the editor runs before it saves.
import { checkSource } from './method-guard.js';
import { describeGlError } from './method-messages.js';
import { TRIAL } from './method-trial.js';
import { getCustom, setCustomStatus } from './method-registry.js';

const lineText = (line, text) => `${line ? `${line}行目: ` : ''}${text}`;

// deps: { compile(source) -> errors[] (compileUserMethod), trial(source) -> the result of the trial render }
// Resolves to { ok: true, warnings } or { ok: false, stage, problems }.
export async function verifyMethod(source, { compile, trial }) {
  const guard = checkSource(source);
  if (!guard.ok) return { ok: false, stage: 'guard', problems: guard.errors.map(e => lineText(e.line, e.message)) };
  let errors;
  try { errors = await compile(source); } catch (error) { errors = [{ line: null, message: String(error?.message || error) }]; }
  if (errors.length) return { ok: false, stage: 'compile', problems: errors.map(e => lineText(e.line, describeGlError(e.message))) };
  let result;
  try { result = await trial(source); } catch (error) { result = { failed: String(error?.message || error) }; }
  if (result.failed) return { ok: false, stage: 'trial', problems: [`試し描画に失敗しました（${result.failed}）`] };
  if (result.heavy) {
    const times = result.ratio == null ? '標準の重いメソッドよりずっと重い' : `標準の重いメソッドの約${result.ratio.toFixed(1)}倍`;
    return { ok: false, stage: 'trial', problems: [`重すぎます（${times}。${TRIAL.factor}倍まで）`] };
  }
  const warnings = [];
  if (result.blank) warnings.push('何も映っていません');
  if (result.unchanged) warnings.push('元の絵と変わっていません');
  return { ok: true, warnings };
}

// Switches an unchecked method on after it passed verifyMethod; if it did not, it stays unchecked and the reason is written on it.
// safety: armVerify(id) / disarmVerify(id) leave and wipe the "being tried" mark, so a browser that goes down meanwhile is noticed at the next start.
export function createEnabler({ compile, trial, safety = null, notify = () => {} }) {
  const running = new Set();
  return {
    async enable(id) {
      const record = getCustom(id);
      if (!record || record.status !== 'quarantined' || running.has(id)) return false;
      running.add(id);
      const { vertex, rev } = record;
      safety?.armVerify(id);
      let outcome;
      try { outcome = await verifyMethod(vertex, { compile, trial }); }
      finally { safety?.disarmVerify(id); running.delete(id); }
      const now = getCustom(id);
      if (!now || now.rev !== rev || now.status !== 'quarantined') return false;      // changed or removed meanwhile: that was a check of other code
      if (!outcome.ok) {
        setCustomStatus(id, 'quarantined', `確認できませんでした: ${outcome.problems.join(' ')}`);
        notify(`「${now.name}」は有効にできませんでした。${outcome.problems[0]}`);
        return false;
      }
      setCustomStatus(id, 'ok', '');
      notify(outcome.warnings.length ? `「${now.name}」を有効にしました（${outcome.warnings.join('・')}）。` : `「${now.name}」を有効にしました。`);
      return true;
    },
  };
}
