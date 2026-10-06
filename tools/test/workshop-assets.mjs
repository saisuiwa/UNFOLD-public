import {chromium} from '../image-code-build/.test-deps/node_modules/playwright-core/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{
 const p=await browser.newPage();await p.goto('http://127.0.0.1:8778/workshop.html');await p.waitForFunction(()=>document.querySelector('#code')?.value);
 const png=await p.evaluate(()=>['red','blue'].map(color=>{const c=document.createElement('canvas');c.width=c.height=16;const x=c.getContext('2d');x.fillStyle=color;x.fillRect(0,0,16,16);return c.toDataURL().split(',')[1]}));
 const delay=()=>p.evaluate(()=>{const original=HTMLImageElement.prototype.decode;let first=true;HTMLImageElement.prototype.decode=async function(){if(first){first=false;await new Promise(r=>window.releaseImage=r)}return original.call(this)}});
 const input=async i=>p.locator('#image-a').setInputFiles({name:i?'blue.png':'red.png',mimeType:'image/png',buffer:Buffer.from(png[i],'base64')});
 await delay();await input(0);await p.waitForFunction(()=>window.releaseImage);await input(1);await p.locator('#thumb-a').waitFor();await p.evaluate(()=>window.releaseImage());await p.waitForTimeout(200);
 const pixel=()=>p.locator('#thumb-a').evaluate(i=>{const c=document.createElement('canvas');c.width=c.height=1;const x=c.getContext('2d');x.drawImage(i,0,0,1,1);return [...x.getImageData(0,0,1,1).data]});
 assert.deepEqual(await pixel(),[0,0,255,255],'late first file must not replace latest image');
 await p.reload();await p.locator('#thumb-a').waitFor();assert.deepEqual(await pixel(),[0,0,255,255]);
 await delay();await input(0);await p.waitForFunction(()=>window.releaseImage);await p.locator('#reset-images').click();await p.locator('#thumb-a').waitFor({state:'hidden'});await p.evaluate(()=>window.releaseImage());await p.waitForTimeout(200);assert.equal(await p.locator('#thumb-a').isVisible(),false);
 console.log('image selection race and reset persistence PASS');
}finally{await browser.close()}
