// A mark in localStorage that says "a custom method is being tried". It is written before the method is first drawn and wiped again once the
// method has survived some frames — or when the page is closed normally. If the mark is still there at the next start, the browser went down
// while the method was on screen (a frozen GPU gives no chance to run any code), and that method must not be used again unless the user says so.
export const FLAG_KEY = 'unfold-method-trial';

export function createCrashFlag({ storage, session = Math.random().toString(36).slice(2), now = Date.now, framesToConfirm = 30 }) {
  const armed = new Map();        // id -> frames drawn since it was armed
  const confirmed = new Set();    // ids that survived in this session: never marked again
  // wiping only touches this session's own mark: one left by a crashed session (not recovered yet) or by another open tab is not ours to wipe
  const ownMark = () => {
    try { const mark = JSON.parse(storage.getItem(FLAG_KEY)); return !mark || mark.session === session; } catch { return true; }
  };
  const write = () => {
    try {
      if (armed.size) storage.setItem(FLAG_KEY, JSON.stringify({ session, at: now(), ids: [...armed.keys()] }));
      else if (ownMark()) storage.removeItem(FLAG_KEY);
    } catch { /* storage unavailable: no mark */ }
  };
  return {
    session,
    // call before a frame with these custom methods is drawn
    arm(ids) {
      let changed = false;
      for (const id of ids) if (!armed.has(id) && !confirmed.has(id)) { armed.set(id, 0); changed = true; }
      if (changed) write();
    },
    // call after a frame was drawn
    frame() {
      if (!armed.size) return;
      let changed = false;
      for (const [id, count] of armed) {
        if (count + 1 >= framesToConfirm) { armed.delete(id); confirmed.add(id); changed = true; }
        else armed.set(id, count + 1);
      }
      if (changed) write();
    },
    // take ids off the mark without saying they proved themselves (they can be marked again)
    release(ids) {
      let changed = false;
      for (const id of ids) changed = armed.delete(id) || changed;
      if (changed) write();
    },
    clear() { armed.clear(); write(); },
    // the ids a previous session left marked (the mark is wiped); the mark of this very session is not "left behind"
    recover() {
      let raw = null;
      try { raw = storage.getItem(FLAG_KEY); } catch { return []; }
      if (raw === null) return [];
      let left = null;
      try { left = JSON.parse(raw); } catch { /* a broken mark */ }
      if (left?.session === session) return [];
      try { storage.removeItem(FLAG_KEY); } catch { /* nothing to wipe */ }
      return Array.isArray(left?.ids) ? left.ids.filter(id => typeof id === 'string') : [];
    },
  };
}
