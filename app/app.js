import {attachWorkshopLink} from './workshop-link.js';
import {imageTarget} from './image-method-target.js';
import {encodeCanvasVideo} from './frame-video.js';
import {createImageMethodLayer,imageCamera} from './image-method-layer.js';
import {isImageMethodKey,imageFrame,smoothImage} from './image-method-format.js';
import { cleanShot, rotationAt, blendCameraMove } from './shot-motion.js?v=26';
import { createShotControls } from './shot-motion-controls.js?v=3';
import { cleanRenderLook, applyRenderLook, syncPerspective } from './render-look.js?v=2';
import { createRenderControls } from './render-look-controls.js?v=2';
import * as THREE from './vendor/three.module.min.js';
import {motionAt,exportRange,chaosTime,smooth,vertexShader,fragmentShader} from './motion.js?v=31';
import {presetNames,presetTargets} from './shape-presets.js?v=6';
import {importModel} from './model-import.js?v=13';
import {listModels,getModel,saveModel,deleteModel,updateModel} from './model-library.js?v=4';
import {COLOUR_SHAPES,isColourShape,fillsFrame,loadColourShape,paintColourLabel} from './colour-shapes.js?v=2';
import {ALL,UNGROUPED,groupOf,groupSelect,inGroup,loadActive,renderTabs,saveActive,validActive,wantsTabs} from './model-groups.js?v=1';
import {modelThumb,fillMissingThumbs} from './model-thumb.js?v=3';
import {particleParts} from './model-layout.js?v=14';
import {createTextShape,validateText} from './text-shape.js?v=11';
import {FONTS,createMaskTextShape,createSilhouetteShape,validateMaskText} from './mask-shape.js?v=7';
import {effectsAt,SceneBlur} from './effects.js?v=33';
import {BUILTIN_KEYS,getCustom,listCustom,onRegistryChange,registerCustom,resolveKey,setCustomStatus,unregisterCustom} from './method-registry.js';
import {createPersistence,openStore} from './method-library.js';
import {registerBundledImageMethods} from './bundled-image-methods.js';
import {createImageMethodEditor} from './image-method-editor.js';
import {createSafety} from './method-safety.js';
import {createTrial} from './method-trial.js';
import {createEnabler} from './method-verify.js';
import {downloadMethodFile,exportMethod,importMethodFile,importMethodText,pickMethodFile} from './method-transfer.js';
import {openMethodMenu} from './method-menu.js';
import {grainSingleNote,tileSingleNote} from './slider-notes.js?v=2';
import {applyTiles,tilesAcross} from './tile-size.js?v=1';
import {methodButtons,syncMethodTiles} from './method-tiles.js';
import {compileUserMethod,createVariants} from './custom-method.js';
let imageLayer,imageInput;
function getImageLayer(){return imageLayer??=createImageMethodLayer(renderer,{onReady:()=>{if(!state.recording)render()},onError:e=>notice(e.message)})}
async function prepareImageFrame(){render();if(imageInput)await getImageLayer().prepare(imageInput);render()}
const MAX_SAVED_MODELS=100;   // GLBs kept in this browser (shared with the sequence page)
let activeGroup=loadActive('unfold-glb-tab');   // the GLB tab in use (the same one the sequence page remembers)
const customShapes=new Map(),colourShapes=new Map(),savedModels=new Map();let customSerial=0,importing=false;
const $=id=>document.getElementById(id);
const loadShot=()=>{try{return cleanShot(JSON.parse(localStorage.getItem('unfold-single-shot')||'null'))}catch{return cleanShot()}};
const state={imageSolid:true,shot:loadShot(),renderLook:cleanRenderLook(),blur:0,push:0,shake:0,chroma:0,glitch:0,bloom:0,neon:0,glass:0,scan:0,grain:0,vignette:0,bokeh:0,method:'crumple',shape:'sphere',strength:.75,pullback:1,formPullback:1,detail:1,modelColor:1,chaosLength:.5,tiles:.5,depth:1,seed:28,duration:10,t:.56,playing:false,loop:true,bg:'#111718',ratio:'16:9',recording:false,viewX:0,viewY:0,startMode:'solid',customStart:.56,mystery:true,previewRange:false};
const shapeIds={sphere:0,torus:1,helix:2,mass:3,cube:4,heart:5,star:6,saturn:7,mobius:8,diamond:9,flower:10};
let renderControls,shotControls;
const shotAxis=new THREE.Vector3(),shotQuat=new THREE.Quaternion();
const perspCam=new THREE.PerspectiveCamera();
let renderer,scene,camera,mesh,variants,methodEditor,methodPersistence,safety,methodEnabler,texture,sourceCanvas,noticeTimer,recordJob=null,lastVideoUrl=null,sceneBlur;
function notice(message){$('notice').textContent=message;$('notice').classList.add('show');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').classList.remove('show'),4500)}
function makeSample(){
 const c=document.createElement('canvas');c.width=1400;c.height=1000;const x=c.getContext('2d');
 x.fillStyle='#ebeada';x.fillRect(0,0,1400,1000);
 const colors=['#ff7145','#2855b9','#cce876','#eee9d6','#678cc5','#dc472c'];
 for(let j=0;j<5;j++)for(let i=0;i<7;i++){x.fillStyle=colors[(i+j*2)%colors.length];x.fillRect(i*200,j*200,200,200);}
 x.strokeStyle='#172719';x.lineWidth=2;for(let i=0;i<1400;i+=50){x.beginPath();x.moveTo(i,0);x.lineTo(i,1000);x.stroke()}for(let i=0;i<1000;i+=50){x.beginPath();x.moveTo(0,i);x.lineTo(1400,i);x.stroke()}
 x.fillStyle='#f1f0da';x.fillRect(100,185,1200,615);x.fillStyle='#183625';x.font='bold 265px sans-serif';x.textAlign='center';x.fillText('UNFOLD',700,545);x.font='28px monospace';x.fillText('COLOR / FORM / MOTION',700,645);x.font='20px monospace';x.fillText('01 — THE ORIGINAL STATE',700,737);
 return c;
}
function geometryFor(w,h){
 const custom=shapeOf(state.shape);
 if(custom){const data=custom.data,g=new THREE.BufferGeometry(),positions=new Float32Array(data.target.length);
  for(let i=0;i<data.uv.length/2;i++){positions[i*3]=(data.uv[i*2]-.5)*w;positions[i*3+1]=(data.uv[i*2+1]-.5)*h}
  g.setAttribute('position',new THREE.BufferAttribute(positions,3));g.setAttribute('uv',new THREE.BufferAttribute(data.uv,2));g.setAttribute('cell',new THREE.BufferAttribute(data.cell,2));g.setAttribute('part',new THREE.BufferAttribute(particleParts(data,state.detail),4));g.setAttribute('targetPosition',new THREE.BufferAttribute(data.target,3));if(data.color)g.setAttribute('modelColor',new THREE.BufferAttribute(data.color,4));if(data.modelUv)g.setAttribute('modelUv',new THREE.BufferAttribute(data.modelUv,3));if(data.normal)g.setAttribute('modelNormal',new THREE.BufferAttribute(data.normal,4));applyTiles(THREE,g,tilesAcross(state.tiles));return g;
 }

 const positions=[],uvs=[],cells=[],parts=[];const tiles=16,sub=5;
 for(let cy=0;cy<tiles;cy++)for(let cx=0;cx<tiles;cx++)for(let sy=0;sy<sub;sy++)for(let sx=0;sx<sub;sx++){
  const u=(cx+sx/sub)/tiles,v=(cy+sy/sub)/tiles,step=1/(tiles*sub);
  for(const [du,dv] of [[0,0],[1,0],[0,1],[1,0],[1,1],[0,1]]){const a=u+du*step,b=v+dv*step;positions.push((a-.5)*w,(b-.5)*h,0);uvs.push(a,b);cells.push((cx+.5)/tiles,(cy+.5)/tiles);parts.push(u+step/2,v+step/2,du,dv)}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setAttribute('cell',new THREE.Float32BufferAttribute(cells,2));g.setAttribute('part',new THREE.Float32BufferAttribute(parts,4));g.setAttribute('targetPosition',new THREE.BufferAttribute(presetTargets(state.shape),3));applyTiles(THREE,g,tilesAcross(state.tiles));return g;
}
function setSource(canvas,name){
 sourceCanvas=canvas;texture?.dispose();texture=new THREE.CanvasTexture(canvas);texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;texture.colorSpace=THREE.SRGBColorSpace;
 const aspect=canvas.width/canvas.height;const h=Math.min(3.65,5.25/aspect),w=h*aspect;
 if(mesh){mesh.geometry.dispose();mesh.material.dispose();scene.remove(mesh)}
 const uniforms={uImage:{value:texture},uSize:{value:new THREE.Vector2(w,h)},uDistort:{value:0},uForm:{value:0},uStrength:{value:.75},uDepth:{value:1},uSeed:{value:28},uMethod:{value:0},uMethod2:{value:0},uMethodMix:{value:0},uProject:{value:0},uTime:{value:0},uDraw:{value:1},uThrough:{value:0},uFade:{value:1},uGlass:{value:0},uShape:{value:0},uPreset:{value:0},uConceal:{value:0},uModelColor:{value:state.modelColor},uModelTex:{value:null}};
 mesh=new THREE.Mesh(geometryFor(w,h),(variants?.dispose(),variants=createVariants({renderer,vertexShader,fragmentShader,uniforms,onReady:()=>render()}),variants.base));mesh.frustumCulled=false;scene.add(mesh);
 const thumb=document.createElement('canvas');thumb.width=140;thumb.height=Math.round(140/aspect);thumb.getContext('2d').drawImage(canvas,0,0,thumb.width,thumb.height);$('thumbnail').src=thumb.toDataURL();$('image-name').textContent=name;
 $('image-size').textContent=`${canvas.width} × ${canvas.height} · クリックして変更`;render();
}
function resize(){
 if(state.recording||!renderer)return;
 const rect=$('stage').getBoundingClientRect();renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(rect.width,rect.height,false);setCamera(rect.width/rect.height);render();
}
function setCamera(aspect){const height=Math.max(5.4,6.8/aspect);camera.left=-height*aspect/2;camera.right=height*aspect/2;camera.top=height/2;camera.bottom=-height/2;camera.updateProjectionMatrix()}
function render(){
 if(!mesh)return;const imageCode=isImageMethodKey(state.method),m=motionAt(state.t,state.chaosLength),u=mesh.material.uniforms;if(imageCode&&!state.imageSolid)m.form=0;const pick=variants.pick(state.method);if(mesh.material!==pick.material)mesh.material=pick.material;safety?.beforeDraw(pick.used);u.uTime.value=state.t*state.duration;u.uDraw.value=state.t<.5?1-smooth(.1,.42,state.t):smooth(.58,.92,state.t);
 u.uDistort.value=imageCode?0:m.distort;u.uForm.value=m.form;u.uStrength.value=state.strength;u.uDepth.value=state.depth;u.uModelColor.value=state.modelColor;u.uModelTex.value=shapeOf(state.shape)?.data.texture??null;u.uSeed.value=state.seed;u.uMethod.value=pick.uMethod;u.uMethod2.value=pick.uMethod2;u.uShape.value=shapeIds[state.shape]??0;
 u.uPreset.value=(presetNames.includes(state.shape)||shapeOf(state.shape))?1:0;u.uProject.value=shapeOf(state.shape)?.kind==='text'?1:0;u.uConceal.value=!imageCode&&state.mystery?smooth(.08,.24,state.t)*(1-smooth(.80,.94,state.t)):0;
 // All camera motion fades out with deformation, guaranteeing a flat identical final image.
 const preset=u.uPreset.value===1,orientation=imageCode&&!state.imageSolid?m.distort:m.form;
 const isText=shapeOf(state.shape)?.kind==='text';
 const base=preset?(state.shape==='pegasus'?-.30:.20):.42;
 mesh.rotation.set(((preset?-.06:-.18)+state.viewX)*orientation,isText?(.12+state.viewY)*orientation:(base+state.viewY)*orientation+m.turn-(preset?motionAt(.56).turn*m.form:0),0);renderer.setClearColor(state.bg,1);
 const spin=rotationAt(state.shot.rotation,state.t,'single');
 if(spin){mesh.rotation.set(state.viewX*orientation,state.viewY*orientation,0);mesh.quaternion.premultiply(shotQuat.setFromAxisAngle(shotAxis.fromArray(spin.axis),spin.angle));}
 const fx=effectsAt(state.t,state.duration,state);
 const imageSize=u.uSize.value,frameW=camera.right-camera.left,frameH=camera.top-camera.bottom;
 const fillZoom=Math.max(frameW/imageSize.x,frameH/imageSize.y);
 // how far the camera eases out while the picture is torn up, handing over to the 3D-solid setting as it forms (0 = stays filling the frame)
 const flat=1-(m.distort*state.pullback*(1-m.form)+m.form*(fillsFrame(state.shape)?0:state.formPullback));
 camera.zoom=(1+(fillZoom-1)*flat)*fx.zoom;camera.position.x=fx.x;camera.position.y=fx.y;camera.rotation.z=fx.roll;camera.updateProjectionMatrix();
 const move=blendCameraMove({x:camera.position.x,y:camera.position.y,zoom:camera.zoom,roll:camera.rotation.z},state.shot.camera,state.t,{width:imageSize.x,height:imageSize.y,zoom:1+(fillZoom-1)*flat});
 camera.zoom=move.zoom;camera.position.x=move.x;camera.position.y=move.y;camera.rotation.z=move.roll;camera.updateProjectionMatrix();
 applyRenderLook(u,state.renderLook);
 const view=syncPerspective(camera,perspCam,state.renderLook.enabled?state.renderLook.perspective:0);
 u.uGlass.value=imageCode?0:fx.glass;sceneBlur.render(scene,view,imageCode?0:fx.blur,imageCode?0:fx.glitch,imageCode?0:fx.chroma,fx.seconds,imageCode?{}:fx);
 imageInput=null;
 if(imageCode){const f=imageFrame(state.t*state.duration,state.duration,state.strength,{form:m.form});imageInput={target:state.imageSolid?imageTarget(mesh.geometry,{shape:state.shape,preset:u.uPreset.value===1,project:isText}):null,id:state.method,imageA:sourceCanvas,imageB:sourceCanvas,size:{width:imageSize.x,height:imageSize.y},frame:{...f,depth:state.depth,seed:state.seed,width:renderer.domElement.width,height:renderer.domElement.height,bg:state.bg,camera:imageCamera(view),rootQuaternion:mesh.quaternion.toArray()}};const fade=smoothImage(state.t/.025)*smoothImage((1-state.t)/.025);if(fade>0&&(state.strength>0||m.form>0))getImageLayer().draw(imageInput,fade);}else imageLayer?.reset();
 safety?.afterDraw();updateTransport(m);
}
function updateTransport(m=motionAt(state.t,state.chaosLength)){
 $('timeline').value=Math.round(state.t*1000);$('current-time').textContent=(state.t*state.duration).toFixed(1).padStart(4,'0');$('total-time').textContent=state.duration.toFixed(1)+' s';
 const titles=['01 / 元の画像','02 / ぐちゃぐちゃ',isImageMethodKey(state.method)&&!state.imageSolid?'03 / コード演出':'03 / 立体化','04 / 元どおり'];$('phase-badge').textContent=titles[m.phase];
 $('stage-caption').textContent=['ここから、変化がはじまる。','かたちをほどいて、自由に。',isImageMethodKey(state.method)&&!state.imageSolid?'画像片が動く、コードの演出。':'平面から、もうひとつのかたちへ。','最後は、最初の一枚へ。'][m.phase];
 document.querySelectorAll('.chapters button').forEach((b,i)=>b.classList.toggle('current',i===m.phase));
 $('play').textContent=state.playing?'Ⅱ':'▶';$('play').setAttribute('aria-label',state.playing?'一時停止':'再生');
}
function setTime(t){state.t=Math.min(1,Math.max(0,t));render()}
function showInspectorPane(name){
 document.querySelectorAll('.inspector-tabs [data-tab]').forEach(button=>{
  const selected=button.dataset.tab===name;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;
 });
 document.querySelectorAll('.inspector-pane').forEach(pane=>{pane.hidden=pane.id!==`pane-${name}`});
 document.querySelector('.inspector').scrollTop=0;
}
// the grain and tile sliders only reach some methods (and, for grain, some shapes): say so beside them
function updateSliderNotes(){const g=$('particle-detail-note'),t=$('tile-size-note');if(g)g.textContent=grainSingleNote({method:state.method,shapeHasGrain:!!shapeOf(state.shape)}).text;if(t)t.textContent=tileSingleNote({method:state.method},state.tiles).text}
function syncImageControls(){
 const code=isImageMethodKey(state.method);document.querySelector('#pane-shape .form-section').hidden=false;
 let toggle=$('image-solid');if(!toggle){const label=document.createElement('label');label.id='image-solid-control';label.className='range-label';toggle=document.createElement('input');toggle.id='image-solid';toggle.type='checkbox';toggle.onchange=()=>{state.imageSolid=toggle.checked;syncImageControls();render()};label.append(toggle,' 立体化する');document.querySelector('#pane-shape .form-section').prepend(label)}toggle.checked=state.imageSolid;$('image-solid-control').hidden=!code;
 let hint=$('image-shape-note');if(!hint){hint=document.createElement('p');hint.id='image-shape-note';hint.className='hint';$('pane-shape').prepend(hint)}hint.hidden=!code;hint.textContent='画像片が選んだ立体・GLBへ集まり、画像へ戻ります。「立体化する」をオフにすると物理演出だけになります。';
 for(const id of ['tile-size','randomize','mystery','fx-blur','fx-chroma','fx-glitch','fx-bloom','fx-neon','fx-glass','fx-scan','fx-grain','fx-vignette','fx-bokeh'])if($(id))$(id).disabled=code;
 $('intensity').min=code?0:10;$('tab-shape').textContent='03 立体';
 const chapter=document.querySelector('.chapters [data-time="0.60"] b');if(chapter)chapter.textContent=code&&!state.imageSolid?'コード演出':'立体化';
}
function setChoice(container,key,value){
 const wasImage=isImageMethodKey(state.method);state[key]=value;
 if(key==='method'&&wasImage!==isImageMethodKey(value)){const {x:w,y:h}=mesh.material.uniforms.uSize.value;const old=mesh.geometry;mesh.geometry=geometryFor(w,h);old.dispose();}
 if(key==='method')syncImageControls();
 if(key==='method'){let note=$('image-code-note');if(!note){note=document.createElement('p');note.id='image-code-note';$('methods').after(note)}note.hidden=!isImageMethodKey(value);note.textContent='JavaScript＋物理演算：画像 → 物理演出 → 選んだ立体 → 元の画像。「03 立体」で形とオン・オフを選べます。絵柄シャッフル・既存の画面効果は未対応です。';}
 if(key==='shape'){
  const {x:w,y:h}=mesh.material.uniforms.uSize.value;const old=mesh.geometry;mesh.geometry=geometryFor(w,h);old.dispose();
  $('remove-model').hidden=!customShapes.has(value);updateGroupBox();
  const custom=shapeOf(value);$('model-info').textContent=custom?`${custom.name} · ${custom.data.originalTriangles.toLocaleString()}面 · ${custom.kind==='colour'?'色つきの標準の形':custom.data.color?'形と色を使用':'形状のみ使用'}`: 'GLBや立体文字を追加すると、ここから選べます。';
 }
 document.querySelectorAll(key==='shape'?'[data-shape]':`#${container} button:not(.tile-gear):not(.add-method)`).forEach(b=>b.setAttribute('aria-pressed',b.dataset[key]===value));updateSliderNotes();render();
}
// added shapes sit in their own tile dashboard, each with a small shaded portrait of the model
function shapeTileIcon(thumb,kind){
 if(thumb){const img=document.createElement('img');img.src=thumb;img.alt='';return img}
 const s=document.createElement('span');s.textContent=kind==='model'?'▲':'文';return s;
}
function addShapeButton(id,name,thumb,kind='model'){
 if([...$('imported-shapes').children].some(b=>b.dataset.shape===id))return;
 const b=document.createElement('button');b.dataset.shape=id;b.className='added-shape';b.setAttribute('aria-pressed',String(state.shape===id));b.title=name;
 const label=document.createElement('b');label.textContent=name.replace(/^文字：/,'');
 const tag=document.createElement('small');tag.textContent=kind==='model'?'GLB':name.startsWith('文字：')?'文字':'輪郭';
 b.append(shapeTileIcon(thumb,kind),label,tag);$('imported-shapes').append(b);refreshShapeFilter();
}
// many added shapes: a name filter appears (the list scrolls)
function refreshShapeFilter(){const f=$('shape-filter');if(!f)return;f.hidden=$('imported-shapes').children.length<=8;if(f.hidden)f.value='';applyGroupView()}
function setActiveGroup(g){activeGroup=g;saveActive('unfold-glb-tab',g);applyGroupView()}
function applyGroupView(){
 const all=[...savedModels.values()],active=validActive(all,activeGroup),tabs=wantsTabs(all),t=($('shape-filter')?.value||'').trim().toLowerCase();
 $('shape-tabs').replaceChildren(...(tabs?[renderTabs(all,active,setActiveGroup)]:[]));
 for(const b of $('imported-shapes').children){const m=savedModels.get(b.dataset.shape);
  const inTab=!m||!tabs||b.dataset.shape===state.shape||inGroup(m,active);
  b.hidden=!inTab||(!!t&&!b.title.toLowerCase().includes(t))}
}
// the group of the selected saved GLB, changeable
function updateGroupBox(){
 const box=$('model-group-box'),meta=savedModels.get(state.shape);
 if(!meta){box.hidden=true;box.replaceChildren();return}
 const lab=document.createElement('span');lab.textContent='グループ';
 box.replaceChildren(lab,groupSelect([...savedModels.values()],groupOf(meta),async g=>{
  try{await updateModel(meta.id,{group:g});meta.group=g;applyGroupView();updateGroupBox()}catch(e){notice('グループを変えられませんでした。')}}));
 box.hidden=false;
}
function setShapeThumb(id,thumb){const b=[...$('imported-shapes').children].find(b=>b.dataset.shape===id);if(b)b.firstChild.replaceWith(shapeTileIcon(thumb))}
function thumbFor(data){try{return modelThumb(data.target)}catch(e){console.warn('thumbnail:',e);return ''}}
const shapeOf=id=>customShapes.get(id)??colourShapes.get(id);
function addCustomShape(name,data,kind='model',id=`custom-${++customSerial}`){
 customShapes.set(id,{name,data,kind});addShapeButton(id,name,savedModels.get(id)?.thumb||thumbFor(data),kind);
 state.viewX=state.viewY=0;state.t=chaosTime(.56,state.chaosLength);state.previewRange=false;setChoice('shapes','shape',id);
}
async function loadSavedModels(){
 try{for(const meta of await listModels()){savedModels.set(meta.id,meta);addShapeButton(meta.id,meta.name,meta.thumb)}
  fillMissingThumbs([...savedModels.values()],setShapeThumb);
  $('model-status').textContent=savedModels.size?`保存したGLB ${savedModels.size}個。シーケンスでも選べます。`:'追加したGLBはこのブラウザに保存され、次回も使えます。';
 }catch(e){$('model-status').textContent='このブラウザではGLBを保存できません。追加した形はタブを閉じると消えます。';}
}
async function chooseImportedShape(id){
 if(customShapes.has(id)){setChoice('shapes','shape',id);return}
 const meta=savedModels.get(id);if(!meta)return;
 if(importing)return;importing=true;$('model-status').textContent=`${meta.name} を読み込み中…`;
 try{const saved=await getModel(id);if(!saved)throw new Error('保存したGLBが見つかりません。');
  const data=await importModel(saved.buffer,{colors:true});addCustomShape(meta.name,data,'model',id);
  $('model-status').textContent='保存したGLBを読み込みました。';
 }catch(e){notice(e.message||'保存したGLBを読み込めませんでした。');$('model-status').textContent='読み込みに失敗しました。';}
 finally{importing=false}
}
async function addText(){
 if(importing||state.recording)return;
 let text;const font=$('shape-font').value;try{text=validateMaskText($('shape-text').value);if(font==='classic'&&!/[^\x20-\x7e]/.test(text))validateText(text)}catch(e){notice(e.message);return}
 if(customShapes.size>=8){notice('追加できる形は8個までです。使わない形を削除してね。');return}
 importing=true;state.playing=false;const disabled=[];
 document.querySelectorAll('button,input,select').forEach(el=>{disabled.push([el,el.disabled]);el.disabled=true});
 $('model-status').textContent='立体文字を作成中…';
 try{const data=font==='classic'&&!/[^\x20-\x7e]/.test(text)?await createTextShape(text):await createMaskTextShape(text,font==='classic'?'gothic':font);addCustomShape(`文字：${text}`,data,'text');$('model-status').textContent='立体文字を追加しました。変形・復元・動画保存に使えます。';notice('立体文字ができたよ。');}
 catch(e){$('model-status').textContent='立体文字を作成できませんでした。';notice(e.message||'文字を作成できませんでした。');}
 finally{importing=false;disabled.forEach(([el,was])=>el.disabled=was);}
}
async function addSilhouette(){
 if(importing||state.recording||!sourceCanvas)return;
 if(customShapes.size>=8){notice('追加できる形は8個までです。使わない形を削除してね。');return}
 try{const {x:w,y:h}=mesh.material.uniforms.uSize.value;const data=createSilhouetteShape(sourceCanvas,.5,{x:-w/2,y:h/2,w,h});addCustomShape('色差シルエット',data,'text');$('model-status').textContent='透明部分、または画像外周の色との差から形を作りました。被写体は自動認識しません。';notice('画像の色から輪郭を作ったよ。')}
 catch(e){notice(e.message||'シルエットを作れませんでした。')}
}
async function loadModel(file){
 if(!file||importing||state.recording)return;
 if(!file.name.toLowerCase().endsWith('.glb')){notice('GLB形式の3Dモデルを選んでね。');return}
 if(file.size>100*1024*1024){notice('100 MB以下のGLBを選んでね。');return}
 if(savedModels.size>=MAX_SAVED_MODELS){notice(`保存できるGLBは${MAX_SAVED_MODELS}個までです。使わない形を削除してね。`);return}
 importing=true;state.playing=false;const disabled=[];
 document.querySelectorAll('button,input,select').forEach(el=>{disabled.push([el,el.disabled]);el.disabled=true});
 $('model-status').textContent='モデルの形を読み込み中…';
 try{
  const buffer=await file.arrayBuffer(),data=await importModel(buffer,{colors:true}),name=file.name.replace(/\.glb$/i,'');
  let meta;try{const tab=validActive([...savedModels.values()],activeGroup);meta=await saveModel(name,buffer,data.originalTriangles,thumbFor(data),tab===ALL||tab===UNGROUPED?'':tab);savedModels.set(meta.id,meta)}
  catch(e){console.warn('GLB save:',e);notice('形は追加できたけど、ブラウザへの保存に失敗しました。空き容量やプライベートモードを確認してね。')}
  addCustomShape(name,data,'model',meta?.id);
  $('model-status').textContent=meta?'このブラウザに保存しました。シーケンスでも使えます。':'一時的に追加しました。再起動後はGLBを再読み込みしてね。';
  if(meta)notice('GLBを保存したよ。シーケンスでも使えるよ。');
 }catch(e){console.warn('GLB import:',e);$('model-status').textContent='追加できませんでした。';notice(e.message?.includes('GLB')||e.message?.includes('モデル')||e.message?.includes('三角形')||e.message?.includes('圧縮')||e.message?.includes('外部')?e.message:'モデルを読み込めませんでした。静止メッシュのGLBを試してね。');}
 finally{importing=false;disabled.forEach(([el,was])=>el.disabled=was);$('model-input').value='';}
}

async function loadImage(file){
 if(state.recording||importing)return;if(!file)return;
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)){notice('PNG・JPG・WebPの画像を選んでね。');return}
 if(file.size>20*1024*1024){notice('20 MB以下の画像を選んでね。');return}
 const url=URL.createObjectURL(file);const img=new Image();
 try{img.src=url;await img.decode();if(img.naturalWidth*img.naturalHeight>80e6)throw new Error('大きすぎる画像です');
  const scale=Math.min(1,4096/Math.max(img.naturalWidth,img.naturalHeight));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.naturalWidth*scale));c.height=Math.max(1,Math.round(img.naturalHeight*scale));c.getContext('2d').drawImage(img,0,0,c.width,c.height);
  state.playing=false;state.previewRange=false;state.t=0;state.viewX=state.viewY=0;setSource(c,file.name);notice(scale<1?'画像を読み込みました。長辺4096pxに調整しています。':'画像を読み込みました。再生で動きを確認できるよ。');
 }catch{notice('画像を読み込めませんでした。別のPNG・JPG・WebPを試してね。')}finally{URL.revokeObjectURL(url);$('image-input').value=''}
}
function wireControls(){
 const tabs=[...document.querySelectorAll('.inspector-tabs [data-tab]')];
 tabs.forEach((button,index)=>{
  button.onclick=()=>showInspectorPane(button.dataset.tab);
  button.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();
   const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(index+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
   showInspectorPane(tabs[next].dataset.tab);tabs[next].focus();};
 });
 for(const key of ['blur','push','shake','chroma','glitch','bloom','neon','glass','scan','grain','vignette','bokeh'])$(`fx-${key}`).oninput=e=>{state[key]=Number(e.target.value)/100;$(`fx-${key}-value`).textContent=e.target.value==='0'?'OFF':e.target.value+'%';render()};
 $('reset-effects').onclick=()=>{for(const key of ['blur','push','shake','chroma','glitch','bloom','neon','glass','scan','grain','vignette','bokeh']){state[key]=0;$(`fx-${key}`).value=0;$(`fx-${key}-value`).textContent='OFF'}render()};
 $('add-text').onclick=addText;$('add-silhouette').onclick=addSilhouette;
 $('shape-text').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();addText()}};
 $('add-model').onclick=()=>$('model-input').click();
 $('model-input').onchange=e=>loadModel(e.target.files[0]);
 $('imported-shapes').onclick=e=>{const b=e.target.closest('[data-shape]');if(b)chooseImportedShape(b.dataset.shape)};
 $('shape-filter').oninput=applyGroupView;
 $('remove-model').onclick=async()=>{const id=state.shape;if(!customShapes.has(id))return;
  if(savedModels.has(id)){try{await deleteModel(id);savedModels.delete(id)}catch(e){notice('保存したGLBを削除できませんでした。');return}}
  setChoice('shapes','shape','sphere');customShapes.delete(id);[...$('imported-shapes').children].find(b=>b.dataset.shape===id)?.remove();refreshShapeFilter();$('model-status').textContent='形を一覧から削除しました。元のGLBファイルは残っています。';};
 for(const event of ['dragenter','dragover'])$('model-drop').addEventListener(event,e=>{e.preventDefault();$('model-drop').classList.add('dragover')});
 $('model-drop').ondragleave=()=>$('model-drop').classList.remove('dragover');
 $('model-drop').ondrop=e=>{e.preventDefault();$('model-drop').classList.remove('dragover');loadModel(e.dataTransfer.files[0])};

 // the tiles come from the registry (shared with the sequence page): built-in methods, custom ones (blue frame, ⚙ menu), and the "＋自作メソッド" tile
 function renderMethodTiles(){
  syncMethodTiles($('methods'),{
   tag:$('methods-tag'),
   onAdd:()=>methodEditor.open(),
   onImport:()=>pickMethodFile({notify:notice}),
   onMenu:(id,anchor)=>openMethodMenu(anchor,id,{onEdit:key=>methodEditor.open({id:key}),onDuplicate:key=>methodEditor.open({copyOf:key}),onDelete:key=>{if(state.method===key)setChoice('methods','method','crumple');unregisterCustom(key);notice('自作メソッドを削除しました。')},onEnable:key=>isImageMethodKey(key)?methodEditor.open({id:key,review:true}):methodEnabler.enable(key),onReview:key=>methodEditor.open({id:key,review:true}),onExport:key=>exportMethod(key,{notify:notice})}),
   onPick:key=>setChoice('methods','method',key),
  });
  methodButtons($('methods')).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.method===state.method)));
 }
 shotControls=createShotControls({value:state.shot,getDuration:()=>state.duration,getImage:()=>sourceCanvas,onChange:value=>{if(state.recording){shotControls.setValue(state.shot);return;}state.shot=cleanShot(value);try{localStorage.setItem('unfold-single-shot',JSON.stringify(state.shot))}catch{notice('設定を保存できません。このタブ内では使えます。')}render()}});$('pane-shape').append(shotControls.element);
 renderControls=createRenderControls({value:state.renderLook,onChange:value=>{if(state.recording)return;state.renderLook=value;render()}});$('pane-effects').prepend(renderControls.element);
 safety=createSafety({notify:notice});
 const methodTrial=createTrial({vertexShader,fragmentShader});
 methodEditor=createImageMethodEditor({vertexShader,fragmentShader,notify:notice,safety,trial:methodTrial,onExportFile:record=>downloadMethodFile([record],{notify:notice}),getRenderLook:()=>state.renderLook,onApplyRenderLook:value=>{if(state.recording)return;state.renderLook=cleanRenderLook(value);renderControls.setValue(state.renderLook);render()},getPreviewImage:()=>sourceCanvas,getPreviewTarget:()=>imageTarget(mesh.geometry,{shape:state.shape,preset:presetNames.includes(state.shape)||!!shapeOf(state.shape),project:shapeOf(state.shape)?.kind==='text'})});
 methodEnabler=createEnabler({compile:source=>compileUserMethod(renderer,{vertexShader,fragmentShader,source}),trial:source=>methodTrial.run(source),safety,notify:notice});
 renderMethodTiles();
 onRegistryChange(()=>{if(!isImageMethodKey(state.method))state.method=resolveKey(state.method);syncImageControls();renderMethodTiles();updateSliderNotes();render()});
 // saved custom methods come back when the page opens; from then on every change in the registry is saved
 registerBundledImageMethods();   // 焦げ穴と炎・電撃で消失など、アプリに付いてくる画像コードのメソッド（保存はしない）
 methodPersistence=createPersistence({store:openStore(),onError:()=>notice('自作メソッドをこのブラウザに保存できませんでした。')});
 // saving starts first, so that what recoverFromCrash switches off is saved too
 methodPersistence.load().then(()=>{methodPersistence.start();safety.recoverFromCrash()},()=>notice('保存した自作メソッドを読み込めませんでした。'));
 addEventListener('pagehide',()=>safety.pageHide());
 // grain size of added shapes in the particle methods: only the grouping of faces changes, never the solid itself
 $('particle-detail').addEventListener('input',e=>{state.detail=Number(e.target.value)/100;$('particle-detail-value').textContent=e.target.value+'%';
  const custom=shapeOf(state.shape);if(custom)mesh.geometry.setAttribute('part',new THREE.BufferAttribute(particleParts(custom.data,state.detail),4));render()});
 $('chaos-length').addEventListener('input',e=>{state.chaosLength=Number(e.target.value)/100;$('chaos-length-value').textContent=e.target.value+'%';render()});
 $('model-color').addEventListener('input',e=>{state.modelColor=Number(e.target.value)/100;$('model-color-value').textContent=e.target.value+'%';render()});
 updateSliderNotes();
 $('tile-size').addEventListener('input',e=>{state.tiles=Number(e.target.value)/100;const n=tilesAcross(state.tiles);$('tile-size-value').textContent=`${n}×${n}${n===16?'・標準':''}`;applyTiles(THREE,mesh.geometry,n);updateSliderNotes();render()});
 // the colour shapes join the built-in ones (their names in their own colours); each GLB is read the first time it is picked
 for(const c of COLOUR_SHAPES){const b=document.createElement('button'),ic=document.createElement('span'),nm=document.createElement('b');b.dataset.shape=c.id;b.setAttribute('aria-pressed','false');b.className='colour-shape';b.title=`${c.name}（色つき）`;
  ic.textContent=c.icon;nm.textContent=c.name;paintColourLabel(ic,c.id);paintColourLabel(nm,c.id);b.append(ic,nm);$('shapes').append(b)}
 $('shapes').addEventListener('click',async e=>{const b=e.target.closest('[data-shape]');if(!b)return;const id=b.dataset.shape;
  if(isColourShape(id)&&!colourShapes.has(id)){if(importing)return;importing=true;b.disabled=true;$('model-status').textContent=`${b.title} を読み込み中…`;
   try{const data=await loadColourShape(id);colourShapes.set(id,{name:COLOUR_SHAPES.find(c=>c.id===id).name,data,kind:'colour'});$('model-status').textContent='色つきの形を読み込みました。'}
   catch(e){console.error(e);notice(e.message||'形を読み込めませんでした。');return}finally{importing=false;b.disabled=false}
   state.viewX=state.viewY=0;state.t=chaosTime(.56,state.chaosLength);state.previewRange=false;}
  setChoice('shapes','shape',id)});
 for(const [id,key] of [['intensity','strength'],['pullback','pullback'],['form-pullback','formPullback'],['depth','depth']])$(id).addEventListener('input',e=>{state[key]=Number(e.target.value)/100;$(id+'-value').textContent=e.target.value+'%';render()});
 $('randomize').onclick=()=>{state.seed=Math.floor(Math.random()*999);$('seed-label').textContent='SEED '+String(state.seed).padStart(3,'0');render()};
 $('duration').onchange=e=>{state.duration=Number(e.target.value);shotControls.setValue(state.shot);updateRange();render()};
 $('start-mode').onchange=e=>{state.startMode=e.target.value;state.playing=false;state.previewRange=false;setTime(getRange().from);updateRange()};
 $('custom-start').oninput=e=>{state.customStart=Number(e.target.value)/100;state.playing=false;setTime(state.customStart);updateRange()};
 $('mark-start').onclick=()=>{state.customStart=Math.min(.95,state.t);state.startMode='custom';$('start-mode').value='custom';state.playing=false;updateRange();render()};
 $('mystery').onchange=e=>{state.mystery=e.target.checked;updateRange();render()};
 $('preview-range').onclick=()=>{state.previewRange=true;state.playing=true;setTime(getRange().from)};
 $('ratio').onchange=e=>{state.ratio=e.target.value;$('stage').className=state.ratio==='1:1'?'square':state.ratio==='9:16'?'portrait':'';updateResolution();resize()};
 $('quality').onchange=updateResolution;
 function setBg(color){state.bg=color;$('custom-bg').value=color;document.querySelectorAll('[data-bg]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.bg===color));render()}
 document.querySelectorAll('[data-bg]').forEach(b=>b.onclick=()=>setBg(b.dataset.bg));$('custom-bg').oninput=e=>setBg(e.target.value);
 $('image-input').onchange=e=>loadImage(e.target.files[0]);$('demo').onclick=()=>{state.t=chaosTime(.56,state.chaosLength);state.playing=false;setSource(makeSample(),'カラーテスト・サンプル')};
 $('dropzone').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('image-input').click()}};
 for(const event of ['dragenter','dragover'])$('dropzone').addEventListener(event,e=>{e.preventDefault();$('dropzone').classList.add('dragover')});
 $('dropzone').ondragleave=()=>$('dropzone').classList.remove('dragover');$('dropzone').ondrop=e=>{e.preventDefault();$('dropzone').classList.remove('dragover');loadImage(e.dataTransfer.files[0])};
 window.addEventListener('dragover',e=>e.preventDefault());window.addEventListener('drop',e=>e.preventDefault());
 $('play').onclick=()=>{if(state.t>=1)state.t=state.previewRange?getRange().from:0;state.playing=!state.playing;render()};$('restart').onclick=()=>{state.playing=false;state.previewRange=false;setTime(0)};
 $('timeline').oninput=e=>{state.playing=false;state.previewRange=false;setTime(Number(e.target.value)/1000)};
 document.querySelectorAll('.chapters button').forEach(b=>b.onclick=()=>{state.playing=false;state.previewRange=false;setTime(chaosTime(Number(b.dataset.time),state.chaosLength))});
 $('loop').onclick=()=>{state.loop=!state.loop;$('loop').setAttribute('aria-pressed',state.loop);$('loop').classList.toggle('active',state.loop)};
 document.addEventListener('keydown',e=>{if(e.code==='Space'&&!['INPUT','SELECT','BUTTON','TEXTAREA','LABEL'].includes(e.target.tagName)&&!state.recording){e.preventDefault();$('play').click()}});
 let drag=null;$('scene').onpointerdown=e=>{if(state.recording)return;drag={x:e.clientX,y:e.clientY,rx:state.viewX,ry:state.viewY};$('scene').setPointerCapture(e.pointerId)};
 $('scene').onpointermove=e=>{if(!drag||state.recording)return;state.viewX=drag.rx+(e.clientY-drag.y)*.009;state.viewY=drag.ry+(e.clientX-drag.x)*.009;render()};
 $('scene').onpointerup=$('scene').onpointercancel=()=>drag=null;
 $('reset-view').onclick=$('scene').ondblclick=()=>{state.viewX=state.viewY=0;render()};
 $('export').onclick=$('export-top').onclick=startExport;$('cancel-export').onclick=()=>recordJob?.cancel();
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.recording){recordJob?.cancel();notice('タブが非表示になったため書き出しを中止しました。開いたまま再実行してね。')}});
 new ResizeObserver(resize).observe($('stage'));
}
function outputSize(){const q=Number($('quality').value);return state.ratio==='1:1'?[q,q]:state.ratio==='9:16'?[q,Math.round(q*16/9)]:[Math.round(q*16/9),q]}
function updateResolution(){$('resolution-label').textContent=outputSize().join(' × ')}
function getRange(){return exportRange(state.startMode,state.customStart,state.duration,state.chaosLength)}
function updateRange(){
 const r=getRange();$('custom-start').value=(state.customStart*100).toFixed(1);$('custom-start-row').hidden=state.startMode!=='custom';
 $('custom-start-value').textContent=(state.customStart*state.duration).toFixed(1)+'秒';
 $('range-summary').textContent=`${(r.from*state.duration).toFixed(1)}秒 → ${state.duration.toFixed(1)}秒 ／ 書き出し約${r.seconds.toFixed(1)}秒`;
 $('range-warning').hidden=r.from>=.24||!state.mystery;
}
const formats=[];
function detectFormats(){
 if(typeof MediaRecorder==='undefined'||!$('scene').captureStream){$('export').disabled=$('export-top').disabled=true;notice('このブラウザでは動画保存に対応していません。ChromeまたはSafariで開いてね。');return}
 for(const [label,ext,candidates] of [['MP4','mp4',['video/mp4;codecs=avc1.42E01E','video/mp4']],['WebM','webm',['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm']]]){
  const mime=candidates.find(m=>MediaRecorder.isTypeSupported(m));if(mime)formats.push({label,ext,mime});
 }
 $('format').replaceChildren(...formats.map(f=>new Option(f.label,f.ext)));
 if(!formats.length){$('export').disabled=$('export-top').disabled=true;notice('このブラウザに対応する動画形式が見つかりませんでした。')}
}
async function startExport(){
 showInspectorPane('export');
 await variants.ready();
 if(state.recording||importing)return;
 const format=formats.find(f=>f.ext===$('format').value);if(!format){notice('動画保存に対応したブラウザで開いてね。');return}
 if(isImageMethodKey(state.method))return startImageExport(format);
 const [w,h]=outputSize(),savedT=state.t,range=getRange(),disabled=[];let stream,recorder,frameId,cancelled=false,failed=false,finished=false;
 const parts=[];let start;
 state.recording=true;state.playing=false;state.t=range.from;
 document.querySelectorAll('button,input,select').forEach(el=>{if(el.id!=='cancel-export'){disabled.push([el,el.disabled]);el.disabled=true}});
 $('export-progress').hidden=false;$('export-result').hidden=true;$('progress').value=0;$('progress-label').textContent='書き出し中… 0% · このタブを開いたままお待ちください';
 function cleanup(){
  if(finished)return;finished=true;cancelAnimationFrame(frameId);stream?.getTracks().forEach(t=>t.stop());state.recording=false;state.t=savedT;recordJob=null;
  disabled.forEach(([el,was])=>el.disabled=was);$('export-progress').hidden=true;resize();
 }
 function stop(){if(recorder?.state==='recording')recorder.stop();else cleanup()}
 recordJob={cancel(){cancelled=true;stop()}};
 try{
  renderer.setPixelRatio(1);renderer.setSize(w,h,false);setCamera(w/h);render();
  stream=$('scene').captureStream(30);
  recorder=new MediaRecorder(stream,{mimeType:format.mime,videoBitsPerSecond:w*h>1000000?12000000:7000000});
  recorder.ondataavailable=e=>{if(e.data.size)parts.push(e.data)};
  recorder.onerror=()=>{failed=true;notice('動画を書き出せませんでした。720pに変更するか、別の形式を試してね。');stop()};
  recorder.onstop=async()=>{
   const elapsed=performance.now()-start;
   if(cancelled||failed){cleanup();if(cancelled)notice('動画の書き出しを中止しました。');return}
   let blob=new Blob(parts,{type:recorder.mimeType});
   if(format.ext==='webm')blob=await window.ysFixWebmDuration(blob,elapsed,{logger:false});
   cleanup();
   if(cancelled){notice('動画の書き出しを中止しました。');return}
   if(!blob.size){notice('動画を保存できませんでした。もう一度試してね。');return}
   if(lastVideoUrl)URL.revokeObjectURL(lastVideoUrl);lastVideoUrl=URL.createObjectURL(blob);
   $('result-video').src=lastVideoUrl;$('download').href=lastVideoUrl;$('download').download=`unfold-${state.method}-${state.shape}-${new Date().toISOString().replace(/[:.]/g,'-')}.${format.ext}`;
   $('result-info').textContent=`${format.label} · ${w} × ${h} · ${(elapsed/1000).toFixed(1)}秒 · ${(range.from*state.duration).toFixed(1)}秒から · ${(blob.size/1048576).toFixed(1)} MB`;$('export-result').hidden=false;
   notice('動画ができました。「動画を保存」からダウンロードできるよ。');
  };
  recorder.start(200);start=performance.now();
  function record(now){
   if(cancelled||failed)return;
   const elapsed=Math.max(0,(now-start)/1000);state.t=Math.min(1,range.from+elapsed/state.duration);render();
   const percent=Math.min(100,Math.round(elapsed/range.seconds*100));$('progress').value=percent;$('progress-label').textContent=`書き出し中… ${percent}% · このタブを開いたままお待ちください`;
   if(elapsed>=range.seconds+.15){stop();return}frameId=requestAnimationFrame(record);
  }
  frameId=requestAnimationFrame(record);
 }catch(e){console.error(e);failed=true;stop();cleanup();notice('書き出しを開始できませんでした。720pまたは別の保存形式を試してね。')}
}
async function startImageExport(format){
 if(!('VideoEncoder' in window)){notice('物理メソッドの動画保存はWebCodecs対応のChromeで開いてください。');return}
 if(getCustom(state.method)?.status!=='ok'){notice('コードを編集してプレビュー・保存してから書き出してください。');return}
 const [width,height]=outputSize(),savedT=state.t,range=getRange(),disabled=[];let cancelled=false;
 state.recording=true;state.playing=false;recordJob={cancel(){cancelled=true}};
 document.querySelectorAll('button,input,select,textarea').forEach(el=>{if(el.id!=='cancel-export'){disabled.push([el,el.disabled]);el.disabled=true}});
 $('export-progress').hidden=false;$('export-result').hidden=true;$('progress').value=0;$('progress-label').textContent='画像・物理演算を準備しています…';
 try{
  renderer.setPixelRatio(1);renderer.setSize(width,height,false);setCamera(width/height);
  const blob=await encodeCanvasVideo({canvas:$('scene'),width,height,fps:30,seconds:range.seconds,format:format.ext,cancelled:()=>cancelled,
   async draw(seconds){state.t=Math.min(1,range.from+seconds/state.duration);await prepareImageFrame()},
   onProgress:p=>{$('progress').value=Math.round(p*100);$('progress-label').textContent=`コマごとに書き出し中… ${Math.round(p*100)}% · 物理計算が終わってから保存します`;}});
  if(cancelled)throw new DOMException('書き出しを中止しました。','AbortError');
  if(lastVideoUrl)URL.revokeObjectURL(lastVideoUrl);lastVideoUrl=URL.createObjectURL(blob);
  $('result-video').src=lastVideoUrl;$('download').href=lastVideoUrl;$('download').download=`unfold-image-${new Date().toISOString().replace(/[:.]/g,'-')}.${format.ext}`;
  $('result-info').textContent=`${format.label} · ${width} × ${height} · ${range.seconds.toFixed(1)}秒 · ${(blob.size/1048576).toFixed(1)} MB`;$('export-result').hidden=false;notice('動画ができました。「動画を保存」から保存できます。');
 }catch(e){notice(e.message||'動画を書き出せませんでした。');}
 finally{state.recording=false;state.t=savedT;recordJob=null;disabled.forEach(([el,was])=>el.disabled=was);$('export-progress').hidden=true;resize();}
}
let previous=performance.now();function tick(now){if(state.playing&&!state.recording&&!document.hidden)safety?.tick(now-previous);const dt=Math.min((now-previous)/1000,.1);previous=now;if(state.playing&&!state.recording){state.t+=dt/state.duration;if(state.t>1){if(state.loop){const from=state.previewRange?getRange().from:0;state.t=from+(state.t-1)%(1-from)}else{state.t=1;state.playing=false}}render()}requestAnimationFrame(tick)}
try{
 renderer=new THREE.WebGLRenderer({canvas:$('scene'),antialias:true,alpha:false,preserveDrawingBuffer:true});$('scene').addEventListener('webglcontextlost',()=>safety?.contextLost());renderer.outputColorSpace=THREE.SRGBColorSpace;sceneBlur=new SceneBlur(renderer);
 scene=new THREE.Scene();camera=new THREE.OrthographicCamera(-4.8,4.8,2.7,-2.7,.1,100);camera.position.z=10;
 setSource(makeSample(),'カラーテスト・サンプル');wireControls();loadSavedModels();detectFormats();updateRange();resize();requestAnimationFrame(tick);
 attachWorkshopLink({notify:notice,apply:(item,target,activate)=>{if(state.recording)throw Error('書き出しが終わってから適用してください。');if(item.kind==='text')throw Error('文字モーションはシーケンスの歌詞に使えます。');const method=activate();if(method.code&&item.workshop?.shape==='none')state.imageSolid=false;setChoice('methods','method',method.id);}});
 window.unfold={state,motionAt,setTime,render,loadImage,outputSize};window.unfoldMethods={registerCustom,unregisterCustom,setCustomStatus,listCustom,get variants(){return variants},get editor(){return methodEditor},get persistence(){return methodPersistence},get safety(){return safety},get enabler(){return methodEnabler},transfer:{importFile:importMethodFile,importText:importMethodText,download:downloadMethodFile}};
}catch(e){console.error(e);$('stage-error').hidden=false;$('stage-error').textContent='3D表示を開始できませんでした。WebGL対応のChromeまたはSafariで開いてね。（原因: '+String(e?.message||e).slice(0,160)+'）';$('export').disabled=$('export-top').disabled=true}
