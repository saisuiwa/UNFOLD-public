// Custom methods: the user's GLSL is wrapped and plugged into the vertex shader of motion.js, one ShaderMaterial per custom method.
// A custom method lives in "slot" 100 (A) or 101 (B) of the shader — the numbers the shader's uMethod / uMethod2 get.
import * as THREE from './vendor/three.module.min.js';
import { BUILTIN_IDS, DEFAULT_KEY, getCustom, isCustomKey, listCustom, onRegistryChange, resolveKey, setCustomStatus } from './method-registry.js';

export const SLOT_A = 100, SLOT_B = 101;
const FUNCTIONS_MARK = '//@CUSTOM_FUNCTIONS', DISPATCH_MARK = '//@CUSTOM_DISPATCH';
const newlines = text => (text.match(/\n/g) || []).length;

// Whatever the user's code returns goes through here: NaN/Infinity -> the original position, positions are kept within ±8,
// the particle look values stay in their ranges, and when nothing is broken yet (amount ≈ 0) the picture is exactly the original.
const runner = slot => `vec3 um_${slot}_run(vec2 p,float amount){
  vec3 r=um_${slot}_main(p,amount);
  if(any(isnan(r))||any(isinf(r)))r=vec3(p,0.);
  r=clamp(r,vec3(-8.),vec3(8.));
  gKind=clamp(floor(gKind+.5),0.,9.);gAlpha=clamp(gAlpha,0.,1.);gGlow=clamp(gGlow,0.,2.);gLocal=step(.5,gLocal);
  return mix(vec3(p,0.),r,smoothstep(0.,.03,amount));
}`;

// Returns the vertex shader with the user's method(s) plugged in, and where the user's code sits (for translating GPU error lines):
// map[slot] = { start0: 0-based line of the user's first line in the assembled source, lines: how many lines the user's code has }
export function assembleVertex(base, { a = '', b = '' } = {}) {
  if (base.split(FUNCTIONS_MARK).length !== 2 || base.split(DISPATCH_MARK).length !== 2) {
    throw new Error('motion.js の差し込み口（//@CUSTOM_FUNCTIONS と //@CUSTOM_DISPATCH）が見つかりません。');
  }
  let functions = '', dispatch = '', cursor = newlines(base.slice(0, base.indexOf(FUNCTIONS_MARK)));
  const map = {};
  for (const [slot, source, number] of [['a', a, SLOT_A], ['b', b, SLOT_B]]) {
    if (!source) continue;
    const text = `\n${source.replace(/\buserMethod\b/g, `um_${slot}_main`)}\n${runner(slot)}\n`;
    map[slot] = { start0: cursor + 1, lines: newlines(source) + 1 };
    cursor += newlines(text);
    functions += text;
    dispatch += `if(m>${number - .5}&&m<${number + .5})return um_${slot}_run(p,amount);`;
  }
  // function replacers: the user's code may contain "$&" and the like
  return { source: base.replace(FUNCTIONS_MARK, () => functions).replace(DISPATCH_MARK, () => dispatch), map };
}

// GPU log -> [{ slot, line, message }]. `prefix` is what three.js puts in front of our source (its line count is the offset).
export function explainLog(log, prefix, map = {}) {
  const offset = newlines(prefix || '') + 1;
  const out = [];
  for (const raw of String(log || '').replace(/\0/g, '').split('\n')) {
    const m = /^ERROR:\s*\d+:(\d+):\s*(.*)$/.exec(raw.trim());
    if (!m) continue;
    const assembled = Number(m[1]) - offset;
    let found = null;
    for (const [slot, { start0, lines }] of Object.entries(map)) {
      const line = assembled - start0;
      if (line >= 1 && line <= lines) { found = { slot, line }; break; }
    }
    out.push({ slot: found?.slot ?? null, line: found?.line ?? null, message: m[2].trim() });
  }
  return out;
}

// three.js compiles lazily: after compileAsync the program only reports a failure once something asks for its uniforms.
// Resolves to program.diagnostics when the program failed, otherwise null.
export async function compileCheck(renderer, material) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(geometry, material));
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 10);
  // three.js prints the whole shader when it fails; we show our own message instead, so keep that one out of the console
  const log = console.error;
  console.error = (...args) => { if (!String(args[0]).startsWith('THREE.WebGLProgram')) log.apply(console, args); };
  try {
    await renderer.compileAsync(scene, camera);
    const program = renderer.properties.get(material).currentProgram;
    program.getUniforms();
    return program.diagnostics?.runnable === false ? program.diagnostics : null;
  } finally {
    console.error = log;
    geometry.dispose();
  }
}

const errorsOf = (diagnostics, map) => {
  const errors = explainLog(diagnostics.vertexShader?.log || diagnostics.programLog, diagnostics.vertexShader?.prefix, map);
  return errors.length ? errors : [{ slot: null, line: null, message: 'コンパイルに失敗しました。' }];
};

