// Watches the time between frames while custom methods are on screen, and says when they are too slow to keep.
export const WATCHDOG = { window: 30, factor: 4, floorMs: 50, nominalMs: 1000 / 60, maxGapMs: 1000 };

const median = values => {
  const sorted = [...values].sort((a, b) => a - b), mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export function createWatchdog(options = {}) {
  const o = { ...WATCHDOG, ...options };
  const base = [], custom = [];
  const push = (list, value) => { list.push(value); if (list.length > o.window) list.shift(); };
  return {
    // deltaMs: time since the previous frame. isCustom: a custom method was drawn in this frame.
    // Returns null, or { median, baseline, limit } once the last 30 frames with custom methods are slower than the limit:
    // 4 x the usual frame time (without custom methods; 1/60 s when that is not known yet) and at least 50 ms.
    frame(deltaMs, isCustom) {
      if (!(deltaMs > 0) || deltaMs > o.maxGapMs) return null;      // a hidden tab or a pause is not slowness
      if (!isCustom) { push(base, deltaMs); return null; }
      push(custom, deltaMs);
      if (custom.length < o.window) return null;
      const baseline = base.length >= 10 ? Math.max(o.nominalMs, median(base)) : o.nominalMs;
      const limit = Math.max(o.floorMs, o.factor * baseline), typical = median(custom);
      if (typical <= limit) return null;
      custom.length = 0;
      return { median: typical, baseline, limit };
    },
    reset() { base.length = 0; custom.length = 0; },
  };
}
