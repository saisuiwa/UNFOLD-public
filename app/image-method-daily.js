// The JavaScript image methods added by the daily routine (docs/daily-samples-routine.md). New ones go at the END of the list.
// They are appended to IMAGE_METHOD_PRESETS (image-method-presets.js), so the method workshop and the image method editor list them as samples.
//   key: lower-case letters, digits and "-" (the id of its preview is image-<key>). name: up to 20 characters (the editor's name box). symbol: one character.
//   desc: one line for the samples page (10-60 characters, ends with "。"). added: the day it was added (YYYY-MM-DD, Japan time).
//   poster (optional): the second of the 6 second clip the still picture is taken at (1.8 if left out; pick when the effect is easiest to see).
//   code: { version: 1, runtime: IMAGE_RUNTIME, source, params } as in image-method-format.js (see docs/image-code-methods.md for the api).
//   previewShape: leave it out (a sphere in the workshop). 'none' is for the eight surface effects and is counted by their tests.
import {IMAGE_RUNTIME} from './image-method-format.js';

export const DAILY_IMAGE_METHODS=[
 {key:'tile-vortex',name:'渦に巻かれるタイル',symbol:'渦',desc:'タイルが渦を巻いて中心へ寄り、また元の絵へ戻ります。',added:'2026-10-07',poster:1.8,
  code:{version:1,runtime:IMAGE_RUNTIME,params:{columns:14,gravity:4,bounce:.5,seed:7,returnMode:'reverse',label:'UNFOLD',font:'gothic'},source:`// タイルが渦を巻いて中心へ寄る。内側ほど速く回り、強さ(amount)が戻ると元の位置へ帰る
const {createImageTiles,THREE,size}=api;
const tiles=createImageTiles();
const half=size.width*.5;
return {update(frame){
 const e=Math.min(1,frame.amount/.8);
 for(const piece of tiles){
  const x=piece.home.x,y=piece.home.y,r=Math.hypot(x,y)/half;
  const turn=e*(3.4/(r+.5)),c=Math.cos(turn),s=Math.sin(turn),pull=1-.5*e*(1-r*.35);
  piece.mesh.position.set((x*c-y*s)*pull,(x*s+y*c)*pull,0);
  piece.mesh.rotation.set(0,0,turn);
  piece.mesh.scale.setScalar(1-.3*e);
 }
}};`}},
 {key:'shatter-reborn',name:'爆砕と再誕',symbol:'爆',desc:'絵が衝撃波で砕けて飛び散り、文字にぶつかって跳ね、光の粒とともに元へ戻ります。',added:'2026-10-08',poster:1.6,
  code:{version:1,runtime:IMAGE_RUNTIME,params:{columns:14,gravity:5,bounce:.55,seed:11,returnMode:'reverse',label:'UNFOLD',font:'gothic'},source:`// 物理(Rapier)・衝撃波(THREE)・文字(Troika)・GSAPを重ねる。絵が砕けて飛び散り、床と文字で跳ね、光の粒を残して元の絵へ戻る
const {createImageTiles,createText,physics,random,params,size,returnTime,assemble,THREE,gsap,smooth}=api;
const W=size.width,H=size.height,tiles=createImageTiles();
physics.floor(-H*.4);
// 文字は動かない壁として物理に参加し、飛んできたタイルを弾く。登場はGSAPで時刻から決める
const title=createText(params.label,{fontSize:H*.2,color:'#ffffff',outlineColor:'#ff3d81',outlineWidth:.012,fillOpacity:0,outlineOpacity:0});
title.position.set(0,H*.04,.35);
physics.bind(title,{fixed:true,size:[Math.min(W*.8,params.label.length*H*.13+.2),H*.2,.25]});
// 中心に近いタイルほど強く外へ飛ばす
const reach=Math.hypot(W,H)*.5;
for(const piece of tiles){
 const x=piece.home.x,y=piece.home.y,r=Math.hypot(x,y),ux=r>.001?x/r:0,uy=r>.001?y/r:1,power=1+2.2*(1-r/reach)+random()*1.2;
 physics.bind(piece.mesh,{size:[piece.width*.94,piece.height*.94,.045],velocity:[ux*power,uy*power*.6+1.2,.5+random()*2],angular:[(random()-.5)*6,(random()-.5)*6,(random()-.5)*6]});
}
// 衝撃波: 2本のリングが広がって消える
const ringMaterial=()=>new THREE.MeshBasicMaterial({color:'#ffe08a',transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
const rings=[new THREE.Mesh(new THREE.RingGeometry(.94,1,96),ringMaterial()),new THREE.Mesh(new THREE.RingGeometry(.96,1,96),ringMaterial())];
rings[1].rotation.x=1.15;rings[1].material.color.set('#ff7ab8');
for(const ring of rings){ring.position.z=.2;ring.visible=false;api.root.add(ring);}
// 光の粒: 作るときに向きと速さを決め、あとは時刻から位置を求める
const COUNT=240,dir=new Float32Array(COUNT*4),pos=new Float32Array(COUNT*3);
for(let i=0;i<COUNT;i++){const a=random()*Math.PI*2,u=random()*2-1,s=Math.sqrt(1-u*u);dir.set([Math.cos(a)*s,u,Math.sin(a)*s,1.5+random()*4.5],i*4);}
const sparkGeometry=new THREE.BufferGeometry();sparkGeometry.setAttribute('position',new THREE.BufferAttribute(pos,3));
const sparks=new THREE.Points(sparkGeometry,new THREE.PointsMaterial({color:'#fff1b8',size:H*.022,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}));
sparks.frustumCulled=false;sparks.visible=false;api.root.add(sparks);
// GSAP: 文字が大きく現れて着地し、最後に薄れる
const timeline=gsap.timeline({paused:true});
timeline.fromTo(title.scale,{x:2.6,y:2.6,z:2.6},{x:1,y:1,z:1,duration:.55,ease:'expo.out'},.9)
 .fromTo(title,{fillOpacity:0,outlineOpacity:0},{fillOpacity:1,outlineOpacity:1,duration:.2,ease:'none'},.9)
 .to(title,{fillOpacity:0,outlineOpacity:0,duration:.6,ease:'power2.in'},4.2);
return {timeline,physicsTime:returnTime,update(frame){
 const e=Math.min(1,frame.amount/.8),mix=Math.max(assemble(frame),1-e),q=new THREE.Quaternion();
 for(const piece of tiles){piece.mesh.position.lerp(piece.home,mix);piece.mesh.quaternion.slerp(q,mix);}
 title.visible=frame.progress>.05&&frame.progress<.95;
 // 衝撃波と粒は、強さの立ち上がりの瞬間(progress .06)から数える
 const t=Math.max(0,(frame.progress-.06)*frame.duration);
 rings.forEach((ring,i)=>{const k=Math.min(1,Math.max(0,(t-i*.18)/1.3)),on=k>0&&k<1;ring.visible=on;if(on){ring.scale.setScalar(H*(.1+(i?3.6:4.8)*smooth(k)));ring.material.opacity=(1-k)*(i?.5:.85);}});
 const fade=Math.max(0,1-t/3.6);sparks.visible=t>0&&fade>0&&frame.amount>0;
 if(sparks.visible){for(let i=0;i<COUNT;i++){const sp=dir[i*4+3]*t,f=i*3;pos[f]=dir[i*4]*sp;pos[f+1]=dir[i*4+1]*sp-.5*params.gravity*t*t*.25;pos[f+2]=dir[i*4+2]*sp;}
  sparkGeometry.attributes.position.needsUpdate=true;sparks.material.opacity=fade*.9;}
 // 着地の揺れ
 const shake=Math.exp(-t*7)*(t>0?1:0)*.05*H;api.root.position.set(Math.sin(t*61)*shake,Math.cos(t*53)*shake,0);
}};`}},
 {key:'ripple-tilt',name:'波紋で傾くタイル',symbol:'波',desc:'中心から波紋が広がり、タイルが順に傾いて浮き上がります。',added:'2026-10-09',poster:1.8,
  code:{version:1,runtime:IMAGE_RUNTIME,params:{columns:14,gravity:4,bounce:.5,seed:3,returnMode:'reverse',label:'UNFOLD',font:'gothic'},source:`// 中心から波紋が広がり、タイルが順に傾いて手前へ浮く。強さ(amount)が戻ると元の位置へ帰る
const {createImageTiles,size,smooth}=api;
const tiles=createImageTiles();
const half=size.width*.5;
return {update(frame){
 const t=Math.min(1,frame.amount/.8);
 for(const piece of tiles){
  const x=piece.home.x,y=piece.home.y,r=Math.hypot(x,y)/half;
  const k=smooth(Math.max(0,Math.min(1,t*1.6-r*.7)));            // 中心のタイルほど早く動く
  const a=Math.atan2(y,x);
  piece.mesh.position.set(x*(1+.08*k),y*(1+.08*k),k*half*.35);
  piece.mesh.rotation.set(-Math.sin(a)*k*1.1,Math.cos(a)*k*1.1,k*(Math.sin(a*3)*.5));
  piece.mesh.scale.setScalar(1-.18*k);
 }
}};`}},
 {key:'domino-fall',name:'ドミノのように倒れる',symbol:'倒',desc:'左の列から順に、タイルがドミノのように傾いて倒れていきます。',added:'2026-10-10',poster:1.0,
  code:{version:1,runtime:IMAGE_RUNTIME,params:{columns:14,gravity:4,bounce:.5,seed:5,returnMode:'reverse',label:'UNFOLD',font:'gothic'},source:`// 左の列から順に、タイルがドミノのように奥へ倒れる。強さ(amount)が戻ると元の位置へ帰る
const {createImageTiles,size,smooth}=api;
const tiles=createImageTiles();
const half=size.width*.5;
return {update(frame){
 const t=Math.min(1,frame.amount/.8);
 for(const piece of tiles){
  const x=piece.home.x,y=piece.home.y,col=(x+half)/(2*half);        // 0 = 左端、1 = 右端
  const k=smooth(Math.max(0,Math.min(1,t*1.4-col*1.1)));             // 左の列ほど早く倒れる
  piece.mesh.position.set(x+k*piece.width*.2,y-k*half*.06,-k*half*.15);
  piece.mesh.rotation.set(k*.35*Math.sin(y/half*3),k*1.3,0);
  piece.mesh.scale.setScalar(1-.12*k);
 }
}};`}},
 {key:'melt-drip',name:'とろけて垂れるタイル',symbol:'垂',desc:'タイルが列ごとに速さを変えて、縦に伸びながら下へ垂れていきます。',added:'2026-10-14',poster:1.0,
  code:{version:1,runtime:IMAGE_RUNTIME,params:{columns:14,gravity:4,bounce:.5,seed:9,returnMode:'reverse',label:'UNFOLD',font:'gothic'},source:`// タイルが列ごとに別の速さで、縦に伸びながら下へ垂れる。強さ(amount)が戻ると元の位置へ帰る
const {createImageTiles,size,random,smooth}=api;
const tiles=createImageTiles();
const half=size.width*.5;
const speed=new Map();                                   // 列ごとの乱数（作成時に1回だけ決める）
for(const piece of tiles){const key=Math.round(piece.home.x);if(!speed.has(key))speed.set(key,.6+random()*.9)}
return {update(frame){
 const t=Math.min(1,frame.amount/.8);
 for(const piece of tiles){
  const x=piece.home.x,y=piece.home.y,v=speed.get(Math.round(x));
  const top=(y+half*.56)/(half*1.12);                    // 上のタイルほど遅れて垂れる（0 = 下、1 = 上）
  const k=smooth(Math.max(0,Math.min(1,t*v*1.6-(1-top)*.35)));
  piece.mesh.position.set(x,y-k*half*.5*v,0);
  piece.mesh.scale.set(1-.25*k,1+1.1*k*v,1);
 }
}};`}},
 {key:'ring-spin',name:'リングごとに逆回り',symbol:'環',desc:'同心円のリングごとに、タイルが交互に逆向きへ回って、また戻ります。',added:'2026-10-15',poster:1.2,
  code:{version:1,runtime:IMAGE_RUNTIME,params:{columns:14,gravity:4,bounce:.5,seed:4,returnMode:'reverse',label:'UNFOLD',font:'gothic'},source:`// 中心からの距離でリングに分けて、リングごとに交互に逆向きへ回る。強さ(amount)が戻ると元の位置へ帰る
const {createImageTiles,size,smooth}=api;
const tiles=createImageTiles();
const half=size.width*.5;
return {update(frame){
 const t=Math.min(1,frame.amount/.8);
 for(const piece of tiles){
  const x=piece.home.x,y=piece.home.y,r=Math.hypot(x,y)/half;
  const ring=Math.floor(r*4.5);                          // 外へ向かって 0, 1, 2 … のリング
  const dir=ring%2===0?1:-1;
  const k=smooth(Math.max(0,Math.min(1,t*1.5-ring*.12)));
  const turn=dir*k*(.45+.08*ring),c=Math.cos(turn),s=Math.sin(turn);
  piece.mesh.position.set(x*c-y*s,x*s+y*c,0);
  piece.mesh.rotation.set(0,0,turn);
  piece.mesh.scale.setScalar(1-.1*k);
 }
}};`}}
];
