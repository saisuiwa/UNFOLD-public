// アニメ調の立体（2026-11-10）: 立体をセル塗り（陰が「明るい・暗い」の2段）にして、ふちに輪郭線を引く。
//   ・セル塗りは、絵の粒のシェーダーの光の計算（render-look.js の surfaceLight）を2段にするだけ（uToon / uToonShade）。
//   ・輪郭線は、立体だけを別の画像（色と奥行き）に撮り、画面と同じ大きさの板がその縁を拾って線を描く:
//       外側のふち（立体がある／ない の境目）と、内側の段差（腕が体の前にある所など、奥行きが急に変わる所）。
//     板は場面の中で立体のすぐ後に描くので、あとから描く物（1枚モードの人物など）は線の手前に来るし、画面の効果（ぼかし・発光）も線にかかる。
//   ・立体が出来上がっている間だけ出る（粒が閉じた所で線が現れ、ほどけ始めると消える。ばらけた立体は全部が縁になってしまうため）。
// value = { enabled, cel: セル塗りにする, shade: 陰の濃さ 0–0.8, line: 輪郭線の太さ 0–1（0 = 線なし）, colour: 線の色 '#rrggbb', beat: 拍で線が光る（シーケンス） }
const num = (x, lo, hi, d) => typeof x === 'number' && Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const HEX = /^#[0-9a-f]{6}$/i;
export const TOON_LINE = '#0b0b10';
export function cleanToon(value) {
  const v = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return { enabled: v.enabled === true, cel: v.cel !== false, shade: Math.round(num(v.shade, 0, .8, .45) * 100) / 100, line: Math.round(num(v.line, 0, 1, .5) * 100) / 100,
    colour: typeof v.colour === 'string' && HEX.test(v.colour) ? v.colour.toLowerCase() : TOON_LINE, beat: v.beat === true };
}
// the shader's side: two steps of light while it is on (the uniforms are made by render-look.js's addRenderUniforms)
export function applyToon(uniforms, value, on = true) {
  const t = cleanToon(value);
  uniforms.uToon ??= { value: 0 }; uniforms.uToonShade ??= { value: .45 };
  uniforms.uToon.value = on && t.enabled && t.cel ? 1 : 0; uniforms.uToonShade.value = t.shade;
}
const hexRgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
function hslRgb(h, s, l) { const f = n => { const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); }; return [f(0), f(8), f(4)]; }
// the line at this moment: strength 0–1 (it comes with the solid: form 0–1), half-width as a share of the view's height, colour [r, g, b] (sRGB 0–1).
// beat: beats since the first beat, or null when there is no beat — with 拍で光る the line swells and takes a bright colour on each beat
export function lineAt(value, form, beat = null) {
  const t = cleanToon(value), strength = t.enabled && t.line > 0 ? smooth(.9996, .99995, form) : 0;   // only once the pieces have closed up (they are still a pixel or two apart at 99.9 %): a loose solid is all edges
  let width = t.line * .0046, colour = hexRgb(t.colour);
  if (t.beat && beat !== null && Number.isFinite(beat)) { const n = Math.floor(beat), k = Math.exp(-(beat - n) * 5); width *= 1 + .9 * k; colour = hslRgb((((n * .17) % 1) + 1) % 1, .9, .22 + .4 * k); }
  return { strength, width, colour };
}

const VERT = `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const FRAG = `
uniform sampler2D uMask,uDepth;
uniform vec2 uTexel;
uniform float uRadius,uStrength,uNear,uFar,uPersp,uJump;
uniform vec3 uColor;
varying vec2 vUv;
float covered(vec2 uv){return step(.5,texture2D(uMask,uv).a);}
float depthAt(vec2 uv){float d=texture2D(uDepth,uv).x;return uPersp>.5?uNear*uFar/(uFar-d*(uFar-uNear)):uNear+d*(uFar-uNear);}
void main(){
  // covered or not: by the pixel and its four neighbours, so that a pinhole between two pieces is not an edge
  float a=step(2.5,covered(vUv)+covered(vUv+vec2(uTexel.x,0.))+covered(vUv-vec2(uTexel.x,0.))+covered(vUv+vec2(0.,uTexel.y))+covered(vUv-vec2(0.,uTexel.y)));
  float z=depthAt(vUv),edge=0.,jump=0.;
  for(int i=0;i<6;i++){
    float t=float(i)*.5235988;vec2 o=vec2(cos(t),sin(t))*uRadius*uTexel;
    float a1=covered(vUv+o),a2=covered(vUv-o);
    edge+=abs(a1-a)+abs(a2-a);
    // a step in depth between two covered neighbours (not a slope: the two sides of a slope cancel)
    if(a*a1*a2>.5)jump=max(jump,abs(depthAt(vUv+o)+depthAt(vUv-o)-2.*z));
  }
  float line=max(smoothstep(.1,.24,edge/12.),smoothstep(uJump*.6,uJump,jump));
  if(line*uStrength<.004)discard;
  gl_FragColor=vec4(uColor,line*uStrength);
  #include <colorspace_fragment>
}`;
export function createOutline(THREE) {
  const size = new THREE.Vector2(), kept = new THREE.Color();
  let target = null;
  const uniforms = { uMask: { value: null }, uDepth: { value: null }, uTexel: { value: new THREE.Vector2() }, uRadius: { value: 0 }, uStrength: { value: 0 }, uNear: { value: .1 }, uFar: { value: 100 },
    uPersp: { value: 0 }, uJump: { value: 1 }, uColor: { value: new THREE.Color() } };
  const object = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthTest: false, depthWrite: false }));
  object.frustumCulled = false; object.renderOrder = 1; object.visible = false;   // right after the solid (0); what is drawn later covers the line
  return {
    object,
    // before the scene is drawn: take the solid alone (its coverage and depth) with the camera the scene will be drawn with.
    // line: what lineAt gave; unit: the picture's height in the scene's units (the depth step that counts as an edge is measured against it)
    prepare(renderer, mesh, camera, line, unit) {
      object.visible = line.strength > 0 && mesh.visible;
      if (!object.visible) return;
      renderer.getDrawingBufferSize(size); const w = Math.max(1, size.x), h = Math.max(1, size.y);
      if (!target || target.width !== w || target.height !== h) { target?.depthTexture?.dispose(); target?.dispose(); target = new THREE.WebGLRenderTarget(w, h, { depthBuffer: true, depthTexture: new THREE.DepthTexture(w, h) }); }
      const before = renderer.getRenderTarget(), alpha = renderer.getClearAlpha(), auto = renderer.autoClear; renderer.getClearColor(kept);
      renderer.setRenderTarget(target); renderer.setClearColor(0x000000, 0); renderer.autoClear = true; renderer.render(mesh, camera);
      renderer.setRenderTarget(before); renderer.setClearColor(kept, alpha); renderer.autoClear = auto;
      uniforms.uMask.value = target.texture; uniforms.uDepth.value = target.depthTexture; uniforms.uTexel.value.set(1 / w, 1 / h);
      uniforms.uRadius.value = Math.max(1, line.width * h); uniforms.uStrength.value = line.strength; uniforms.uColor.value.setRGB(line.colour[0], line.colour[1], line.colour[2], THREE.SRGBColorSpace);
      uniforms.uNear.value = camera.near; uniforms.uFar.value = camera.far; uniforms.uPersp.value = camera.isPerspectiveCamera ? 1 : 0; uniforms.uJump.value = unit * .035;
    },
    dispose() { target?.depthTexture?.dispose(); target?.dispose(); object.geometry.dispose(); object.material.dispose(); },
  };
}
