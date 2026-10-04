import { addRenderUniforms, applyRenderLook, cleanRenderLook, syncPerspective } from './render-look.js?v=2';
// A small preview of one custom method, for the editor: its own WebGL canvas, the same shaders and the same grid of tiles/grains as the real pages.
import * as THREE from './vendor/three.module.min.js';
import { assembleVertex } from './custom-method.js';

const TILES = 16, SUB = 5;

// the picture as 16×16 tiles of 5×5 grains (two triangles each), like the single-image page builds it
export function gridGeometry(w, h, sub = SUB) {
  const count = TILES * TILES * sub * sub * 6;
  const positions = new Float32Array(count * 3), uvs = new Float32Array(count * 2), cells = new Float32Array(count * 2), parts = new Float32Array(count * 4);
  let i = 0;
  const step = 1 / (TILES * sub);
  for (let cy = 0; cy < TILES; cy++) for (let cx = 0; cx < TILES; cx++) for (let sy = 0; sy < sub; sy++) for (let sx = 0; sx < sub; sx++) {
    const u = (cx + sx / sub) / TILES, v = (cy + sy / sub) / TILES;
    for (const [du, dv] of [[0, 0], [1, 0], [0, 1], [1, 0], [1, 1], [0, 1]]) {
      const a = u + du * step, b = v + dv * step;
      positions.set([(a - .5) * w, (b - .5) * h, 0], i * 3);
      uvs.set([a, b], i * 2);
      cells.set([(cx + .5) / TILES, (cy + .5) / TILES], i * 2);
      parts.set([u + step / 2, v + step / 2, du, dv], i * 4);
      i++;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute('cell', new THREE.BufferAttribute(cells, 2));
  geometry.setAttribute('part', new THREE.BufferAttribute(parts, 4));
  geometry.setAttribute('targetPosition', new THREE.BufferAttribute(new Float32Array(count * 3), 3));   // the preview never turns the picture into a solid
  return geometry;
}

// a colourful picture with letters, for when no picture is open
export function makeTestImage(width = 960, height = 540) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const g = canvas.getContext('2d');
  g.fillStyle = '#ebeada'; g.fillRect(0, 0, width, height);
  const colors = ['#ff7145', '#2855b9', '#cce876', '#eee9d6', '#678cc5', '#dc472c'];
  const cw = width / 8, ch = height / 4.5;
  for (let j = 0; j < 5; j++) for (let i = 0; i < 8; i++) { g.fillStyle = colors[(i + j * 2) % colors.length]; g.fillRect(i * cw, j * ch, cw, ch); }
  g.strokeStyle = '#172719'; g.lineWidth = 2;
  for (let x = 0; x < width; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, height); g.stroke(); }
  for (let y = 0; y < height; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(width, y); g.stroke(); }
  g.fillStyle = '#f1f0da'; g.fillRect(width * .08, height * .22, width * .84, height * .56);
  g.fillStyle = '#183625'; g.font = `bold ${Math.round(height * .3)}px sans-serif`; g.textAlign = 'center'; g.fillText('UNFOLD', width / 2, height * .6);
  return canvas;
}

export function createPreview(canvas, { vertexShader, fragmentShader }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor('#111718', 1);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-4.8, 4.8, 2.7, -2.7, .1, 100);
  camera.position.z = 10;
  const perspective = new THREE.PerspectiveCamera();
  let look = cleanRenderLook(), fixedTime = null;
  const uniforms = {
    uImage: { value: null }, uSize: { value: new THREE.Vector2(5.25, 2.95) }, uDistort: { value: 0 }, uForm: { value: 0 }, uStrength: { value: .75 },
    uDepth: { value: 1 }, uSeed: { value: 28 }, uMethod: { value: 0 }, uMethod2: { value: 0 }, uMethodMix: { value: 0 }, uProject: { value: 0 },
    uTime: { value: 0 }, uDraw: { value: 1 }, uThrough: { value: 0 }, uFade: { value: 1 }, uGlass: { value: 0 }, uShape: { value: 0 }, uPreset: { value: 0 }, uConceal: { value: 0 },
  };
  addRenderUniforms(uniforms);
  const makeMaterial = source => new THREE.ShaderMaterial({ defaultAttributeValues: { color: [1, 1, 1], uv: [0, 0], uv1: [0, 0], tcell: [0, 0, 0] }, uniforms, vertexShader: source, fragmentShader, side: THREE.DoubleSide, transparent: true });
  let material = makeMaterial(vertexShader), mesh = null, texture = null;

  function draw() { renderer.render(scene, syncPerspective(camera, perspective, look.enabled ? look.perspective : 0)); }

  return {
    renderer,
    setLook(value) { look = cleanRenderLook(value); applyRenderLook(uniforms, look); draw(); },
    setTime(value) { fixedTime = Number.isFinite(value) ? value : null; },
    render() { draw(); },
    resize(width, height) {
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
      const aspect = width / height, h = Math.max(5.4, 6.8 / aspect);
      Object.assign(camera, { left: -h * aspect / 2, right: h * aspect / 2, top: h / 2, bottom: -h / 2 });
      camera.updateProjectionMatrix();
      draw();
    },
    setImage(image) {
      texture?.dispose();
      texture = new THREE.CanvasTexture(image);
      texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter; texture.generateMipmaps = false; texture.colorSpace = THREE.SRGBColorSpace;
      const aspect = image.width / image.height, h = Math.min(3.65, 5.25 / aspect), w = h * aspect;
      uniforms.uImage.value = texture;
      uniforms.uSize.value.set(w, h);
      const previous = mesh?.geometry;
      if (!mesh) { mesh = new THREE.Mesh(gridGeometry(w, h), material); mesh.frustumCulled = false; scene.add(mesh); }
      else mesh.geometry = gridGeometry(w, h);
      previous?.dispose();
      draw();
    },
    // show the user's code (it must compile); setSource(null) goes back to the built-in default method
    setSource(source) {
      const next = source ? makeMaterial(assembleVertex(vertexShader, { a: source }).source) : makeMaterial(vertexShader);
      const previous = material;
      material = next;
      if (mesh) mesh.material = next;
      previous.dispose();
      uniforms.uMethod.value = source ? 100 : 0;
      draw();
    },
    // Explicit method amount. Preserve uStrength's meaning and normalize the look blend.
    setAmount(amount) {
      uniforms.uStrength.value = .8;
      uniforms.uDistort.value = Math.max(0, Math.min(.8, Number(amount) || 0)) / .8;
      uniforms.uTime.value = fixedTime ?? (performance.now() / 1000) % 1000;
      draw();
    },
    setProgress(progress) {
      uniforms.uDistort.value = progress;
      uniforms.uTime.value = fixedTime ?? (performance.now() / 1000) % 1000;
      draw();
    },
    dispose() {
      texture?.dispose(); mesh?.geometry.dispose(); material.dispose();
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}
