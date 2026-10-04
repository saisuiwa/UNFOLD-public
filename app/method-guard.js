// First line of defence for user-written methods: a quick look at the text — it is not a real GLSL parser.
// The real gatekeepers are the GPU compile and the trial render; this stops the obvious troubles before that.
export const LIMITS = { maxChars: 8000, maxLoop: 64, loopBudget: 256 };

const BANNED_WORDS = ['while', 'do', 'goto', 'discard', 'main', 'uniform', 'attribute', 'varying', 'layout', 'precision'];
const TOP_LEVEL_QUALIFIERS = ['in', 'out', 'inout'];
const ENTRY = /\bvec3\s+userMethod\s*\(\s*vec2\s+[A-Za-z_]\w*\s*,\s*float\s+[A-Za-z_]\w*\s*\)\s*\{/g;
// for (int i = A; i < B; i++)   also  i <= B, ++i, i += S — only counting up, with plain numbers
const FOR_HEAD = /^\s*int\s+([A-Za-z_]\w*)\s*=\s*(\d+)\s*;\s*\1\s*(<=|<)\s*(\d+)\s*;\s*(?:\1\s*\+\+|\+\+\s*\1|\1\s*\+=\s*(\d+))\s*$/;
const LOOP_FORM = 'ループは `for (int i = 0; i < 回数; i++)` の形（回数は数字）だけ使えます。';

// comments are blanked out (not removed) so that the line numbers stay the same
const stripComments = src => src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, m => m.replace(/[^\n]/g, ' '));

function matchClose(code, openIndex, open, close) {
  let depth = 0;
  for (let i = openIndex; i < code.length; i++) {
    if (code[i] === open) depth++;
    else if (code[i] === close && --depth === 0) return i;
  }
  return -1;
}

// how many times the bodies of the loops in code[from, to) run, in total (nested loops multiply)
function scanLoops(code, from, to, multiplier, add) {
  let total = 0, position = from;
  const re = /\bfor\b/g;
  for (;;) {
    re.lastIndex = position;
    const found = re.exec(code);
    if (!found || found.index >= to) return total;
    const open = code.indexOf('(', found.index + 3);
    if (open < 0 || code.slice(found.index + 3, open).trim() !== '') { add(found.index, LOOP_FORM); return total; }
    const close = matchClose(code, open, '(', ')');
    if (close < 0 || close >= to) { add(found.index, LOOP_FORM); return total; }
    let b = close + 1;
    while (b < to && /\s/.test(code[b])) b++;
    if (code[b] !== '{') { add(found.index, '`for` の本体は `{ }` で囲んでください。'); position = close + 1; continue; }
    const end = matchClose(code, b, '{', '}'), bodyEnd = end < 0 ? to : end;
    const head = FOR_HEAD.exec(code.slice(open + 1, close));
    if (!head) { add(found.index, LOOP_FORM); position = bodyEnd + 1; continue; }
    const [, variable, start, op, limit, stepText] = head;
    const step = Number(stepText || 1);
    const count = step < 1 ? Infinity
      : op === '<' ? Math.max(0, Math.ceil((Number(limit) - Number(start)) / step))
      : Math.max(0, Math.floor((Number(limit) - Number(start)) / step) + 1);
    if (count > LIMITS.maxLoop) add(found.index, `ループの回数が多すぎます（1つあたり${LIMITS.maxLoop}回まで）。`);
    const body = code.slice(b + 1, bodyEnd);
    if (new RegExp(`\\b${variable}\\s*(?:=(?!=)|[-+*/%]=|\\+\\+|--)|(?:\\+\\+|--)\\s*${variable}\\b`).test(body)) {
      add(found.index, `ループ変数 \`${variable}\` は \`for\` の中で書き換えられません。`);
    }
    total += count * multiplier;
    total += scanLoops(code, b + 1, bodyEnd, multiplier * (Number.isFinite(count) ? count : 1), add);
    position = bodyEnd + 1;
  }
}

export function checkSource(source) {
  const text = String(source ?? '');
  if (!text.trim()) return { ok: false, errors: [{ line: null, message: 'コードが空です。' }], loops: 0 };
  if (text.length > LIMITS.maxChars) return { ok: false, errors: [{ line: null, message: `長すぎます（${LIMITS.maxChars}文字まで）。` }], loops: 0 };
  const code = stripComments(text);
  const errors = [];
  const add = (index, message) => errors.push({ line: index == null ? null : code.slice(0, index).split('\n').length, message });

  const hash = /#/.exec(code);
  if (hash) add(hash.index, '`#` で始まる行（前処理）は使えません。');
  for (const word of BANNED_WORDS) {
    const m = new RegExp(`\\b${word}\\b`).exec(code);
    if (m) add(m.index, `\`${word}\` は使えません。`);
  }
  const gl = /\bgl_\w*/.exec(code);
  if (gl) add(gl.index, '`gl_` で始まる名前は使えません。');

  // in / out / inout are fine inside a function's parentheses, but not as declarations at the top level
  let braces = 0, parens = 0;
  for (const m of code.matchAll(/[{}()]|\b[A-Za-z_]\w*\b/g)) {
    const token = m[0];
    if (token === '{') braces++;
    else if (token === '}') braces--;
    else if (token === '(') parens++;
    else if (token === ')') parens--;
    else if (braces === 0 && parens === 0 && TOP_LEVEL_QUALIFIERS.includes(token)) add(m.index, `\`${token}\` の宣言は使えません。`);
  }

  const entries = [...code.matchAll(ENTRY)];
  if (entries.length !== 1) add(null, '`vec3 userMethod(vec2 p, float amount)` を1つ書いてください。');
  const entry = entries.length === 1 ? entries[0] : null;
  const bodyOpen = entry ? entry.index + entry[0].length - 1 : -1;
  const bodyClose = entry ? matchClose(code, bodyOpen, '{', '}') : -1;
  const bodyEnd = bodyClose < 0 ? code.length : bodyClose;
  for (const m of code.matchAll(/\bfor\b/g)) {
    if (!entry || m.index < bodyOpen || m.index > bodyEnd) add(m.index, 'ループ（`for`）は `userMethod` の中だけで使えます。');
  }
  const loops = entry ? scanLoops(code, bodyOpen + 1, bodyEnd, 1, add) : 0;
  if (loops > LIMITS.loopBudget) add(null, `ループの実行回数の合計が多すぎます（${loops}回。${LIMITS.loopBudget}回まで）。`);
  return { ok: errors.length === 0, errors, loops };
}
