import {chromium} from '../image-code-build/.test-deps/node_modules/playwright-core/index.mjs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const glb=await readFile(process.env.UNFOLD_TEST_GLB||'/tmp/unfold-elephant.glb');
const out=new URL('../out/workshop/',import.meta.url).pathname;await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{
 const p=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('crash',()=>errors.push('page crash'));
 await p.route('**/local-test-elephant.glb',r=>r.fulfill({body:glb,contentType:'model/gltf-binary'}));
 await p.goto('http://127.0.0.1:8778/workshop.html');await p.waitForFunction(()=>document.querySelector('#code')?.value);
 const id=await p.evaluate(async()=>{const {saveModel}=await import('./model-library.js?v=4');return (await saveModel('ゾウ（検証）',await (await fetch('./local-test-elephant.glb')).arrayBuffer(),191498,'')).id});
 await p.reload();await p.waitForFunction(()=>document.querySelector('#code')?.value);
 await p.locator('[data-kind=image]').click();let frames=0;
 for(let i=0;i<3;i++){
  await p.locator('[data-card="sample:image:'+i+'"]').click();await p.locator('#preview-stop').click();
  for(const shape of [id,'sphere']){
   await p.locator('#shape').selectOption(shape);await p.locator('#preview-run').click();
   await p.waitForFunction(()=>document.querySelector('#status')?.dataset.state==='ready',null,{timeout:30000});
   await p.locator('#preview-play').click();await p.locator('#time').fill('3');
   await p.waitForFunction(()=>document.querySelector('#clock')?.textContent.startsWith('3.00'));
   frames++;if(i===0&&shape===id)await p.locator('#preview-host').screenshot({path:out+'elephant.png'});
   await p.locator('#preview-stop').click();assert.equal(await p.locator('iframe').count(),0);
  }
 }
 await p.setViewportSize({width:390,height:844});await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:out+'mobile-top.png'});
 await p.locator('.stage').scrollIntoViewIfNeeded();await p.screenshot({path:out+'mobile-preview.png'});
 await p.locator('.editor').scrollIntoViewIfNeeded();await p.screenshot({path:out+'mobile-editor.png'});
 const layout=await p.evaluate(()=>({headings:document.querySelectorAll('h1').length,width:document.documentElement.scrollWidth,viewport:innerWidth,panels:[...document.querySelectorAll('.workspace>.panel')].map(n=>({class:n.className,top:n.getBoundingClientRect().top+scrollY,height:n.getBoundingClientRect().height}))}));
 assert.equal(layout.headings,1);assert.ok(layout.width<=layout.viewport);assert.deepEqual(errors,[]);
 const report={elephantAndSphereFrames:frames,errors,layout};await writeFile(out+'glb-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close()}
