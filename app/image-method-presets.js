import {SURFACE_METHOD_PRESETS} from './image-surface-presets.js';
import {IMAGE_RUNTIME} from './image-method-format.js';
import {DAILY_IMAGE_METHODS} from './image-method-daily.js';
const source=(mode)=>`const {createImageTiles,createText,physics,random,params,size,returnTime,assemble,THREE,gsap}=api;
const tiles=createImageTiles();
physics.floor(-size.height*.8);
for(const piece of tiles){
 physics.bind(piece.mesh,{size:[piece.width*.94,piece.height*.94,.045],velocity:${mode==='burst'?"[(random()-.5)*5,1+random()*3,(random()-.5)*4]":"[(random()-.5)*.5,random()*.5,(random()-.5)*.5]"},angular:[(random()-.5)*2,(random()-.5)*2,(random()-.5)*2]});
}
${mode==='text'?`const title=createText(params.label,{fontSize:.5,color:'#d9f878',outlineColor:'#132020',outlineWidth:.01});
title.position.set(0,size.height*.8,.15);
physics.bind(title,{size:[Math.max(.1,Math.min(size.width*.8,params.label.length*.38)),.5,.15],velocity:[.4,-1,0]});`:''}
const timeline=gsap.timeline({paused:true});
return {timeline,physicsTime:returnTime,update(frame){
 const mix=Math.max(assemble(frame),1-Math.min(1,frame.amount/.8));
 for(const piece of tiles){piece.mesh.position.lerp(piece.home,mix);piece.mesh.quaternion.slerp(new THREE.Quaternion(),mix);}
 ${mode==='text'?"title.visible=frame.progress>.06&&frame.progress<.94;":''}
}};`;
export const IMAGE_METHOD_PRESETS=[['タイルが落ちて跳ねる','fall'],['爆発して元へ戻る','burst'],['画像片と文字がぶつかる','text']].map(([name,mode])=>({name,symbol:'◈',code:{version:1,runtime:IMAGE_RUNTIME,source:source(mode),params:{columns:12,gravity:4,bounce:.5,seed:7,returnMode:'reverse',label:'UNFOLD',font:'gothic'}}})).concat(SURFACE_METHOD_PRESETS,DAILY_IMAGE_METHODS);
