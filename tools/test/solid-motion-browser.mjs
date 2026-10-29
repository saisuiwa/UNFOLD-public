// 「立体の動き」 on the pages: with a motion the solid moves (GLSL methods and image-code methods alike), the flat picture never does,
// and 「なし」 draws exactly what an empty setting draws.
// Serve the repository root:  python3 -m http.server 8776 --bind 127.0.0.1   then  node tools/test/solid-motion-browser.mjs
import {chromium} from '../image-code-build/.test-deps/node_modules/playwright-core/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{
 const p=await browser.newPage({viewport:{width:1500,height:1000}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 // the image-code worker needs a moment: wait until two looks agree
 const settle=async(sel,draw)=>{await p.waitForTimeout(2000);let last=await look(sel,draw);for(let i=0;i<30;i++){await p.waitForTimeout(400);const h=await look(sel,draw);if(h===last)return h;last=h}throw Error('the preview never settled')};
 const look=(sel,draw)=>p.evaluate(([sel,draw])=>{if(draw==='single')unfold.render();else unfoldSeq.renderAt(draw);const c=document.querySelector(sel),o=document.createElement('canvas');o.width=c.width;o.height=c.height;const x=o.getContext('2d');x.drawImage(c,0,0);const d=x.getImageData(0,0,o.width,o.height).data;let h=2166136261;for(let i=0;i<d.length;i+=4)h=Math.imul(h^d[i]^(d[i+1]<<8)^(d[i+2]<<16),16777619);return h>>>0},[sel,draw]);
 const picture=`(()=>{const c=document.createElement('canvas');c.width=1280;c.height=720;const x=c.getContext('2d');const g=x.createLinearGradient(0,0,1280,720);g.addColorStop(0,'#1d6fa3');g.addColorStop(1,'#2fb38a');x.fillStyle=g;x.fillRect(0,0,1280,720);return c})()`;

 // ---- 1枚モード
 await p.goto('http://127.0.0.1:8776/app/');await p.waitForFunction(()=>window.unfoldMethods&&window.unfold);
 await p.evaluate(`new Promise(r=>${picture}.toBlob(r,'image/png')).then(b=>unfold.loadImage(new File([b],'blue.png',{type:'image/png'})))`);
 const shatter=await p.evaluate(()=>unfoldMethods.listCustom().find(r=>r.name==='爆砕と再誕')?.id);assert.ok(shatter,'爆砕と再誕 is bundled');
 const motion=kind=>p.evaluate(kind=>{const k=document.querySelector('[data-shot="motion.kind"]');k.value=kind;k.dispatchEvent(new Event('change'))},kind);
 const single={};
 for(const method of ['crumple',shatter]){
  if(method==='crumple')await p.locator('[data-method="crumple"]').first().click();else await p.locator(`[data-method="${method}"]`).first().click();
  await p.locator('[data-shape="c-hearts"]').first().click();await p.waitForFunction(()=>unfold.state.shape==='c-hearts');
  const r={};
  for(const t of [.02,.65]){await p.evaluate(t=>unfold.setTime(t),t);
   await motion('none');const none=await settle('#scene','single');await motion('hop');const hop=await settle('#scene','single');
   r[t]={none,hop};}
  single[method==='crumple'?'glsl':'imageCode']=r;
  assert.equal(r[.02].hop,r[.02].none,`${method}: the flat picture does not move`);
  assert.notEqual(r[.65].hop,r[.65].none,`${method}: the solid moves`);
 }
 await motion('none');

 // ---- シーケンス (beats count from the start of the ◆)
 await p.goto('http://127.0.0.1:8776/app/sequence.html?empty');await p.waitForFunction(()=>window.unfoldSeq&&window.unfoldMethods);
 const seq={};
 for(const method of ['crumple',shatter]){
  await p.evaluate(`(async()=>{const c=${picture};const s=unfoldSeq.seq;if(!s.slides.length){unfoldSeq.addSlide(c,'A');unfoldSeq.addSlide(c,'B');}s.bpm=120;s.slides.forEach(x=>x.hold=0);Object.assign(s.transitions[0],{shape:'c-hearts',beats:8,method:${JSON.stringify(method)},method2:''});s.selection={kind:'tr',i:0};await unfoldSeq.prepareShapes();unfoldSeq.refreshUI();})()`);
  const r={};
  for(const sec of [.03,2.1]){
   await p.evaluate(()=>{unfoldSeq.seq.transitions[0].shot={}});const none=await settle('#seq-canvas',sec);
   await p.evaluate(()=>{unfoldSeq.seq.transitions[0].shot={motion:{kind:'sway',amount:2}}});const sway=await settle('#seq-canvas',sec);
   r[sec]={none,sway};}
  seq[method==='crumple'?'glsl':'imageCode']=r;
  assert.equal(r[.03].sway,r[.03].none,`sequence ${method}: the flat picture does not move`);
  assert.notEqual(r[2.1].sway,r[2.1].none,`sequence ${method}: the solid sways`);
 }
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({single,seq}));
}finally{await browser.close()}
