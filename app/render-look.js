import * as THREE from './vendor/three.module.min.js';

export const DEFAULT_RENDER_LOOK = Object.freeze({ enabled: false, perspective: .6, lighting: true, azimuth: -25, elevation: 30, shade: .6, alpha: 'original' });
const bounded = (v, lo, hi, fallback) => typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
export function cleanRenderLook(input = {}) {
  const x = input && typeof input === 'object' ? input : {};
  return { enabled: x.enabled === true, perspective: bounded(x.perspective, 0, 1, .6), lighting: x.lighting !== false,
    azimuth: bounded(x.azimuth, -180, 180, -25), elevation: bounded(x.elevation, -80, 80, 30), shade: bounded(x.shade, 0, 1, .6), alpha: x.alpha === 'dither' ? 'dither' : 'original' };
}
export function addRenderUniforms(uniforms) {
  uniforms.uLookLight ??= { value: 0 }; uniforms.uLookAlpha ??= { value: 0 };
  uniforms.uLookShade ??= { value: .6 }; uniforms.uLookDirection ??= { value: new THREE.Vector3(-.4, .65, 1).normalize() };
  return uniforms;
}
export function applyRenderLook(uniforms, options) {
  const x = cleanRenderLook(options), u = addRenderUniforms(uniforms);
  u.uLookLight.value = x.enabled && x.lighting ? 1 : 0;
  u.uLookAlpha.value = x.enabled && x.alpha === 'dither' ? 1 : 0;
  u.uLookShade.value = x.shade;
  const az = x.azimuth * Math.PI / 180, el = x.elevation * Math.PI / 180;
  u.uLookDirection.value.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
}
// Same plane-matching camera model as the sequence page, shared with single-image and editor.
export function syncPerspective(camera, perspective, strength) {
  const k = bounded(strength, 0, 1, 0);
  if (!k) return camera;
  const fov = 10 + k * 30, h = (camera.top - camera.bottom) / camera.zoom;
  const d = h / 2 / Math.tan(fov * Math.PI / 360);
  perspective.fov = fov; perspective.aspect = (camera.right - camera.left) / (camera.top - camera.bottom);
  perspective.position.set(camera.position.x, camera.position.y, d); perspective.rotation.set(0, 0, camera.rotation.z);
  perspective.near = Math.max(.05, d * .02); perspective.far = d + 60; perspective.updateProjectionMatrix();
  return perspective;
}

// No real-time input: the experimental coverage pattern is reproducible in exports.
// The seed is constant across a tile/particle and independent between layers.
export const renderLookFragment = `
uniform float uLookLight,uLookAlpha,uLookShade;
uniform vec3 uLookDirection;
varying float vLookSeed,vLookAmount;
float surfaceLight(vec3 normal){
  if(uLookLight<.5)return .68+.32*abs(dot(normal,normalize(vec3(-.4,.65,1.))));
  return 1.-uLookShade+uLookShade*abs(dot(normal,uLookDirection));
}
vec4 surfaceAlpha(vec4 c){
  if(uLookAlpha>.5&&vLookAmount>.001){
    float r=fract(sin(dot(floor(gl_FragCoord.xy),vec2(12.9898,78.233))+vLookSeed*437.23)*43758.5453);
    if(c.a<=r)discard;
    c.a=1.;
  }
  return c;
}`;
