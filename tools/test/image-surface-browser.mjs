import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const {chromium}=await import(new URL('../../.worktrees/method-workshop/tools/image-code-build/.test-deps/node_modules/playwright-core/index.mjs',import.meta.url));
const out=fileURLToPath(new URL('../out/surface-study/',import.meta.url));await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const errors=[];
try{
 const p=await browser.newPage({viewport:{width:1440,height:1050}});p.on('pageerror',e=>errors.push(e.message));p.on('crash',()=>errors.push('page crash'));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await p.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));await p.goto('http://127.0.0.1:8779/workshop.html');await p.waitForFunction(()=>document.querySelector('main')&&!document.querySelector('main').inert);
 const count=await p.evaluate(async()=>{const {IMAGE_METHOD_PRESETS}=await import('./image-method-presets.js');return IMAGE_METHOD_PRESETS.filter(x=>x.previewShape==='none').length});assert.equal(count,8,'surface samples must be available');
 const results=await p.evaluate(async()=>{
  const {createImageMethodRuntime}=await import('./image-method-runtime.js'),{imageFrame}=await import('./image-method-format.js'),{IMAGE_METHOD_PRESETS}=await import('./image-method-presets.js'),THREE=await import('./vendor/three.module.min.js');
  const image=document.createElement('canvas');image.width=640;image.height=360;const x=image.getContext('2d');const g=x.createLinearGradient(0,0,640,360);g.addColorStop(0,'#ffae73');g.addColorStop(.46,'#367cc8');g.addColorStop(1,'#14483e');x.fillStyle=g;x.fillRect(0,0,640,360);x.fillStyle='#f5ddb1';x.beginPath();x.arc(460,90,55,0,Math.PI*2);x.fill();x.fillStyle='#183a48';x.beginPath();x.moveTo(0,290);x.lineTo(155,100);x.lineTo(330,310);x.lineTo(420,210);x.lineTo(640,330);x.lineTo(640,360);x.lineTo(0,360);x.fill();x.fillStyle='#fff5e4';x.font='bold 60px sans-serif';x.fillText('UNFOLD',40,260);x.font='16px sans-serif';x.fillText('SURFACE / MATERIAL STUDY',44,290);
  const second=document.createElement('canvas');second.width=640;second.height=360;const sx=second.getContext('2d');sx.fillStyle='#804020';sx.fillRect(0,0,640,360);
  const camera=new THREE.OrthographicCamera(-4,4,2.25,-2.25,.1,100);camera.position.z=10;camera.updateMatrixWorld();const c=document.createElement('canvas');c.width=800;c.height=450;const ctx=c.getContext('2d',{willReadFrequently:true});
  const config=(t,amount)=>({...imageFrame(t,6,amount??.8),width:800,height:450,bg:'#101819',camera:{projection:camera.projectionMatrix.toArray(),world:camera.matrixWorld.toArray()}}),results=[];
  for(const preset of IMAGE_METHOD_PRESETS.filter(x=>x.previewShape==='none')){
   let runtime=createImageMethodRuntime();const frames=[];let original;
   try{
    await runtime.prepare({code:preset.code,imageA:image,imageB:image,size:{width:6.4,height:3.6},target:null});
    for(const [time,amount] of [[0,.8],[.9,.8],[1.8,.8],[2.7,.8],[3.6,.8],[5.6,.8],[6,.8],[1.8,.8],[1.8,0]]){
     const start=performance.now(),b=await runtime.render(config(time,amount));ctx.clearRect(0,0,800,450);ctx.drawImage(b,0,0);b.close();const bytes=ctx.getImageData(0,0,800,450).data;original??=bytes;let hash=2166136261,changed=0,hole=0;
     for(let i=0;i<bytes.length;i+=4){for(let j=0;j<4;j++)hash=Math.imul(hash^bytes[i+j],16777619);if(Math.abs(bytes[i]-original[i])+Math.abs(bytes[i+1]-original[i+1])+Math.abs(bytes[i+2]-original[i+2])>35)changed++;if(original[i]>35&&Math.abs(bytes[i]-16)<3&&Math.abs(bytes[i+1]-24)<3&&Math.abs(bytes[i+2]-25)<3)hole++;}
     frames.push({time,amount,hash,changed,hole,ms:Math.round(performance.now()-start),png:c.toDataURL().split(',')[1]});
    }
    runtime.dispose();runtime=createImageMethodRuntime();await runtime.prepare({code:preset.code,imageA:image,imageB:second,size:{width:6.4,height:3.6},target:null});const b=await runtime.render(config(6));ctx.drawImage(b,0,0);b.close();const end=Array.from(ctx.getImageData(400,225,1,1).data);results.push({name:preset.name,frames,end});
   }finally{runtime.dispose()}
  }
  return results;
 });
 for(let i=0;i<results.length;i++){const {name,frames,end}=results[i];for(let j=0;j<frames.length;j++){await writeFile(out+i+'-'+j+'.png',Buffer.from(frames[j].png,'base64'));delete frames[j].png;}assert.ok(frames[2].changed>2000,name+' visible effect');assert.equal(frames[0].hash,frames[6].hash,name+' endpoint restoration');assert.equal(frames[2].hash,frames[7].hash,name+' deterministic seeking');assert.equal(frames[0].hash,frames[8].hash,name+' amount zero');assert.ok(end.slice(0,3).every((n,j)=>Math.abs(n-[128,64,32][j])<=1),name+' B image restored');}
 if(errors.length)console.error(errors.join('\n'));assert.equal(new Set(results.map(r=>r.frames[2].hash)).size,8,'eight distinct looks');
 await p.locator('[data-kind="image"]').click();
 for(let i=3;i<11;i++){await p.locator('[data-card="sample:image:'+i+'"]').click();await p.waitForFunction(()=>['ready','error'].includes(document.querySelector('#status')?.dataset.state),null,{timeout:30000});assert.equal(await p.locator('#status').getAttribute('data-state'),'ready',await p.locator('#status').innerText());assert.equal(await p.locator('#shape').inputValue(),'none');await p.locator('#time').fill('1.8');await p.waitForFunction(()=>document.querySelector('#clock').textContent.startsWith('1.80'));await p.locator('#preview-host').screenshot({path:out+'workshop-'+(i-3)+'.png'});}
 await p.locator('#add-unfold').click();await p.locator('#handoff').waitFor();
 await p.evaluate(async()=>{const {createImageMethodEditor}=await import('./image-method-editor.js');window.testEditor=createImageMethodEditor({});window.testEditor.openImage()});
 await p.getByLabel('画像モーションのサンプル',{exact:true}).selectOption('3');assert.equal(await p.getByLabel('プレビューの立体',{exact:true}).inputValue(),'none');assert.equal(await p.getByRole('dialog').getByLabel('重力',{exact:true}).inputValue(),'0');
 await p.getByRole('button',{name:'プレビュー',exact:true}).last().click();await p.waitForFunction(()=>document.querySelector('.image-method-dialog [role="status"]')?.textContent.includes('確認できました'),null,{timeout:30000});
 await p.getByLabel('画像モーションのサンプル',{exact:true}).selectOption('0');assert.equal(await p.getByLabel('プレビューの立体',{exact:true}).inputValue(),'sphere');assert.equal(await p.getByRole('dialog').getByLabel('重力',{exact:true}).inputValue(),'4');await p.evaluate(()=>window.testEditor.close());
 assert.deepEqual(errors,[]);await writeFile(out+'results.json',JSON.stringify({results,errors},null,2));console.log(JSON.stringify(results.map(r=>({name:r.name,changed:r.frames[2].changed,hole:r.frames[2].hole,maxMs:Math.max(...r.frames.map(f=>f.ms))}))));console.log('surface rendering, seek, endpoints, zero strength, image B, cards, save, editor defaults PASS');
}finally{await browser.close()}
