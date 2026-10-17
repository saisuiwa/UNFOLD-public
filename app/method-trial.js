import { addRenderUniforms } from './render-look.js?v=2';
// The trial render: before a custom method is saved (or switched on), draw it on a small canvas and see two things —
// whether it is too heavy (compared with the heaviest built-in method, measured on the same GPU at the same time),
// and whether it shows anything at all. It is the second gatekeeper after the compile; the first is the text check.
import * as THREE from './vendor/three.module.min.js';
import { assembleVertex, compileCheck } from './custom-method.js';
import { BUILTIN_IDS } from './method-registry.js';
import { gridGeometry, makeTestImage } from './method-preview.js';

// factor: how many times heavier than the baseline is still fine. floors: below these numbers the timer is only noise — on a fast GPU every
// method takes a few hundredths of a millisecond, so there the floors are what really decide; on a slow GPU the baseline does.
// baselineKey: the heaviest built-in method (measured on 2026-10-03 — on a fast GPU the 29 are too close to tell apart, see the plan).
// sampleMs: how long one timing sample should take (so a heavy method is not measured for seconds); maxReps / giveUpMs: see time().
// warmupMs: how long the page's first drawing goes on before anything is timed (see warmUp()).
export const TRIAL = { factor: 4, smallFloorMs: 1, fullFloorMs: 4, baselineKey: 'petals', progresses: [0, .25, .5, .75, 1], runs: 3, smallSub: 1, fullSub: 5, width: 160, height: 90, sampleMs: 8, maxReps: 100, giveUpMs: 200, warmupMs: 600 };