// Compile one user method on its own (the editor does this before saving). Resolves to [] when it compiles, otherwise to the errors.
export async function compileUserMethod(renderer, { vertexShader, fragmentShader, source }) {
  const { source: assembled, map } = assembleVertex(vertexShader, { a: source });
  const material = new THREE.ShaderMaterial({ uniforms: {}, vertexShader: assembled, fragmentShader });
  try {
    const diagnostics = await compileCheck(renderer, material);
    return diagnostics ? errorsOf(diagnostics, map) : [];
  } finally {
    material.dispose();
  }
}

// One ShaderMaterial per custom method (or pair of them), made from the same shader and sharing `uniforms` with `base`.
// pick(keyA, keyB) -> { material, uMethod, uMethod2, used }: used = the custom methods really drawn with it. Never returns a shader that is still compiling or has failed —
// the custom method that is not ready is replaced by the default method, so the picture never breaks. onReady(variant) fires when one finishes.
export function createVariants({ renderer, vertexShader, fragmentShader, uniforms, onReady = () => {} }) {
  const make = source => new THREE.ShaderMaterial({ defaultAttributeValues: { color: [1, 1, 1], uv: [0, 0], uv1: [0, 0], tcell: [0, 0, 0] }, uniforms, vertexShader: source, fragmentShader, side: THREE.DoubleSide, transparent: true });
  const base = make(vertexShader);
  const variants = new Map();          // "cm-a@1|cm-b@2" -> { ids, key, map, state: 'pending' | 'ok' | 'failed', errors, material }
  let disposed = false;
  const keyOf = ids => ids.map(id => `${id}@${getCustom(id)?.rev}`).join('|');

  // shaders of methods that were removed, changed or switched off are dropped. One that is still compiling keeps its material until the
  // compile has ended: three.js polls the material, and throws from a timer if it was disposed in the meantime.
  const prune = () => {
    for (const [key, v] of variants) {
      if (v.ids.every(id => getCustom(id)?.status === 'ok') && key === keyOf(v.ids)) continue;
      if (v.state === 'pending') v.discard = true; else v.material.dispose();
      variants.delete(key);
    }
  };
  // every usable custom method gets its own shader as soon as it is registered (or tried again), not when a ◆ first needs it:
  // a broken one is switched off right away, and a working one is ready before it is used
  const prepareAll = () => { for (const c of listCustom()) if (c.status === 'ok' && !c.code) build([c.id]); };
  const stopListening = onRegistryChange(() => { prune(); prepareAll(); });

  function settle(v) {
    if (disposed || variants.get(v.key) !== v) return;
    if (v.state === 'failed' && v.ids.length === 1) {   // a pair that fails is nobody's fault alone
      const e = v.errors[0];
      setCustomStatus(v.ids[0], 'disabled', e ? `${e.line ? `${e.line}行目: ` : ''}${e.message}` : 'コンパイルに失敗しました。');
    }
    onReady(v);
  }

  function build(ids) {
    const key = keyOf(ids);
    const known = variants.get(key);
    if (known) return known;
    const { source, map } = assembleVertex(vertexShader, { a: getCustom(ids[0]).vertex, b: ids[1] ? getCustom(ids[1]).vertex : '' });
    const v = { ids, key, map, state: 'pending', errors: [], material: make(source) };
    variants.set(key, v);
    compileCheck(renderer, v.material).then(
      diagnostics => { if (diagnostics) { v.state = 'failed'; v.errors = errorsOf(diagnostics, map); } else v.state = 'ok'; },
      error => { v.state = 'failed'; v.errors = [{ slot: null, line: null, message: String(error?.message || error) }]; },
    ).then(() => { settle(v); if (v.discard) v.material.dispose(); });
    return v;
  }

  function pick(keyA, keyB = '') {
    let a = keyA ? resolveKey(keyA) : DEFAULT_KEY, b = keyB ? resolveKey(keyB) : '';
    for (;;) {
      const ids = [...new Set([a, b].filter(k=>isCustomKey(k)&&!getCustom(k)?.code))];
      if (!ids.length) return { material: base, uMethod: BUILTIN_IDS[a]??0, uMethod2: b ? (BUILTIN_IDS[b]??0) : 0, used: [] };
      const v = build(ids);
      if (v.state === 'ok') {
        const number = key => ids.indexOf(key) === 0 ? SLOT_A : SLOT_B;
        return { material: v.material, uMethod: isCustomKey(a) ? number(a) : BUILTIN_IDS[a], uMethod2: !b ? 0 : isCustomKey(b) ? number(b) : BUILTIN_IDS[b], used: [...ids] };
      }
      // still compiling, or failed: step back — the last custom method becomes the default method, then the first
      const give = ids[ids.length - 1];
      if (a === give) a = DEFAULT_KEY;
      if (b === give) b = DEFAULT_KEY;
    }
  }

  prepareAll();
  return {
    base, pick,
    count: () => variants.size,
    // resolves once no shader is compiling any more (a failed one counts as finished); used before exporting a video
    ready: () => new Promise(resolve => {
      const check = () => ([...variants.values()].some(v => v.state === 'pending') ? setTimeout(check, 20) : resolve());
      check();
    }),
    dispose() {
      disposed = true;
      stopListening();
      for (const v of variants.values()) { if (v.state === 'pending') v.discard = true; else v.material.dispose(); }
      variants.clear();
      base.dispose();
    },
  };
}
