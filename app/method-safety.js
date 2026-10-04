// The safety net for custom methods while they run: the mark that survives a browser crash, the watch on frame times, and what to do when
// the GPU context is lost. The pages call it right before / after a frame is drawn, once per animation frame, and once at start.
import { getCustom, setCustomStatus } from './method-registry.js';
import { createCrashFlag } from './method-crashflag.js';
import { createWatchdog } from './method-watchdog.js';

export const DRAFT_KEY = 'unfold-method-draft';       // the editor keeps the code being written here
export const DRAFT_ID = 'draft';                      // the editor draft is marked like a method while it is tried
export const VERIFY_PREFIX = 'verify:';               // an unchecked method is marked like this while it is checked

// some browsers throw when localStorage is even touched (blocked site data): then there is simply no storage
const defaultStorage = () => { try { return globalThis.localStorage; } catch { return null; } };

function markDraftCrashed(storage) {
  try {
    const draft = JSON.parse(storage.getItem(DRAFT_KEY));
    if (draft) storage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, crashed: true }));
  } catch { /* no draft, or no storage */ }
}

export function createSafety({ storage = defaultStorage(), notify = () => {}, crashFlag = createCrashFlag({ storage }), watchdog = createWatchdog() } = {}) {
  let lastUsed = [];
  // switch off the ones that are still in use (the others already are something else); returns the ids that were switched off.
  // A method that is off needs no mark any more: it will not be drawn.
  const stop = (ids, status, reason) => {
    const hit = ids.filter(id => getCustom(id)?.status === 'ok');
    for (const id of hit) setCustomStatus(id, status, reason);
    crashFlag.release(hit);
    return hit;
  };
  const names = ids => ids.map(id => `「${getCustom(id)?.name ?? id}」`).join('');
  return {
    crashFlag, watchdog,
    get lastUsed() { return lastUsed; },
    // right before a frame is drawn: `used` = the custom methods in it (from variants.pick). Leaves the mark.
    beforeDraw(used) { lastUsed = used; if (used.length) crashFlag.arm(used); },
    afterDraw() { if (lastUsed.length) crashFlag.frame(); },
    // once per animation frame while playing: the time since the last frame
    tick(deltaMs) {
      const verdict = watchdog.frame(deltaMs, lastUsed.length > 0);
      if (!verdict) return null;
      const hit = stop(lastUsed, 'disabled', `重すぎるので止めました（1コマ約${Math.round(verdict.median)}ミリ秒）`);
      if (hit.length) notify(`${names(hit)}が重すぎたので止めました。タイルの⚙から、もう一度試せます。`);
      return verdict;
    },
    contextLost() {
      const hit = stop(lastUsed, 'crashed', '描画が止まった（GPUが落ちた）ので、使うのをやめました');
      if (hit.length) notify(`描画が止まったので、${names(hit)}を止めました。`);
      return hit;
    },
    // at start, after the saved methods are loaded: whatever was marked when the last session ended did not end well
    recoverFromCrash() {
      const marked = crashFlag.recover();
      const isVerify = id => id.startsWith(VERIFY_PREFIX);
      const methods = stop(marked.filter(id => id !== DRAFT_ID && !isVerify(id)), 'crashed', '前回このメソッドを使っていて、ブラウザが落ちたみたい');
      const draft = marked.includes(DRAFT_ID);
      if (draft) markDraftCrashed(storage);
      // a method that was being checked stays unchecked ("crashed" could be switched back on without the checks)
      const verifying = marked.filter(isVerify).map(id => id.slice(VERIFY_PREFIX.length)).filter(id => getCustom(id)?.status === 'quarantined');
      for (const id of verifying) setCustomStatus(id, 'quarantined', '確認している途中でブラウザが落ちたみたい。コードを見直してから、もう一度確認してね。');
      if (methods.length) notify(`前回、${names(methods)}を使っていてブラウザが落ちたみたい。止めてあるよ（⚙から、もう一度試せます）。`);
      else if (verifying.length) notify(`前回、${names(verifying)}を確認している途中でブラウザが落ちたみたい。未確認のままにしてあるよ。`);
      else if (draft) notify('前回、エディタで試したコードでブラウザが落ちたみたい。下書きは残してあるよ。');
      return { methods, draft, verifying };
    },
    armDraft() { crashFlag.arm([DRAFT_ID]); },
    disarmDraft() { crashFlag.release([DRAFT_ID]); },
    armVerify(id) { crashFlag.arm([VERIFY_PREFIX + id]); },
    disarmVerify(id) { crashFlag.release([VERIFY_PREFIX + id]); },
    pageHide() { crashFlag.clear(); },
  };
}
