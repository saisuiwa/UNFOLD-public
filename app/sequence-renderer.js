import * as THREE from './vendor/three.module.min.js';
import {smooth,vertexShader,particleFragment} from './motion.js?v=29';
import {presetNames,presetTargets} from './shape-presets.js';
import {applyTiles,tilesAcross} from './tile-size.js';
import {particleParts} from './model-layout.js';
import {SceneBlur} from './effects.js';
import {cleanRenderLook,applyRenderLook,syncPerspective} from './render-look.js';
import {cleanShot,rotationAt,blendCameraMove} from './shot-motion.js';
import {concealAmount,swapCurve,mixFx} from './fx-mix.js';
import {camLife,camValues,lifeProgress,legacyKenBurns,mixCam} from './camera-work.js';
import {createImageMethodLayer,imageCamera} from './image-method-layer.js';
import {imageTarget} from './image-method-target.js';
import {isImageMethodKey,imageFrame,smoothImage} from './image-method-format.js';
import {BUILTIN_IDS as METHOD_IDS} from './method-registry.js';
import {assembleVertex} from './custom-method.js';
import {importModel} from './model-import.js?v=12';
import {isColourShape,fillsFrame,loadColourShape} from './colour-shapes.js?v=1';
import {compileSequenceTiming,evaluateSequenceFrame,sequenceCurves as curves,warpTime} from './sequence-core.js';
import {StudioError} from './studio/model.js';
import {checkAbort} from './studio/file.js';
import {layerFrame} from './studio/image-layer.js';
const BUILTIN_IDS=Object.fromEntries(['sphere','torus','helix','mass','cube','heart','star','saturn','mobius','diamond','flower'].map((k,i)=>[k,i]));
const FX_KEYS=['blur','bloom','neon','glass','chroma','glitch','scan','grain','vignette','bokeh'];
const imageTransition=tr=>tr&&(isImageMethodKey(tr.method)||isImageMethodKey(tr.method2));
const fragmentShader = `
uniform sampler2D uImage;
uniform sampler2D uImageB;
uniform float uSwap;
varying vec2 vUv;
varying vec3 vPosition;
varying float vForm;
vec4 texAt(vec2 uv){return mix(texture2D(uImage,uv),texture2D(uImageB,uv),uSwap);}
${particleFragment}
void main(){
  vec4 c=particleLook(texAt(vUv));
  if(c.a<0.01)discard;
  vec3 normal=normalize(cross(dFdx(vPosition),dFdy(vPosition)));
  c=glassLook(c,normal);
  float light=surfaceLight(normal);
  c.rgb*=mix(1.,light,vForm);
  gl_FragColor=surfaceAlpha(c);
  #include <colorspace_fragment>
}`;
const defaults = {
  lyricDocument: null, lyricMotion: {bpm:98,phase:0},
  renderLook: cleanRenderLook(),
  slides: [],              // {id, name, img} or {id, name, lyric:{text,k,img,seed}}; canvas/texture are made on demand
  transitions: [],         // {method, method2, shape, text, font, beats}
  lyrics: [],              // [{s, e?, t, k?}] timed lyric lines for the MV builder
  lyricOpts: { style: 'sticker', font: 'gothic', transBeats: 4, snap: true },
  audioBuffer: null, audioOwner: null, audioName: '', withAudio: true, phase: 0, link: false, selection: null,
  fx: { blur: 0, bloom: 0, neon: 0, neonColor: '', glass: 0, chroma: 0, glitch: 0, scan: 0, grain: 0, vignette: 0, bokeh: 0 },
  cam: { persp: 0, kenburns: 0, handheld: 0, tilt: 0, orbit: 0 },
  bpm: 98, holdBeats: 4, offset: 0, bg: '#111718', push: 0.25, pulse: 0.5, strength: 0.8, pullback: 1, formPullback: 1, chaosLength: 0, detail: 1, modelColor: 0, tiles: .5, depth: 1, fill: true, silSens: 0.5,
  playing: false, t: 0, audio: null, recording: false,
};
export function drawSequenceVisual(ctx,sec) {
 const {seq,imageInputs,imageLayers,renderer,mesh,backdrop,camera,scene,sceneBlur,geoCache,pending,savedModels,variants,safety,shotQuat,shotAxis,planeW,planeH,backgroundSeconds,locate,shapeKey,safeEnsure,renderAt,setMaterialTextures,slideTexture,slideCanvas,isFlatShape,ownCamera,kenBurns,perspective,beatSec,imageLayerAt}=ctx;
  imageInputs.length=0;
  if (!seq.slides.length) { imageLayers.forEach(l=>l.reset());renderer.setClearColor(seq.bg, 1); renderer.clear();return; }
  sec=Math.min(sec,backgroundSeconds());
  const L = locate(sec);
  const u = mesh.material.uniforms;
  let c = { distort: 0, form: 0, conceal: 0, swap: 0, spin: 0 };
  let tr = null;
  if (L.tr >= 0) { tr = seq.transitions[L.tr]; c = curves(L.u, seq.chaosLength); }
  const uw = warpTime(L.u, seq.chaosLength);   // the solid's part of the change (picture swap, look) runs on this later time
  const imageCode=imageTransition(tr);if(tr?.shape === 'none')c.form=0;
  // no solid + "pass through": one gesture — A breaks away, B flies in from the other side (no pause in the middle)
  const flow = imageCode?'return':tr?.shape === 'none' ? (tr.flow ?? 'through') : '';
  const through = flow === 'through', reveal = flow === 'reveal';
  if (reveal) {   // only the current picture breaks away; the next one waits untouched underneath
    c.distort = smooth(0, .9, L.u);
    c.conceal = 0; c.swap = 0;
  }
  if (through) {
    const u2 = L.u;
    c.distort = smooth(0, .5, u2) * (1 - smooth(.5, 1, u2));
    c.conceal = smooth(.03, .2, u2) * (1 - smooth(.8, .97, u2));
    c.swap = u2 < .5 ? 0 : 1;
  }
  if (tr && tr.shape !== 'none') c.swap = swapCurve(tr, uw, c.swap);   // a ◆ can keep the solid the first picture (lateSwap)
  const key = tr ? shapeKey(tr, L.tr) : 'sphere';
  let geo = geoCache.get(key);
  if (!geo) {   // still being built: show the sphere grid meanwhile
    geo = geoCache.get('sphere');
    if (tr && !pending.has(key)) { pending.add(key); safeEnsure(tr, L.tr).finally(() => { pending.delete(key); if (!seq.playing) renderAt(seq.t); }); }
  }
  if (mesh.geometry !== geo) mesh.geometry = geo;
  setMaterialTextures(seq.slides[L.i], tr ? seq.slides[L.i + 1] : null);
  const isText = isFlatShape(tr);
  const isPreset = tr && (presetNames.includes(tr.shape) || savedModels.has(tr.shape) || isColourShape(tr.shape) || isText);
  u.uTime.value = sec;
  u.uThrough.value = through && L.u >= .5 ? 1 : 0;
  u.uFade.value = through ? smooth(0, .045, Math.abs(L.u - .5)) : reveal ? 1 - smooth(.72, .98, L.u) : 1;
  if (reveal) u.uDraw.value = 1 - smooth(.05, .85, L.u);
  backdrop.visible = reveal;
  if (reveal) backdrop.material.map = slideTexture(seq.slides[L.i + 1]);
  u.uDraw.value = !tr ? 1 : L.u < .5 ? 1 - smooth(.06, .44, L.u) : smooth(.56, .94, L.u);
  u.uDistort.value = c.distort; u.uForm.value = c.form; if (u.uModelColor) u.uModelColor.value = seq.modelColor ?? 0; u.uStrength.value = seq.strength; u.uDepth.value = seq.depth;
  // custom methods have their own shader: swap it in (uniforms are shared, so `u` stays valid)
  const firstJS=isImageMethodKey(tr?.method),secondJS=isImageMethodKey(tr?.method2);
  const pick = imageCode?variants.pick(firstJS?(secondJS?'':tr?.method2):tr?.method):variants.pick(tr ? tr.method : '', tr?.method2 || '');
  if(imageCode&&firstJS&&(!tr.method2||secondJS))u.uDistort.value=0;
  if (mesh.material !== pick.material) mesh.material = pick.material;
  safety.beforeDraw(pick.used);
  u.uSeed.value = 28 + (L.tr >= 0 ? L.tr * 37 : 0); u.uMethod.value = pick.uMethod;
  u.uMethod2.value = pick.uMethod2; u.uMethodMix.value = imageCode?0:tr?.method2 ? smooth(.30, .62, L.u) : 0;
  u.uShape.value = tr && BUILTIN_IDS[tr.shape] !== undefined ? BUILTIN_IDS[tr.shape] : 0;
  u.uPreset.value = isPreset ? 1 : 0; u.uProject.value = isText ? 1 : 0; u.uConceal.value = imageCode?0:concealAmount(tr, c.conceal); u.uSwap.value = c.swap;
  // full turn ends at identity; flat words only wobble, and without a solid there is nothing to turn
  const turn = tr?.shape === 'none' ? 0 : isText ? 0.18 * Math.sin(c.spin * Math.PI * 2) : c.spin * Math.PI * 2;
  const shot=cleanShot(tr?.shot);
  const cm = seq.cam,orientation=imageCode&&tr.shape==='none'?c.distort:c.form;
  mesh.rotation.set((-.16 + (tr?.viewX || 0) - cm.orbit * .45) * c.form,
    (isPreset && !isText ? .2 : .35) * c.form + turn + (tr?.viewY || 0) * c.form + (tr ? cm.orbit * 2.2 * (L.u - .5) * c.form : 0), 0);
  const spin=tr&&(tr.shape!=='none'||imageCode)?rotationAt(shot.rotation,L.u,'sequence'):null;
  if(spin){mesh.rotation.set((tr.viewX||0)*orientation,(tr.viewY||0)*orientation,0);mesh.quaternion.premultiply(shotQuat.setFromAxisAngle(shotAxis.fromArray(spin.axis),spin.angle));}
  // camera: push-in with the shape, a pulse on every beat while it is 3D
  const bp = (sec + seq.offset - seq.phase) / beatSec(), frac = bp - Math.floor(bp);
  const beatKick = Math.exp(-frac * 7) * seq.pulse * (c.distort > 0.02 ? 1 : 0);
  // flat images fill the frame edge to edge (or sit at 1× when "画面いっぱい" is off);
  // while torn up / 3D the camera goes to the zoom the two "引き" sliders ask for: 0% = frame-filling, 100% = 1×
  const fullZoom = Math.max((camera.right - camera.left) / planeW, (camera.top - camera.bottom) / planeH);
  const flatZoom = seq.fill ? fullZoom : 1;
  const pull = seq.pullback * (1 - c.form) + (tr && fillsFrame(tr.shape) ? 0 : seq.formPullback) * c.form;   // a scene that fills the frame is not pulled back   // hands over to the 3D setting as the solid forms
  const loose = reveal ? 0 : Math.max(c.distort, c.form);   // a reveal keeps the frame still so the next picture sits exactly in place
  camera.zoom = flatZoom + (1 + (fullZoom - 1) * (1 - pull) - flatZoom) * loose + seq.push * c.form + 0.06 * beatKick;
  // camera work: slow Ken Burns drift per picture (or a picture's own camera), handheld wobble, a lazy tilt
  const shotBaseZoom=camera.zoom;
  const own = ownCamera(L, sec, tr);
  if (own) {   // a picture has its own camera: it moves the frame as a whole, so it eases off while a solid is on screen (a big zoom would cut the solid off)
    camera.zoom *= 1 + (own.zoom - 1) * (1 - c.form);
    camera.position.x = own.x * planeW + cm.handheld * .05 * (Math.sin(sec * 1.7) + .5 * Math.sin(sec * 2.9 + 1));
    camera.position.y = own.y * planeH + cm.handheld * .04 * (Math.sin(sec * 1.3 + .7) + .5 * Math.sin(sec * 3.1));
    camera.rotation.z = own.roll * (1 - c.form) * Math.PI / 180 + cm.handheld * .012 * Math.sin(sec * 1.1) + cm.tilt * .1 * Math.sin(sec * .45);
  } else {
    const kb = kenBurns(L, sec);
    camera.zoom *= kb.zoom;
    camera.position.x = kb.x + cm.handheld * .05 * (Math.sin(sec * 1.7) + .5 * Math.sin(sec * 2.9 + 1));
    camera.position.y = cm.handheld * .04 * (Math.sin(sec * 1.3 + .7) + .5 * Math.sin(sec * 3.1));
    camera.rotation.z = cm.handheld * .012 * Math.sin(sec * 1.1) + cm.tilt * .1 * Math.sin(sec * .45);
  }
  if(tr){const move=blendCameraMove({x:camera.position.x,y:camera.position.y,zoom:camera.zoom,roll:camera.rotation.z},shot.camera,L.u,{width:planeW,height:planeH,zoom:shotBaseZoom});
    camera.zoom=move.zoom;camera.position.x=move.x;camera.position.y=move.y;camera.rotation.z=move.roll;}
  camera.updateProjectionMatrix();
  const view = perspective(reveal);
  renderer.setClearColor(seq.bg, 1);
  // effects: the global look, each picture's own look (flowing from one to the next across a ◆), then this ◆'s own settings while it is breaking up / solid
  const env = tr ? Math.max(c.distort, c.form) : 0;
  const fx = mixFx(FX_KEYS, { global: seq.fx, from: seq.slides[L.i].fx, to: tr ? (seq.slides[L.i + 1]?.fx ?? {}) : null, trFx: tr?.fx, u: tr && tr.shape !== 'none' ? uw : L.u, env, late: tr?.lateSwap === true && tr.shape !== 'none' });
  applyRenderLook(u, seq.renderLook);
  u.uGlass.value = imageCode?0:fx.glass;
  sceneBlur.render(scene, view, imageCode?0:fx.blur, imageCode?0:fx.glitch, imageCode?0:fx.chroma, sec, imageCode?{}:{ ...fx, neonColor: seq.fx.neonColor });
  if(imageCode){
   const duration=tr.beats*beatSec(),f=imageFrame(L.u*duration,duration,seq.strength,{form:c.form}),mix=tr.method2?smooth(.30,.62,L.u):0,fade=smoothImage(L.u/.025)*smoothImage((1-L.u)/.025),keys=[tr.method,tr.method2];
   for(let i=0;i<2;i++){if(isImageMethodKey(keys[i])){const input={target:tr.shape!=='none'?imageTarget(geo,{shape:tr.shape,preset:!!isPreset,project:!!isText}):null,id:keys[i],imageA:slideCanvas(seq.slides[L.i]),imageB:slideCanvas(seq.slides[L.i+1]),size:{width:planeW,height:planeH},frame:{...f,imageMix:tr.shape!=='none'?c.swap:f.imageMix,depth:seq.depth,seed:u.uSeed.value,width:renderer.domElement.width,height:renderer.domElement.height,bg:seq.bg,camera:imageCamera(view),rootQuaternion:mesh.quaternion.toArray()}};imageInputs[i]=input;const weight=i===0?(secondJS?1:1-mix):mix;if(fade*weight>0&&(seq.strength>0||c.form>0))imageLayerAt(i).draw(input,fade*weight)}else imageLayers[i]?.reset()}
  }else{
   // holding a picture: if the change after it is image code, its worker is started now (imageLayer.warm), so a quick change is not spent waiting for it
   const next=L.tr<0?seq.transitions[L.i]:null,nextKeys=next&&next.shape==='none'&&seq.slides[L.i+1]?[next.method,next.method2]:[];
   for(let i=0;i<2;i++){
    if(isImageMethodKey(nextKeys[i]))imageLayerAt(i).warm({target:null,id:nextKeys[i],imageA:slideCanvas(seq.slides[L.i]),imageB:slideCanvas(seq.slides[L.i+1]),size:{width:planeW,height:planeH}});
    else imageLayers[i]?.reset();
   }
  }
  safety.afterDraw();
  return L;
}
export function createSequenceRenderer({assets,resolveMethod,resolveModel}={}){
 let seq,dead=false,renderer,sceneBlur,scene,camera,perspCam,mesh,backdrop,variants;const geoCache=new Map(),savedModels=new Map(),pending=new Set(),imageLayers=[],imageInputs=[],images=[],materials=new Map();
 const CANVAS_W=1920,CANVAS_H=1080,planeW=5.25,planeH=5.25*9/16,shotAxis=new THREE.Vector3(),shotQuat=new THREE.Quaternion();
 const safety={beforeDraw(){},afterDraw(){}},beatSec=()=>60/seq.bpm,backgroundSeconds=()=>compileSequenceTiming(seq).durationUs/1e6;
 const locate=sec=>{const f=evaluateSequenceFrame(seq,Math.round(sec*1e6));return {i:f.slideIndex,tr:f.transitionIndex,u:f.progress,beat:sec/beatSec()};};
 const isFlatShape=()=>false,shapeKey=tr=>tr.shape==='none'?'sphere':tr.shape;
 const method=id=>resolveMethod?.(id)||seq.methods?.find(m=>m.id===id);
 const imageLayerAt=i=>imageLayers[i]??=createImageMethodLayer(renderer,{resolveMethod:method,resolveFontBytes:async key=>{const id=seq.fontAssets?.[key];if(id){const b=await assets.get(id);if(!b)throw new StudioError('MISSING_ASSET');return b.arrayBuffer();}if(/^(file:|local:)/.test(key||''))throw new StudioError('MISSING_ASSET');const r=await fetch(new URL('./vendor/motion-fonts/'+(key||'gothic')+'.ttf',import.meta.url));if(!r.ok)throw new StudioError('MISSING_ASSET');return r.arrayBuffer();}});
 function fitCanvas(img,bg){const c=document.createElement('canvas');c.width=CANVAS_W;c.height=CANVAS_H;const x=c.getContext('2d');x.fillStyle=bg;x.fillRect(0,0,c.width,c.height);const ratio=(seq.fill?Math.max:Math.min)(c.width/img.width,c.height/img.height);x.drawImage(img,(c.width-img.width*ratio)/2,(c.height-img.height*ratio)/2,img.width*ratio,img.height*ratio);return c;}
 function makeTexture(c){const t=new THREE.CanvasTexture(c);t.minFilter=t.magFilter=THREE.LinearFilter;t.generateMipmaps=false;t.colorSpace=THREE.SRGBColorSpace;return t;}
 const slideCanvas=s=>s.canvas??=fitCanvas(s.img,seq.bg),slideTexture=s=>s.texture??=makeTexture(slideCanvas(s));
 function setMaterialTextures(a,b){const u=mesh.material.uniforms;u.uImage.value=slideTexture(a);u.uImageB.value=slideTexture(b||a);}
 function layoutTimes(){const c=compileSequenceTiming(seq);return {slides:c.segments.filter(s=>s.tr<0).map(s=>({start:s.startUs/1e6,end:s.endUs/1e6})),transitions:c.segments.filter(s=>s.tr>=0).map(s=>({start:s.startUs/1e6,end:s.endUs/1e6})),total:c.durationUs/1e6};}
function gridGeometry(targets) {
  const positions = [], uvs = [], cells = [], parts = [];
  const tiles = 16, sub = 5, w = planeW, h = planeH;
  for (let cy = 0; cy < tiles; cy++) for (let cx = 0; cx < tiles; cx++) for (let sy = 0; sy < sub; sy++) for (let sx = 0; sx < sub; sx++) {
    const u = (cx + sx / sub) / tiles, v = (cy + sy / sub) / tiles, step = 1 / (tiles * sub);
    for (const [du, dv] of [[0, 0], [1, 0], [0, 1], [1, 0], [1, 1], [0, 1]]) {
      const a = u + du * step, b = v + dv * step;
      positions.push((a - .5) * w, (b - .5) * h, 0); uvs.push(a, b); cells.push((cx + .5) / tiles, (cy + .5) / tiles);
      parts.push(u + step / 2, v + step / 2, du, dv);   // every small quad is one particle
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute('cell', new THREE.Float32BufferAttribute(cells, 2));
  g.setAttribute('part', new THREE.Float32BufferAttribute(parts, 4));
  g.setAttribute('targetPosition', new THREE.BufferAttribute(targets, 3));
  applyTiles(THREE, g, tilesAcross(seq.tiles));
  return g;
}
function customGeometry(data) {
  const g = new THREE.BufferGeometry(), positions = new Float32Array(data.target.length);
  for (let i = 0; i < data.uv.length / 2; i++) {
    positions[i * 3] = (data.uv[i * 2] - .5) * planeW;
    positions[i * 3 + 1] = (data.uv[i * 2 + 1] - .5) * planeH;
  }
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(data.uv, 2));
  g.setAttribute('cell', new THREE.BufferAttribute(data.cell, 2));
  g.setAttribute('part', new THREE.BufferAttribute(particleParts(data, seq.detail), 4));
  g.setAttribute('targetPosition', new THREE.BufferAttribute(data.target, 3));
  if (data.color) g.setAttribute('modelColor', new THREE.BufferAttribute(data.color, 4));   // a GLB's own colours (mixed in by seq.modelColor)
  g.userData.layout = data;
  applyTiles(THREE, g, tilesAcross(seq.tiles));
  return g;
}
function kenBurns(L, sec) {
  const k = seq.cam.kenburns;
  if (!k) return { zoom: 1, x: 0 };
  const lay = layoutTimes();
  const at = (i, p) => legacyKenBurns(i, p, k);
  const prog = i => { const s = lay.slides[i]; return s && s.end > s.start ? Math.min(1, Math.max(0, (sec - s.start) / (s.end - s.start))) : 1; };
  if (L.tr < 0) return at(L.i, prog(L.i));
  const a = at(L.i, 1), b = at(L.i + 1, 0), w = smooth(0, 1, L.u);
  return { zoom: a.zoom + (b.zoom - a.zoom) * w, x: a.x + (b.x - a.x) * w };
}
// A picture's own camera (see camera-work.js). Null when neither the picture shown nor the next one has one: then the global Ken Burns above rules,
// exactly as before. The move runs from the time the picture arrives to when it starts to break up, and hands over to the next picture's camera
// when the pictures swap (a punch-in right then is how a "zoom-out reveal" starts).
function ownCamera(L, sec, tr) {
  const a = seq.slides[L.i], b = tr ? seq.slides[L.i + 1] : null;
  if (!a?.cam && !b?.cam) return null;
  const lay = layoutTimes(), n = seq.slides.length;
  const k = seq.cam.kenburns;
  const at = (i, s) => {
    if (s.cam) { const life = camLife(i, n, lay, seq.transitions); return camValues(s.cam, lifeProgress(sec, life, s.cam)); }
    const slide = lay.slides[i], p = tr ? (i === L.i ? 1 : 0) : (slide && slide.end > slide.start ? Math.min(1, Math.max(0, (sec - slide.start) / (slide.end - slide.start))) : 1);
    const kb = k ? legacyKenBurns(i, p, k) : { zoom: 1, x: 0 };
    return { zoom: kb.zoom, x: kb.x / planeW, y: 0, roll: 0 };
  };
  const va = at(L.i, a);
  if (!tr) return va;
  const late = tr.lateSwap === true && tr.shape !== 'none';
  const w = late ? smooth(.72, .80, L.u) : smooth(.35, .65, L.u);   // the pictures' own swap timing (pictureWeight)
  return mixCam(va, at(L.i + 1, b), w);
}
// "遠近感": a perspective camera placed so the picture plane (z = 0) frames exactly like the flat camera
function perspective(reveal) {
  const k = seq.renderLook.enabled ? seq.renderLook.perspective : seq.cam.persp;
  backdrop.scale.set(1, 1, 1);
  if (!k) return camera;
  syncPerspective(camera, perspCam, k);
  const d = perspCam.position.z;
  if (reveal) { const sc = (d + 4) / d; backdrop.scale.set(sc, sc, 1); }   // the still picture sits behind: scale it back to full frame
  return perspCam;
}

 async function safeEnsure(tr){const key=shapeKey(tr);if(geoCache.has(key))return;if(seq.modelAssets?.[tr.shape]){const blob=await assets.get(seq.modelAssets[tr.shape]);if(!blob)throw new StudioError('MISSING_ASSET');const model=await importModel(await blob.arrayBuffer(),{ordered:tr.orderedPicture===true,colors:true});if(dead)throw new StudioError('LAYER_DISPOSED');geoCache.set(key,customGeometry(model));savedModels.set(tr.shape,true);}else if(isColourShape(tr.shape)){const model=await loadColourShape(tr.shape,{ordered:tr.orderedPicture===true});if(dead)throw new StudioError('LAYER_DISPOSED');geoCache.set(key,customGeometry(model));}else if(key in BUILTIN_IDS||presetNames.includes(key))geoCache.set(key,gridGeometry(presetTargets(key)));else throw new StudioError('UNSUPPORTED_SHAPE');}
 const context=()=>({seq,imageInputs,imageLayers,renderer,mesh,backdrop,camera,scene,sceneBlur,geoCache,pending,savedModels,variants,safety,shotQuat,shotAxis,planeW,planeH,backgroundSeconds,locate,shapeKey,safeEnsure,renderAt,setMaterialTextures,slideTexture,slideCanvas,isFlatShape,ownCamera,kenBurns,perspective,beatSec,imageLayerAt});
 const renderAt=sec=>drawSequenceVisual(context(),sec);
 return {async prepare(snapshot,signal){const state=snapshot.state||snapshot;seq={...structuredClone(defaults),...structuredClone(state.settings||{}),slides:structuredClone(state.slides||[]),transitions:structuredClone(state.transitions||[]),methods:structuredClone(state.methods||[]),modelAssets:state.modelAssets||{},fontAssets:state.fontAssets||{}};seq.cam={...defaults.cam,...seq.cam};seq.fx={...defaults.fx,...seq.fx};seq.renderLook=cleanRenderLook(seq.renderLook);
 for(const id of snapshot.dependencies||[]){checkAbort(signal);if(!await assets.get(id))throw new StudioError('MISSING_ASSET');}
 for(const slide of seq.slides){const id=slide.img||slide.lyric?.img;if(!id)throw new StudioError('MISSING_ASSET');const b=await assets.get(id);if(!b)throw new StudioError('MISSING_ASSET');const im=await createImageBitmap(b);if(dead||signal?.aborted){im.close();checkAbort(signal);throw new StudioError('LAYER_DISPOSED');}images.push(im);slide.img=im;}
 checkAbort(signal);if(dead)throw new StudioError('LAYER_DISPOSED');renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.outputColorSpace=THREE.SRGBColorSpace;sceneBlur=new SceneBlur(renderer);scene=new THREE.Scene();camera=new THREE.OrthographicCamera(-4.8,4.8,2.7,-2.7,.1,100);camera.position.z=10;perspCam=new THREE.PerspectiveCamera(30,16/9,.1,200);const blank=makeTexture(document.createElement('canvas'));
  const uniforms = { uImage: { value: blank }, uImageB: { value: blank }, uSwap: { value: 0 }, uSize: { value: new THREE.Vector2(planeW, planeH) },
    uDistort: { value: 0 }, uForm: { value: 0 }, uStrength: { value: .8 }, uDepth: { value: 1 }, uSeed: { value: 28 }, uMethod: { value: 0 },
    uMethod2: { value: 0 }, uMethodMix: { value: 0 }, uProject: { value: 0 }, uTime: { value: 0 }, uDraw: { value: 1 }, uThrough: { value: 0 }, uFade: { value: 1 }, uGlass: { value: 0 }, uShape: { value: 0 }, uPreset: { value: 0 }, uConceal: { value: 0 }, uModelColor: { value: 0 } };

 function material(a='',b=''){const key=a+'|'+b;if(materials.has(key))return materials.get(key);const codes=[a,b].map(id=>{if(!id||Object.hasOwn(METHOD_IDS,id)||isImageMethodKey(id))return '';const record=method(id);if(!record||record.status!=='ok'||!(record.vertex||record.source))throw new StudioError('UNTRUSTED_CODE');return record.vertex||record.source;});const m=new THREE.ShaderMaterial({defaultAttributeValues:{color:[1,1,1],uv:[0,0],uv1:[0,0],tcell:[0,0,0],modelColor:[0,0,0,0]},uniforms,vertexShader:assembleVertex(vertexShader,{a:codes[0],b:codes[1]}).source,fragmentShader,side:THREE.DoubleSide,transparent:true});materials.set(key,m);return m;}
 variants={pick(a='',b=''){return {material:material(a,b),uMethod:METHOD_IDS[a]??(a&&!isImageMethodKey(a)?100:0),uMethod2:METHOD_IDS[b]??(b&&!isImageMethodKey(b)?101:0),used:[]};}};
 geoCache.set('sphere',gridGeometry(presetTargets('sphere')));for(const tr of seq.transitions){await safeEnsure(tr);checkAbort(signal);if(dead)throw new StudioError('LAYER_DISPOSED');}mesh=new THREE.Mesh(geoCache.get('sphere'),material());mesh.frustumCulled=false;scene.add(mesh);backdrop=new THREE.Mesh(new THREE.PlaneGeometry(planeW,planeH),new THREE.MeshBasicMaterial({map:blank,depthWrite:false}));backdrop.position.z=-4;backdrop.renderOrder=-1;backdrop.visible=false;scene.add(backdrop);
 },async render({timeUs,width,height,signal}){checkAbort(signal);if(dead)throw new StudioError('LAYER_DISPOSED');renderer.setSize(width,height,false);renderAt(timeUs/1e6);for(let i=0;i<imageInputs.length;i++)if(imageInputs[i])await imageLayerAt(i).prepare(imageInputs[i]);checkAbort(signal);renderAt(timeUs/1e6);const bitmap=await createImageBitmap(renderer.domElement);if(dead||signal?.aborted){bitmap.close();checkAbort(signal);throw new StudioError('LAYER_DISPOSED');}return layerFrame(bitmap);},dispose(){if(dead)return;dead=true;imageLayers.forEach(x=>x.dispose());images.forEach(x=>x.close());seq?.slides.forEach(s=>s.texture?.dispose());geoCache.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());backdrop?.geometry.dispose();backdrop?.material.map?.dispose();backdrop?.material.dispose();sceneBlur?.dispose?.();renderer?.dispose();renderer?.forceContextLoss();}};
}
