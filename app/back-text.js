// 人物の後ろの文字（2026-11-11）: 1枚モードで、絵（背景）と切り抜いた人物の間に、大きな文字を出す。
// 描く順は「背景 → この文字 → 人物」。人物はいつも最後に描くので、文字が人物の前に出ることはない。
//   超デカ: 1語ずつ画面いっぱいに出て、語と語の間を「切り替わり方」でつなぐ（KOMAGUMI の TRANS と同じ考え方を、透明な地でも崩れないように書き直した物）
//   横に流れる: 1段の文字が横へ流れ続ける　　壁いっぱい: 何段も、1段おきに逆向きに流れる
// 時刻（秒）だけで絵が決まる（乱数を持たない）ので、動画の書き出しでも同じ絵になる。「ずっと」の時は、最後のコマが最初のコマにつながる。
// 上半分（設定・時間割）は DOM なしで動く。下半分（createBackText）は Canvas 2D で描く。

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = p => (p < .5 ? 8 * p ** 4 : 1 - ((-2 * p + 2) ** 4) / 2);   // easeInOutQuart
const hash01 = (a, b = 0) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

export const BACK_MODES = { giant: '超デカ（1語ずつ切り替わる）', flow: '横に流れる', wall: '壁いっぱいに流れる' };
export const BACK_TRANS = {
  random: 'おまかせ（毎回かわる）', push: '押し出し', wipe: '拭き取り', blinds: 'ブラインド', iris: '丸が広がる', blur: 'ぼけて入れ替わる',
  zoom: '字が迫って入れ替わる', glitch: '乱れて切り替わる', tiles: '升目で替わる', flip: '回って切り替わる', brush: '筆で塗り替える',
  cover: '色で覆って切り替える', melt: '溶ける', cut: 'パッと替わる',
};
/** おまかせで回す順（同じ物が続かない。数は 5 と互いに素にしておく: 下の式で全部を一巡する） */
export const BACK_RANDOM = ['push', 'blinds', 'zoom', 'wipe', 'glitch', 'iris', 'flip', 'tiles', 'brush', 'cover', 'blur'];
export const BACK_FILLS = { solid: '単色', rust: 'さびた鉄', metal: '金属', outline: '縁だけ' };
export const BACK_FONTS = {
  impact: { label: '極太・縦長（英字向き）', family: '"Anton","Noto Sans JP","Hiragino Sans",sans-serif', weight: 400 },
  gothic: { label: 'ゴシック極太', family: '"Noto Sans JP","Hiragino Sans",sans-serif', weight: 900 },
  mincho: { label: '明朝', family: '"Noto Serif JP","Hiragino Mincho ProN",serif', weight: 900 },
  dela: { label: 'デラゴシック', family: '"Dela Gothic One",sans-serif', weight: 400 },
  round: { label: '丸ゴシック', family: '"M PLUS Rounded 1c","Hiragino Maru Gothic ProN",sans-serif', weight: 800 },
  marker: { label: 'マーカー手書き', family: '"Yusei Magic",sans-serif', weight: 400 },
};
export const BACK_WHEN = { always: 'ずっと', change: '絵が変わっている間だけ' };
export const BACK_LIMITS = { words: 24, chars: 40, hold: [.2, 3], speed: [.02, 1], size: [.2, 1], y: [-.5, .5] };
export const BACK_DEFAULT = Object.freeze({
  enabled: false, text: 'MOVE\nFAST\nUNFOLD', mode: 'giant', trans: 'random', hold: .8, speed: .2, dir: 'left', font: 'impact', size: 1, stretch: 1, y: 0,
  fill: 'solid', color: '#f3ead7', depth: 0, back: '#000000', backAlpha: 0, accent: '#ff6a2b', when: 'always', still: false,
});

const colour = (v, d) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : d);
const number = (v, d, [a, b]) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? clamp(Number(v), a, b) : d);
const pick = (v, table, d) => (typeof v === 'string' && Object.hasOwn(table, v) ? v : d);

