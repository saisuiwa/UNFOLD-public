// 「GLBの色（写真と混ぜる）」 with image code (爆砕と再誕 …): the model's own colours / texture come in as it becomes the solid, like the GLSL methods.
// 0 % (and callers that do not say modelColor) and shapes without colour must look exactly as before.
// Serve the repository root:  python3 -m http.server 8776 --bind 127.0.0.1   then  node tools/test/image-solid-colour-browser.mjs
import {chromium} from '../image-code-build/.test-deps/node_modules/playwright-core/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{
 const p=await browser.newPage({viewport:{width:1500,height:1000}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 // ---- the runtime: a textured quad (top half red, bottom half blue) and a green one without a texture
 await p.goto('http://127.0.0.1:8776/');
 const runtime=await p.evaluate(async()=>{
  const {createImageMethodRuntime}=await import('/app/image-method-runtime.js');const {imageFrame}=await import('/app/image-method-format.js');const {IMAGE_METHOD_PRESETS}=await import('/app/image-method-presets.js');
  const {importModel}=await import('/app/model-import.js');const T=await import('/app/vendor/three.module.min.js');
  const image=document.createElement('canvas');image.width=160;image.height=90;const x=image.getContext('2d');x.fillStyle='#804020';x.fillRect(0,0,160,90);x.fillStyle='#00ff99';x.fillRect(0,0,80,45);
  // a flat 2 × 2 quad facing the camera; glTF uv (0,0) is the texture's top-left
  async function quadGLB({texture=false,factor=[1,1,1,1]}={}){
   const pos=new Float32Array([-1,1,0,-1,-1,0,1,-1,0,-1,1,0,1,-1,0,1,1,0]),uv=new Float32Array([0,0,0,1,1,1,0,0,1,1,1,0]);
   let png=new Uint8Array(0);
   if(texture){const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');g.fillStyle='#ff0000';g.fillRect(0,0,64,32);g.fillStyle='#0000ff';g.fillRect(0,32,64,32);png=new Uint8Array(await (await new Promise(r=>c.toBlob(r,'image/png'))).arrayBuffer())}
   const pad=n=>Math.ceil(n/4)*4,binLength=pos.byteLength+uv.byteLength+pad(png.length);
   const json={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0,TEXCOORD_0:1},material:0}]}],
    materials:[{pbrMetallicRoughness:{baseColorFactor:factor,...(texture?{baseColorTexture:{index:0}}:{})}}],
    ...(texture?{textures:[{source:0}],images:[{bufferView:2,mimeType:'image/png'}]}:{}),
    buffers:[{byteLength:binLength}],bufferViews:[{buffer:0,byteLength:pos.byteLength},{buffer:0,byteOffset:pos.byteLength,byteLength:uv.byteLength},...(texture?[{buffer:0,byteOffset:pos.byteLength+uv.byteLength,byteLength:png.length}]:[])],
    accessors:[{bufferView:0,componentType:5126,count:6,type:'VEC3',min:[-1,-1,0],max:[1,1,0]},{bufferView:1,componentType:5126,count:6,type:'VEC2'}]};
   const encoded=new TextEncoder().encode(JSON.stringify(json)),padded=pad(encoded.length),buffer=new ArrayBuffer(28+padded+binLength),view=new DataView(buffer),bytes=new Uint8Array(buffer);
   view.setUint32(0,0x46546c67,true);view.setUint32(4,2,true);view.setUint32(8,buffer.byteLength,true);view.setUint32(12,padded,true);view.setUint32(16,0x4e4f534a,true);bytes.fill(32,20,20+padded);bytes.set(encoded,20);
   view.setUint32(20+padded,binLength,true);view.setUint32(24+padded,0x004e4942,true);const o=28+padded;bytes.set(new Uint8Array(pos.buffer),o);bytes.set(new Uint8Array(uv.buffer),o+pos.byteLength);bytes.set(png,o+pos.byteLength+uv.byteLength);
   return importModel(buffer,{colors:true});
  }
  const cam=new T.OrthographicCamera(-4,4,2.25,-2.25,.1,100);cam.position.z=10;cam.updateMatrixWorld();
  const f=(t,form,extra={})=>({...imageFrame(t,6,.8),form,width:640,height:360,bg:'#101819',camera:{projection:cam.projectionMatrix.toArray(),world:cam.matrixWorld.toArray()},depth:1,seed:28,...extra});
  const out=document.createElement('canvas');out.width=640;out.height=360;document.body.append(out);const cx=out.getContext('2d',{willReadFrequently:true});
  const shot=async(r,frame)=>{const b=await r.render(frame);cx.drawImage(b,0,0);b.close();const d=cx.getImageData(0,0,640,360).data;let h=2166136261;for(const v of d)h=Math.imul(h^v,16777619);const at=(x,y)=>[...d.slice((y*640+x)*4,(y*640+x)*4+3)];return {hash:h>>>0,top:at(320,100),middle:at(320,180),bottom:at(320,260)}};
  const run=async(target,frames)=>{const r=createImageMethodRuntime();try{await r.prepare({code:IMAGE_METHOD_PRESETS[0].code,imageA:image,size:{width:5.25,height:2.953125},target});const res=[];for(const fr of frames)res.push(await shot(r,fr));return res}finally{r.dispose()}};
  const painted=await quadGLB({texture:true}),green=await quadGLB({factor:[0,1,0,1]});
  if(!painted.texture||!painted.modelUv||!painted.color||!green.color||green.texture)throw Error('fixture GLBs did not import with their colours');
  const base={positions:painted.target,uv:painted.uv,shape:0,preset:true,project:false};
  const [plain]=await run(base,[f(3,1,{modelColor:1})]);
  const [none,zero,half,full,flat0,flat1]=await run({...base,color:painted.color,modelUv:painted.modelUv,texture:painted.texture},[f(3,1),f(3,1,{modelColor:0}),f(3,1,{modelColor:.5}),f(3,1,{modelColor:1}),f(0,0,{modelColor:0}),f(0,0,{modelColor:1})]);
  const [plainFlat]=await run(base,[f(0,0)]);
  const [greenFull]=await run({positions:green.target,uv:green.uv,color:green.color,shape:0,preset:true,project:false},[f(3,1,{modelColor:1})]);
  if(!painted.target.byteLength||!painted.color.byteLength)throw Error('the page lost its copy of the model data');
  return {plain,none,zero,half,full,flat0,flat1,plainFlat,greenFull};
 });
 const {plain,none,zero,half,full,flat0,flat1,plainFlat,greenFull}=runtime;
 assert.equal(zero.hash,plain.hash,'0 % must look exactly like a shape without colour');
 assert.equal(none.hash,plain.hash,'a frame without modelColor (editor, workshop, STUDIO) must look as before');
 assert.equal(flat0.hash,plainFlat.hash,'the flat picture is never tinted');assert.equal(flat1.hash,plainFlat.hash,'the flat picture is never tinted (100 %)');
 const near=(c,want)=>c.every((v,i)=>Math.abs(v-want[i])<=12);
 assert.ok(near(full.top,[255,0,0]),`texture top half should be red at 100 %: ${full.top}`);
 assert.ok(near(full.bottom,[0,0,255]),`texture bottom half should be blue at 100 %: ${full.bottom}`);
 assert.ok(!near(zero.top,[255,0,0])&&!near(zero.bottom,[0,0,255]),'0 % shows the picture');
 assert.ok(half.top[0]>zero.top[0]&&half.top[0]<full.top[0]||half.top[2]<zero.top[2],`50 % mixes the two: ${zero.top} / ${half.top} / ${full.top}`);
 assert.notEqual(half.hash,zero.hash);assert.notEqual(half.hash,full.hash);
 assert.ok(near(greenFull.middle,[0,255,0]),`base colour without texture should show at 100 %: ${greenFull.middle}`);

 // ---- the pages: 1枚モード and シーケンス with ハート吹雪 + 爆砕と再誕
 const look=(sel,draw)=>p.evaluate(([sel,draw])=>{if(draw==='single')unfold.render();else unfoldSeq.renderAt(1.2);const c=document.querySelector(sel),o=document.createElement('canvas');o.width=c.width;o.height=c.height;const x=o.getContext('2d');x.drawImage(c,0,0);const d=x.getImageData(0,0,o.width,o.height).data;let h=2166136261,r=0,g=0,b=0,n=0;for(let i=0;i<d.length;i+=4){h=Math.imul(h^d[i]^(d[i+1]<<8)^(d[i+2]<<16),16777619);const dr=d[i]-17,dg=d[i+1]-23,db=d[i+2]-24;if(dr*dr+dg*dg+db*db>400){r+=d[i];g+=d[i+1];b+=d[i+2];n++}}return {hash:h>>>0,avg:n?[r/n,g/n,b/n].map(Math.round):null}},[sel,draw]);
 // the worker needs a moment to prepare (the GLSL solid shows meanwhile): wait, then until two looks agree
 const settle=async(sel,draw)=>{await p.waitForTimeout(2500);let last=await look(sel,draw);for(let i=0;i<30;i++){await p.waitForTimeout(500);const l=await look(sel,draw);if(l.hash===last.hash)return l;last=l}throw Error('the preview never settled')};
 const slider=(id,v)=>p.evaluate(([id,v])=>{const s=document.getElementById(id);s.value=String(v);s.dispatchEvent(new Event('input'))},[id,v]);
 const picture=`(()=>{const c=document.createElement('canvas');c.width=1280;c.height=720;const x=c.getContext('2d');const g=x.createLinearGradient(0,0,1280,720);g.addColorStop(0,'#1d6fa3');g.addColorStop(1,'#2fb38a');x.fillStyle=g;x.fillRect(0,0,1280,720);return c})()`;
 const reddish=([r,g,b])=>r>g+80&&r>b+40;
 await p.goto('http://127.0.0.1:8776/app/');await p.waitForFunction(()=>window.unfoldMethods&&window.unfold);
 await p.evaluate(`new Promise(r=>${picture}.toBlob(r,'image/png')).then(b=>unfold.loadImage(new File([b],'blue.png',{type:'image/png'})))`);
 const shatter=await p.evaluate(()=>unfoldMethods.listCustom().find(r=>r.name==='爆砕と再誕')?.id);assert.ok(shatter,'爆砕と再誕 is bundled');
 await p.locator(`[data-method="${shatter}"]`).first().click();await p.locator('[data-shape="c-hearts"]').first().click();await p.waitForFunction(()=>unfold.state.shape==='c-hearts');await p.evaluate(()=>unfold.setTime(.61));
 await slider('model-color',100);const single100=await settle('#scene','single');await slider('model-color',0);const single0=await settle('#scene','single');
 assert.notEqual(single100.hash,single0.hash,'single: the slider changes the hearts');assert.ok(reddish(single100.avg),`single 100 %: the hearts' own colours (${single100.avg})`);assert.ok(!reddish(single0.avg),`single 0 %: the picture (${single0.avg})`);
 await p.goto('http://127.0.0.1:8776/app/sequence.html?empty');await p.waitForFunction(()=>window.unfoldSeq&&window.unfoldMethods);
 await p.evaluate(`(async()=>{const c=${picture};unfoldSeq.addSlide(c,'A');unfoldSeq.addSlide(c,'B');const s=unfoldSeq.seq;s.bpm=120;s.slides.forEach(x=>x.hold=0);Object.assign(s.transitions[0],{shape:'c-hearts',beats:4,method:${JSON.stringify(shatter)},method2:''});s.selection={kind:'tr',i:0};await unfoldSeq.prepareShapes();unfoldSeq.refreshUI();})()`);
 await slider('seq-model-color',100);const seq100=await settle('#seq-canvas','seq');await slider('seq-model-color',0);const seq0=await settle('#seq-canvas','seq');
 assert.notEqual(seq100.hash,seq0.hash,'sequence: the slider changes the hearts');assert.ok(reddish(seq100.avg),`sequence 100 %: the hearts' own colours (${seq100.avg})`);assert.ok(!reddish(seq0.avg),`sequence 0 %: the picture (${seq0.avg})`);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({runtime:{zeroUnchanged:true,noValueUnchanged:true,flatUntinted:true,texture:{top:full.top,bottom:full.bottom},half:half.top,baseColour:greenFull.middle},single:{at100:single100.avg,at0:single0.avg},sequence:{at100:seq100.avg,at0:seq0.avg}}));
}finally{await browser.close()}
