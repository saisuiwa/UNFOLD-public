import {chromium} from '../image-code-build/.test-deps/node_modules/playwright-core/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{const p=await browser.newPage({viewport:{width:1500,height:1000}});await p.goto('http://127.0.0.1:8778/workshop.html');await p.getByRole('heading',{name:'メソッド工房',exact:true}).waitFor({timeout:3000});
await p.locator('#preview-run').click();await p.waitForFunction(()=>document.querySelector('#status')?.dataset.state==='ready');assert.equal(await p.locator('#preview-host canvas').count(),1);
await p.locator('#code').fill('vec3 userMethod(vec2 p,float amount){return vec3(p,amount);}');await p.reload();assert.match(await p.locator('#code').inputValue(),/return vec3\(p,amount\)/);assert.equal(await p.locator('iframe').count(),0);
await p.locator('[data-kind=image]').click();assert.equal(await p.locator('iframe').count(),0);await p.locator('#preview-run').click();await p.waitForFunction(()=>document.querySelector('#status')?.dataset.state==='ready',null,{timeout:30000});assert.equal(await p.locator('iframe').count(),1);await p.locator('#preview-stop').click();assert.equal(await p.locator('iframe').count(),0);
await p.locator('[data-kind=text]').click();await p.locator('#preview-run').click();await p.waitForFunction(()=>document.querySelector('#status')?.dataset.state==='ready',null,{timeout:30000});await p.locator('#preview-stop').click();assert.equal(await p.locator('iframe').count(),0);
console.log('workshop basic: GLSL/image/text, draft reload, explicit run and stop PASS');
}finally{await browser.close()}