/** 設定をきれいにする（知らない値は初めの値に、数は範囲の中に） */
export function cleanBackText(raw) {
  const r = raw && typeof raw === 'object' ? raw : {}, d = BACK_DEFAULT, L = BACK_LIMITS;
  return {
    enabled: r.enabled === true,
    text: typeof r.text === 'string' ? r.text.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').slice(0, 1200) : d.text,
    mode: pick(r.mode, BACK_MODES, d.mode), trans: pick(r.trans, BACK_TRANS, d.trans),
    hold: number(r.hold, d.hold, L.hold), speed: number(r.speed, d.speed, L.speed), dir: r.dir === 'right' ? 'right' : 'left',
    font: pick(r.font, BACK_FONTS, d.font), size: number(r.size, d.size, L.size), stretch: number(r.stretch, d.stretch, [0, 1]), y: number(r.y, d.y, L.y),
    fill: pick(r.fill, BACK_FILLS, d.fill), color: colour(r.color, d.color), depth: number(r.depth, d.depth, [0, 1]),
    back: colour(r.back, d.back), backAlpha: number(r.backAlpha, d.backAlpha, [0, 1]), accent: colour(r.accent, d.accent),
    when: pick(r.when, BACK_WHEN, d.when),
    still: r.still === true,   // 絵は動かさない（崩さず、文字だけが動く）
  };
}

/** 文字の欄 → 語の並び（1行に1語。空の行は捨てる。語の中の「/」は段の区切り） */
export function backWords(text) {
  return String(text ?? '').split(/\r?\n/).map(s => [...s.trim()].slice(0, BACK_LIMITS.chars).join('')).filter(Boolean).slice(0, BACK_LIMITS.words);
}

/** 文字が出ている時間 [始まり, 終わり]（秒）。「絵が変わっている間だけ」は、最初と最後が元の絵のままになる */
export function backWindow(when, duration) { return when === 'change' ? [duration * .08, duration * .92] : [0, duration]; }

/**
 * 超デカの時間割: sec の時に、どの語が出ていて、前のどの語から、どこまで切り替わったか。
 *   返す: null（何も出ない）か {k: 何コマめ, i: 今の語（-1 = 消えていく所）, prev: 前の語（-1 = 何も無い所から出てくる）, p: 切り替わりの進み 0..1, count, len, T}
 * 1語の長さは、出ている時間をちょうど割り切るように少し直す。「ずっと」の時は、語の並びがちょうど何周かして、最初の語は最後の語から切り替わってくる（輪になる）。
 */
export function backSlot(settings, sec, duration) {
  const n = backWords(settings.text).length;
  if (!n || !(duration > 0) || !Number.isFinite(sec)) return null;
  const [a, b] = backWindow(settings.when, duration);
  if (sec < a || sec > b) return null;
  const span = b - a, ring = settings.when !== 'change', raw = span / settings.hold;
  // 輪になる時は、語の並びがちょうど何周かで終わるようにする（最後の語の次が、最初の語になる）
  const count = ring ? Math.max(1, Math.round(raw / n)) * n : Math.max(1, Math.round(raw)), len = span / count, T = Math.min(.5, len * .45);
  const k = Math.min(count - 1, Math.floor((sec - a) / len)), local = sec - a - k * len;
  if (!ring && sec > b - T) return { k: count, i: -1, prev: (count - 1) % n, p: clamp((sec - (b - T)) / T), count, len, T };
  return { k, i: k % n, prev: k === 0 ? (ring ? (count - 1) % n : -1) : (k - 1) % n, p: clamp(local / T), count, len, T };
}

/** k コマめの切り替わり方（おまかせは、決まった順に全部を回る。同じ物は続かない） */
export function backTransKind(settings, k) {
  return settings.trans === 'random' ? BACK_RANDOM[(k * 5 + 2) % BACK_RANDOM.length] : settings.trans;
}

/** 流れる文字が sec までに動いた長さ（画素）。1本分（unit）の整数倍だけ動いて終わるように速さを少し直すので、最後が最初につながる */
export function flowShift(unit, planeWidth, speed, sec, duration) {
  if (!(unit > 0) || !(duration > 0)) return 0;
  const loops = Math.max(1, Math.round(speed * planeWidth * duration / unit));
  return sec / duration * loops * unit;
}