export const median = values => {
  const sorted = [...values].sort((a, b) => a - b), mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

// heavy: more than `factor` times the baseline and above the floor. ratio is null when the baseline was too small to measure.
export function judgeTrial({ customMs, baselineMs, floorMs, factor = TRIAL.factor }) {
  return { ratio: baselineMs > 0 ? customMs / baselineMs : null, heavy: customMs > Math.max(floorMs, factor * baselineMs) };
}

// The line shown when the trial passed. "N times the heaviest built-in" alone looks like a failure once N is over the factor, so say why it
// still passes: on a fast GPU the heaviest built-in takes a few hundredths of a millisecond, a few times that is still nothing (the floors).
export function describeTrialPass({ ratio, customMs }) {
  if (ratio == null) return 'ごく軽い';
  const times = `標準の重いメソッドの約${ratio.toFixed(1)}倍`;
  if (ratio <= TRIAL.factor || !(customMs >= 0)) return times;
  return `${times}。ただ、1回の描画が${customMs < 0.1 ? '0.1ミリ秒未満' : `約${customMs.toFixed(1)}ミリ秒`}と軽いので問題なし`;
}

const sameFrame = (a, b, tolerance = 0.5) => {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / a.length <= tolerance;
};
// start / middle / end: pixels (RGBA) at the start, halfway and at the end of the breaking up. restMiddle / restEnd: the same two frames drawn by
// a method that does nothing — the built-in shader darkens a picture a little while it breaks, so "unchanged" is judged against those, not the start.
// blank: nothing but the background is left halfway. unchanged: it looks just like doing nothing.
export function judgeFrames({ start, middle, end, restMiddle, restEnd }) {
  const background = [start[0], start[1], start[2]];
  let blank = true;
  for (let i = 0; i < middle.length && blank; i += 4) blank = Math.abs(middle[i] - background[0]) <= 2 && Math.abs(middle[i + 1] - background[1]) <= 2 && Math.abs(middle[i + 2] - background[2]) <= 2;
  return { blank, unchanged: sameFrame(middle, restMiddle) && sameFrame(end, restEnd) };
}

// a method that does nothing: what "unchanged" is compared with
const REST_SOURCE = 'vec3 userMethod(vec2 p, float amount) { return vec3(p, 0.); }';

export function createTrial({ vertexShader, fragmentShader }) {
  let rig = null;

  function build() {
    const canvas = document.createElement('canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(TRIAL.width, TRIAL.height, false);
    renderer.setClearColor('#111718', 1);
    const aspect = TRIAL.width / TRIAL.height, h = Math.min(3.65, 5.25 / aspect), w = h * aspect, view = Math.max(5.4, 6.8 / aspect);
    const camera = new THREE.OrthographicCamera(-view * aspect / 2, view * aspect / 2, view / 2, -view / 2, .1, 100);
    camera.position.z = 10;
    const texture = new THREE.CanvasTexture(makeTestImage(320, 180));
    texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter; texture.generateMipmaps = false; texture.colorSpace = THREE.SRGBColorSpace;
    const uniforms = {
      uImage: { value: texture }, uSize: { value: new THREE.Vector2(w, h) }, uDistort: { value: 0 }, uForm: { value: 0 }, uStrength: { value: .75 },
      uDepth: { value: 1 }, uSeed: { value: 28 }, uMethod: { value: 0 }, uMethod2: { value: 0 }, uMethodMix: { value: 0 }, uProject: { value: 0 },
      uTime: { value: 1.5 }, uDraw: { value: 1 }, uThrough: { value: 0 }, uFade: { value: 1 }, uGlass: { value: 0 }, uShape: { value: 0 }, uPreset: { value: 0 }, uConceal: { value: 0 },
    };
    addRenderUniforms(uniforms);
    const material = source => new THREE.ShaderMaterial({ defaultAttributeValues: { color: [1, 1, 1], uv: [0, 0], uv1: [0, 0], tcell: [0, 0, 0], modelColor: [0, 0, 0, 0], modelUv: [0, 0, 0], modelNormal: [0, 0, 0, 0] }, uniforms, vertexShader: source, fragmentShader, side: THREE.DoubleSide, transparent: true });
    const scene = new THREE.Scene();
    const mesh = new THREE.Mesh(gridGeometry(w, h, TRIAL.smallSub), material(vertexShader));
    mesh.frustumCulled = false;
    scene.add(mesh);
    return {
      renderer, scene, camera, uniforms, mesh, gl: renderer.getContext(), material, pixel: new Uint8Array(4),
      geometry: { small: mesh.geometry, full: gridGeometry(w, h, TRIAL.fullSub) },
      base: mesh.material,
    };
  }

  // Milliseconds per render: the median of a few timing samples at every step of the breaking up. A sample is a batch of renders followed by
  // a 1-pixel readPixels, which is what makes the browser wait for the GPU (finish() does not), divided by the number of renders.
  // One render is much shorter than the timer's resolution on a fast GPU, so the batch size is chosen from a first estimate: about sampleMs per sample.
  function time(material, geometry, uMethod) {
    const { renderer, scene, camera, uniforms, mesh, gl } = rig;
    const wait = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, rig.pixel);
    mesh.material = material; mesh.geometry = geometry; uniforms.uMethod.value = uMethod;
    uniforms.uDistort.value = .5; renderer.render(scene, camera); wait();          // the first render uploads everything
    const t0 = performance.now();
    for (let i = 0; i < 3; i++) renderer.render(scene, camera);
    wait();
    const estimate = Math.max((performance.now() - t0) / 3, 0.001);
    if (estimate > TRIAL.giveUpMs) return estimate;                                // absurdly slow: no point in measuring more
    const reps = Math.max(1, Math.min(TRIAL.maxReps, Math.floor(TRIAL.sampleMs / estimate)));
    const samples = [];
    for (const p of TRIAL.progresses) {
      uniforms.uDistort.value = p;
      for (let i = 0; i < TRIAL.runs; i++) {
        const start = performance.now();
        for (let r = 0; r < reps; r++) renderer.render(scene, camera);
        wait();
        samples.push((performance.now() - start) / reps);
      }
    }
    return median(samples);
  }
  // Milliseconds per render of the method under test AND of the baseline, measured side by side: every timing sample of one is followed by a
  // sample of the other (the order alternates), so a stretch of slow machine — another program using the processor, the browser busy with
  // something else — slows both and the ratio stays what it is. The baseline used to be timed once per page and compared with a custom method
  // timed minutes later, and on a busy machine the first method came out "9 times heavier" while it was the built-in itself.
  function timePair(material, geometry, uMethod) {
    const { renderer, scene, camera, uniforms, mesh, gl } = rig;
    const baseId = BUILTIN_IDS[TRIAL.baselineKey];
    const wait = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, rig.pixel);
    const use = (m, id) => { mesh.material = m; mesh.geometry = geometry; uniforms.uMethod.value = id; };
    const estimate = (m, id) => {
      use(m, id); uniforms.uDistort.value = .5; renderer.render(scene, camera); wait();      // the first render uploads everything
      const t0 = performance.now();
      for (let i = 0; i < 3; i++) renderer.render(scene, camera);
      wait();
      return Math.max((performance.now() - t0) / 3, 0.001);
    };
    const estCustom = estimate(material, uMethod), estBase = estimate(rig.base, baseId);
    if (estCustom > TRIAL.giveUpMs) return { customMs: estCustom, baselineMs: estBase };       // absurdly slow: no point in measuring more
    const repsOf = est => Math.max(1, Math.min(TRIAL.maxReps, Math.floor(TRIAL.sampleMs / est)));
    const repsCustom = repsOf(estCustom), repsBase = repsOf(estBase);
    const sample = (m, id, reps) => {
      use(m, id);
      const start = performance.now();
      for (let r = 0; r < reps; r++) renderer.render(scene, camera);
      wait();
      return (performance.now() - start) / reps;
    };
    const custom = [], base = [];
    let customFirst = true;
    for (const p of TRIAL.progresses) {
      uniforms.uDistort.value = p;
      for (let i = 0; i < TRIAL.runs; i++) {
        if (customFirst) { custom.push(sample(material, uMethod, repsCustom)); base.push(sample(rig.base, baseId, repsBase)); }
        else { base.push(sample(rig.base, baseId, repsBase)); custom.push(sample(material, uMethod, repsCustom)); }
        customFirst = !customFirst;
      }
    }
    return { customMs: median(custom), baselineMs: median(base) };
  }
  function pixels(material, geometry, uMethod, progress) {
    const { renderer, scene, camera, uniforms, mesh, gl } = rig;
    mesh.material = material; mesh.geometry = geometry; uniforms.uMethod.value = uMethod; uniforms.uDistort.value = progress;
    renderer.render(scene, camera);
    const out = new Uint8Array(TRIAL.width * TRIAL.height * 4);
    gl.readPixels(0, 0, TRIAL.width, TRIAL.height, gl.RGBA, gl.UNSIGNED_BYTE, out);
    return out;
  }
  // A fresh WebGL context is slow for its first moments: the driver is still working on the shader code it was given (headless Chrome, measured: about
  // four times slower for roughly a quarter of a second after the first draw, then the time per render drops to a fraction). A series timed inside that
  // window measures that, not the method: the first method tried on a page came out "5 times heavier than the heaviest built-in" on more than half of
  // the fresh pages, also when it was that built-in itself (the petals sample). So the first thing a page's trial does is draw the baseline, untimed,
  // until `warmupMs` have passed since that first draw finished. Once per page. (What is left after that — a busy processor — is what timePair() is for.)
  function warmUp() {
    const { renderer, scene, camera, uniforms, mesh, gl } = rig;
    mesh.material = rig.base; mesh.geometry = rig.geometry.small; uniforms.uMethod.value = BUILTIN_IDS[TRIAL.baselineKey]; uniforms.uDistort.value = .5;
    const draw = () => { for (let i = 0; i < 4; i++) renderer.render(scene, camera); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, rig.pixel); };
    draw();                                                                        // the first draw compiles and uploads everything
    const settleBy = performance.now() + TRIAL.warmupMs;
    while (performance.now() < settleBy) draw();
  }
  const ensureRig = () => { if (!rig) { rig = build(); warmUp(); } };

  return {
    // Resolves to { stage, heavy, ratio, customMs, baselineMs, blank, unchanged }; the options are for tests.
    async run(source, { factor = TRIAL.factor, smallFloorMs = TRIAL.smallFloorMs, fullFloorMs = TRIAL.fullFloorMs } = {}) {
      ensureRig();
      const material = rig.material(assembleVertex(vertexShader, { a: source }).source);
      try {
        const diagnostics = await compileCheck(rig.renderer, material);
        if (diagnostics) throw new Error('コンパイルできませんでした');
        const smallPair = timePair(material, rig.geometry.small, 100);
        const small = judgeTrial({ customMs: smallPair.customMs, baselineMs: smallPair.baselineMs, floorMs: smallFloorMs, factor });
        if (small.heavy) return { stage: 'small', customMs: smallPair.customMs, baselineMs: smallPair.baselineMs, ratio: small.ratio, heavy: true, blank: false, unchanged: false };
        const { customMs, baselineMs } = timePair(material, rig.geometry.full, 100);
        const full = judgeTrial({ customMs, baselineMs, floorMs: fullFloorMs, factor });
        rig.rest ??= rig.material(assembleVertex(vertexShader, { a: REST_SOURCE }).source);
        const frames = (m, p) => pixels(m, rig.geometry.full, 100, p);
        const look = judgeFrames({
          start: frames(material, 0), middle: frames(material, .5), end: frames(material, 1), restMiddle: frames(rig.rest, .5), restEnd: frames(rig.rest, 1),
        });
        return { stage: 'full', customMs, baselineMs, ratio: full.ratio, heavy: full.heavy, ...look };
      } finally {
        material.dispose();
      }
    },
    // how long every built-in method takes on the small and the full mesh (to choose the baseline); returns { key: { small, full } }
    measureBuiltins() {
      ensureRig();
      const out = {};
      for (const [key, id] of Object.entries(BUILTIN_IDS)) out[key] = { small: time(rig.base, rig.geometry.small, id), full: time(rig.base, rig.geometry.full, id) };
      return out;
    },
  };
}