/** 出ている間の濃さ（「絵が変わっている間だけ」の時、流れる文字と地の色は、入りと出でふわっと変わる） */
export function backFade(when, sec, duration, T = .4) {
  if (when !== 'change') return 1;
  const [a, b] = backWindow(when, duration);
  return clamp((sec - a) / T) * clamp((b - sec) / T);
}

export const backFontCSS = (key, px) => { const f = BACK_FONTS[key] || BACK_FONTS.impact; return `${f.weight} ${px}px ${f.family}`; };

// ---------------------------------------------------------------- 描く係（Canvas 2D）
const mixHex = (hex, to, k) => { const a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16), c = s => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k); return `rgb(${c(16)},${c(8)},${c(0)})`; };
const PX = 200;   // 字を測る時の大きさ

/** さびた鉄・金属の模様（512 画素の升。決まった乱数で、いつも同じ模様） */
function makeSurface(doc, kind) {
  const c = doc.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d'); let seed = kind === 'rust' ? 7 : 31;
  const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  if (kind === 'rust') {
    const g = x.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#f0a030'); g.addColorStop(.5, '#d9731f'); g.addColorStop(1, '#b4521a'); x.fillStyle = g; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 900; i++) {   // しみ・はがれ
      const px = r() * 512, py = r() * 512, rad = 2 + r() * r() * 46, dark = r() < .62;
      x.fillStyle = dark ? `rgba(${70 + r() * 40 | 0},${28 + r() * 22 | 0},8,${.05 + r() * .22})` : `rgba(255,${190 + r() * 50 | 0},${70 + r() * 60 | 0},${.04 + r() * .16})`;
      x.beginPath(); x.ellipse(px, py, rad, rad * (.4 + r() * .9), r() * 3.14, 0, 6.2832); x.fill();
    }
    for (let i = 0; i < 70; i++) { const px = r() * 512, py = r() * 512, h = 30 + r() * 170; const g2 = x.createLinearGradient(0, py, 0, py + h); g2.addColorStop(0, 'rgba(60,24,6,.34)'); g2.addColorStop(1, 'rgba(60,24,6,0)'); x.fillStyle = g2; x.fillRect(px, py, 1 + r() * 5, h); }   // 垂れた跡
    for (let i = 0; i < 2600; i++) { x.fillStyle = r() < .5 ? 'rgba(40,16,4,.5)' : 'rgba(255,214,150,.35)'; x.fillRect(r() * 512, r() * 512, 1 + r() * 2, 1 + r() * 2); }
  } else {
    const g = x.createLinearGradient(0, 0, 0, 512);
    for (const [p, col] of [[0, '#f6f8fa'], [.18, '#aab3bd'], [.36, '#eef1f4'], [.5, '#69727c'], [.62, '#d3d9df'], [.82, '#8a939d'], [1, '#e6eaee']]) g.addColorStop(p, col);
    x.fillStyle = g; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 1400; i++) { x.fillStyle = r() < .5 ? 'rgba(255,255,255,.10)' : 'rgba(20,26,34,.10)'; x.fillRect(0, r() * 512, 512, .6 + r() * 1.2); }   // 磨いた筋
  }
  return c;
}

/**
 * 描く係を作る。draw(canvas, sec, duration, settings, {width, height}) で、canvas に文字の層（地は透明）を描く。
 *   返す: 'empty'（何も出ない。canvas は触らない）・'same'（前に描いた物と同じ）・'drawn'
 */
export function createBackText(doc = globalThis.document) {
  const mk = () => doc.createElement('canvas');
  const scratch = [mk(), mk(), mk()], face = mk(), layers = new Map(), surfaces = {};
  let last = '';
  const fit = (c, W, H) => { if (c.width !== W || c.height !== H) { c.width = W; c.height = H; } const x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.filter = 'none'; x.clearRect(0, 0, W, H); return x; };
  const lookOf = s => [s.font, s.size, s.stretch, s.y, s.fill, s.color, s.depth].join('|');

  /** glyphs(ctx, 'fill' | 'stroke') が描く字の形に、模様・厚みを付けて g に描く */
  function paint(g, W, H, s, glyphs) {
    const deep = s.depth * H * .035;
    if (deep > .5) {   // 厚み: 右下へ少しずつずらして重ねる
      const n = Math.min(28, Math.ceil(deep / 1.5));
      g.fillStyle = g.strokeStyle = s.fill === 'rust' ? '#3a1a08' : s.fill === 'metal' ? '#232a31' : mixHex(s.color, '#000000', .68);
      for (let j = n; j >= 1; j--) { g.save(); g.translate(deep * .55 * j / n, deep * j / n); glyphs(g, s.fill === 'outline' ? 'stroke' : 'fill'); g.restore(); }
    }
    if (s.fill === 'solid') { g.fillStyle = s.color; glyphs(g, 'fill'); return; }
    if (s.fill === 'outline') { g.strokeStyle = s.color; glyphs(g, 'stroke'); return; }
    const f = fit(face, W, H); f.fillStyle = '#fff'; glyphs(f, 'fill');
    f.globalCompositeOperation = 'source-in'; f.fillStyle = f.createPattern(surfaces[s.fill] ??= makeSurface(doc, s.fill), 'repeat'); f.fillRect(0, 0, W, H);
    f.globalCompositeOperation = 'source-atop'; const sh = f.createLinearGradient(0, 0, 0, H); sh.addColorStop(0, 'rgba(255,255,255,.16)'); sh.addColorStop(.5, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.26)'); f.fillStyle = sh; f.fillRect(0, 0, W, H);
    g.drawImage(face, 0, 0);
  }

  /** 超デカの1語（「/」で段に分かれる）。字の形のまま入る大きさにしてから、「画面いっぱいに伸ばす」の分だけ、余った向き（縦か横）へ伸ばす */
  function wordGlyphs(g0, W, H, word, s) {
    const lines = word.split('/').map(t => t.trim()).filter(Boolean); if (!lines.length) return () => {};
    g0.font = backFontCSS(s.font, PX);
    const availW = W * .95 * s.size, availH = H * .92 * s.size, gap = lines.length > 1 ? availH * .05 : 0, lineH = (availH - gap * (lines.length - 1)) / lines.length;
    const placed = lines.map((text, j) => {
      const m = g0.measureText(text), left = m.actualBoundingBoxLeft, bw = Math.max(1, left + m.actualBoundingBoxRight), asc = m.actualBoundingBoxAscent, desc = m.actualBoundingBoxDescent, bh = Math.max(1, asc + desc);
      let sx = availW / bw, sy = sx;
      if (bh * sx > lineH) { sy = lineH / bh; sx = sy * (1 + (Math.min(1.7, availW / (bw * sy)) - 1) * s.stretch); }   // 短い語: 高さで決めて、幅いっぱいの方へ横に広げる（広げすぎない）
      else sy = sx * (1 + (Math.min(6, lineH / (bh * sx)) - 1) * s.stretch);   // 長い語: 幅で決めて、段の高さまで縦に伸ばす
      const top = (H - availH) / 2 - s.y * H + j * (lineH + gap);
      return { text, sx, sy, x: -bw / 2 + left, y: (asc - desc) / 2, cy: top + lineH / 2 };
    });
    return (g, how) => {
      g.font = backFontCSS(s.font, PX); g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
      for (const l of placed) {
        g.save(); g.translate(W / 2, l.cy); g.scale(l.sx, l.sy);
        if (how === 'stroke') { g.lineWidth = Math.max(2, H * .009) / Math.min(l.sx, l.sy); g.strokeText(l.text, l.x, l.y); } else g.fillText(l.text, l.x, l.y);
        g.restore();
      }
    };
  }

  /** 1語の層（画面と同じ大きさ。地は透明）。少しだけ取っておく */
  function layerOf(W, H, word, s) {
    const key = `${W}x${H}|${lookOf(s)}|${word}`;
    let c = layers.get(key);
    if (!c) {
      if (layers.size >= 6) { const old = layers.keys().next().value; layers.delete(old); }
      c = mk(); const g = fit(c, W, H); paint(g, W, H, s, wordGlyphs(g, W, H, word, s)); layers.set(key, c);
    } else { layers.delete(key); layers.set(key, c); }
    return c;
  }

  /** 次の層は mask の中だけ、前の層は mask の外だけに描く（どちらの層も地が透明なので、ただ上に重ねると前の字が透けて残る） */
  function mix(g, W, H, prev, next, mask) {
    if (next) { const x = fit(scratch[0], W, H); mask(x); x.globalCompositeOperation = 'source-in'; x.drawImage(next, 0, 0); g.drawImage(scratch[0], 0, 0); }
    if (prev) { const x = fit(scratch[1], W, H); x.drawImage(prev, 0, 0); x.globalCompositeOperation = 'destination-out'; mask(x); g.drawImage(scratch[1], 0, 0); }
  }

  const TRANS = {
    cut(g, W, H, prev, next) { if (next) g.drawImage(next, 0, 0); },
    melt(g, W, H, prev, next, p) { const e = ease(p); if (prev) { g.globalAlpha = 1 - e; g.drawImage(prev, 0, 0); } if (next) { g.globalAlpha = e; g.drawImage(next, 0, 0); } g.globalAlpha = 1; },
    push(g, W, H, prev, next, p, k) {
      const [ux, uy] = [[-1, 0], [0, -1], [1, 0], [0, 1]][k % 4], e = ease(p);
      if (prev) g.drawImage(prev, ux * W * e, uy * H * e);
      if (next) g.drawImage(next, ux * W * (e - 1), uy * H * (e - 1));
    },
    wipe(g, W, H, prev, next, p, k) {
      const a = [0, 90, 180, -90, 35][k % 5] * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a);
      const proj = [0, W].flatMap(x => [0, H].map(y => x * dx + y * dy)), m0 = Math.min(...proj), m1 = Math.max(...proj), soft = Math.max(1, .08 * H);
      const edge = m0 + (m1 + soft - m0) * ease(p);
      mix(g, W, H, prev, next, x => { const gr = x.createLinearGradient((edge - soft) * dx, (edge - soft) * dy, edge * dx, edge * dy); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, W, H); });
    },
    blinds(g, W, H, prev, next, p) {
      const n = 8, stagger = .5;
      for (let i = 0; i < n; i++) {
        const q = ease(clamp((p - stagger * i / (n - 1)) / (1 - stagger))), y0 = Math.floor(i * H / n), y1 = Math.floor((i + 1) * H / n), side = i % 2 ? -1 : 1;
        g.save(); g.beginPath(); g.rect(0, y0, W, y1 - y0); g.clip();
        if (prev && q < 1) g.drawImage(prev, -side * W * q, 0);
        if (next && q > 0) g.drawImage(next, side * W * (1 - q), 0);
        g.restore();
      }
    },
    iris(g, W, H, prev, next, p, k, s) {
      const cx = W / 2, cy = H / 2, far = Math.hypot(cx, cy), soft = .012 * H, r = ease(p) * (far + soft);
      mix(g, W, H, prev, next, x => { const gr = x.createRadialGradient(cx, cy, Math.max(0, r - soft), cx, cy, Math.max(.01, r)); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, W, H); });
      if (r > 0 && p < 1) { g.strokeStyle = s.accent; g.lineWidth = .012 * H; g.beginPath(); g.arc(cx, cy, r, 0, 6.2832); g.stroke(); }
    },
    blur(g, W, H, prev, next, p) {
      const R = .035 * H, half = (img, q, a) => { if (!img || a <= 0) return; const z = 1 + .1 * q; g.save(); g.globalAlpha = a; g.filter = `blur(${(R * q).toFixed(2)}px)`; g.translate(W / 2, H / 2); g.scale(z, z); g.drawImage(img, -W / 2, -H / 2); g.restore(); };
      if (p < .5) half(prev, p * 2, 1 - ease(p * 2)); else half(next, 2 - p * 2, ease(p * 2 - 1));
    },
    zoom(g, W, H, prev, next, p) {
      const e = ease(p), put = (img, z, a) => { if (!img || a <= 0) return; g.save(); g.globalAlpha = a; g.translate(W / 2, H / 2); g.scale(z, z); g.drawImage(img, -W / 2, -H / 2); g.restore(); };
      put(next, .45 + .55 * e, clamp(e * 1.6)); put(prev, 1 + 2.2 * e, 1 - clamp(e * 1.4));
    },
    glitch(g, W, H, prev, next, p, k) {
      const base = p < .5 ? prev : next; if (!base) return;
      const env = Math.sin(Math.PI * p), frame = Math.floor(p * 8) + k * 13, b = fit(scratch[0], W, H);
      b.drawImage(base, 0, 0);
      let y = 0;
      for (let j = 0; j < 9 && y < H; j++) {
        const h = H * (.03 + .12 * hash01(j + 1, frame + 1));
        if (hash01(j + 7, frame + 3) < .6) { const dx = (hash01(j + 3, frame + 5) * 2 - 1) * .07 * W * env; b.clearRect(0, y, W, h); b.drawImage(base, 0, y, W, h, dx, y, W, h); }
        y += h * (1 + hash01(j + 11, frame + 7));
      }
      const shift = .016 * W * env, t = scratch[1];
      for (const [col, dx] of [['#ff0040', shift], ['#00e5ff', -shift]]) {   // 色ずれ: 赤と青緑の影を左右に
        const x = fit(t, W, H); x.drawImage(scratch[0], 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, W, H);
        g.globalAlpha = .75 * env; g.drawImage(t, dx, 0);
      }
      g.globalAlpha = 1; g.drawImage(scratch[0], 0, 0);
    },
    tiles(g, W, H, prev, next, p) {
      const cols = 12, rows = Math.max(1, Math.round(cols * H / W)), cw = W / cols, ch = H / rows, spread = .5;
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const q = clamp((p - (i + j) / Math.max(1, cols + rows - 2) * spread) / (1 - spread)), src = q < .5 ? prev : next, sc = q < .5 ? 1 - 2 * q : 2 * q - 1;
        if (!src || sc <= 0) continue;
        g.drawImage(src, i * cw, j * ch, cw, ch, i * cw + cw * (1 - sc) / 2, j * ch, cw * sc + .5, ch + .5);   // 升目が縦の軸で裏返る
      }
    },
    flip(g, W, H, prev, next, p) {
      const e = ease(p), src = e < .5 ? prev : next, sc = e < .5 ? 1 - 2 * e : 2 * e - 1;
      if (src && sc > 0) g.drawImage(src, 0, H / 2 * (1 - sc), W, H * sc);
    },
    brush(g, W, H, prev, next, p) {
      const n = 5, band = H / n, spread = .35;
      mix(g, W, H, prev, next, x => {
        x.fillStyle = '#000';
        for (let j = 0; j < n; j++) {
          const q = ease(clamp((p - spread * j / (n - 1)) / (1 - spread))); if (q <= 0) continue;
          const x1 = -W * .1 + W * 1.25 * q, y0 = j * band - band * .25, y1 = (j + 1) * band + band * .25, amp = band * .09, ph = hash01(j + 1, 3) * 6.28, steps = 24;
          x.beginPath(); x.moveTo(-1, y0);
          for (let i = 0; i <= steps; i++) { const xx = x1 * i / steps; x.lineTo(xx, y0 + amp * Math.sin(xx / (W * .08) + ph)); }
          x.quadraticCurveTo(x1 + band * .6, (y0 + y1) / 2, x1, y1);   // 筆の先は丸い
          for (let i = steps; i >= 0; i--) { const xx = x1 * i / steps; x.lineTo(xx, y1 + amp * Math.sin(xx / (W * .07) + ph * 1.7)); }
          x.closePath(); x.fill();
        }
      });
    },
    cover(g, W, H, prev, next, p, k, s) {   // 差し色の板が覆って、次の語を残して抜けていく（人物の後ろで、背景ごと一瞬その色になる）
      const first = p < .5, e = ease(first ? p * 2 : p * 2 - 1), under = first ? prev : next, flipX = k % 2 === 1;
      if (under) g.drawImage(under, 0, 0);
      const x0 = first ? 0 : W * e, w = first ? W * e : W - W * e;
      g.fillStyle = s.accent; g.fillRect(flipX ? W - x0 - w : x0, 0, w, H);
    },
  };

  /** 横に流れる1段（row: 段の真ん中の高さと段の高さ）。unit は1本分の文字 */
  function rowGlyphs(g0, W, unit, s, row, shift) {
    g0.font = backFontCSS(s.font, PX);
    const m = g0.measureText(unit), asc = m.actualBoundingBoxAscent, desc = m.actualBoundingBoxDescent, k = row.h * .84 / Math.max(1, asc + desc), px = PX * k;
    g0.font = backFontCSS(s.font, px);
    const unitW = Math.max(1, g0.measureText(unit).width), y = row.cy + (asc - desc) / 2 * k;
    const start = -((((shift(unitW)) % unitW) + unitW) % unitW);
    return (g, how) => {
      g.font = backFontCSS(s.font, px); g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
      const stroke = how === 'stroke' || row.outline; if (stroke) g.lineWidth = Math.max(2, row.h * .022);
      for (let x = start; x < W + px; x += unitW) { if (stroke) g.strokeText(unit, x, y); else g.fillText(unit, x, y); }
    };
  }

  function drawRows(g, W, H, words, s, sec, duration) {
    const sign = s.dir === 'right' ? -1 : 1, joined = from => { const w = words.map((_, i) => words[(i + from) % words.length].replaceAll('/', ' ')); return w.join('   ') + '   '; };
    const rows = [];
    if (s.mode === 'flow') rows.push({ cy: H / 2 - s.y * H, h: H * .6 * s.size, unit: joined(0), sign, outline: false });
    else { const n = clamp(Math.round(3 / s.size), 3, 10), h = H / n; for (let r = 0; r < n; r++) rows.push({ cy: h * (r + .5) - s.y * H, h, unit: joined(r), sign: r % 2 ? -sign : sign, outline: r % 2 === 1 }); }
    // 塗りの段と縁だけの段は、模様の付け方が違うので、別々に描く
    for (const outline of [false, true]) {
      const set = rows.filter(r => r.outline === outline); if (!set.length) continue;
      const parts = set.map(r => rowGlyphs(g, W, r.unit, s, r, unitW => r.sign * flowShift(unitW, W, s.speed, sec, duration)));
      paint(g, W, H, outline ? { ...s, fill: 'outline' } : s, (x, how) => { for (const part of parts) part(x, how); });
    }
  }

  return {
    /** フォントが読み込まれた時などに、取っておいた層を捨てる */
    reset() { layers.clear(); last = ''; },
    draw(canvas, sec, duration, settings, { width, height }) {
      const s = settings, words = backWords(s.text), W = Math.max(2, Math.round(width)), H = Math.max(2, Math.round(height));
      const [a, b] = backWindow(s.when, duration);
      if (!s.enabled || !words.length || sec < a || sec > b) return 'empty';
      const fade = backFade(s.when, sec, duration), slot = s.mode === 'giant' ? backSlot(s, sec, duration) : null;
      if (s.mode === 'giant' && !slot) return 'empty';
      // 同じ絵なら描き直さない（超デカで、切り替わりの済んだ間）
      const sig = s.mode === 'giant' && slot.p >= 1 && fade >= 1 ? [W, H, lookOf(s), s.back, s.backAlpha, 'held', slot.i, words[slot.i] ?? ''].join('|') : '';
      if (sig && sig === last && canvas.width === W && canvas.height === H) return 'same';
      const g = fit(canvas, W, H);
      if (s.backAlpha > 0) { g.globalAlpha = s.backAlpha * fade; g.fillStyle = s.back; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
      if (s.mode === 'giant') {
        const next = slot.i >= 0 ? layerOf(W, H, words[slot.i], s) : null, prev = slot.prev >= 0 && slot.p < 1 ? layerOf(W, H, words[slot.prev], s) : null;
        if (slot.p >= 1) { if (next) g.drawImage(next, 0, 0); }
        else { g.save(); (TRANS[backTransKind(s, slot.k)] || TRANS.cut)(g, W, H, prev, next, slot.p, slot.k, s); g.restore(); }
      } else { g.globalAlpha = fade; if (fade < 1) { const x = fit(scratch[2], W, H); drawRows(x, W, H, words, s, sec, duration); g.drawImage(scratch[2], 0, 0); } else drawRows(g, W, H, words, s, sec, duration); g.globalAlpha = 1; }
      last = sig;
      return 'drawn';
    },
  };
}
