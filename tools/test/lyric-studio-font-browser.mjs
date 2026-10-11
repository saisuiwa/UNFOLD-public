// The motion studio dialog ("モーション集・自作") offers a PC font and a font file, not only the six built-in fonts.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {startStaticServer} from '../lib/static-server.mjs';
import {launchBrowser} from '../lib/browser.mjs';
const FONT=new URL('../../app/vendor/motion-fonts/dot.ttf',import.meta.url).pathname;
const server=await startStaticServer(),browser=await launchBrowser();
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const problems=[];page.on('pageerror',e=>problems.push(String(e).slice(0,200)));
 await page.goto(server.url+'/sequence.html?empty',{waitUntil:'load'});await page.waitForFunction(()=>window.unfoldSeq,null,{timeout:60000});
 await page.evaluate(()=>unfoldSeq.lyricAction({type:'studio'}));
 const dialog=page.locator('dialog.motion-studio[open]');await dialog.waitFor({state:'visible'});
 const select=dialog.locator('select').filter({has:page.locator('option[value="dela"]')}).first();
 assert.deepEqual(await select.locator('option').evaluateAll(o=>o.map(x=>x.value).slice(0,6)),['gothic','mincho','round','dela','marker','dot']);
 assert.equal(await dialog.getByRole('button',{name:'PCのフォント'}).isVisible(),true);assert.equal(await dialog.getByRole('button',{name:'フォントファイル'}).isVisible(),true);
 await dialog.locator('input[type=file][accept*=".ttf"]').setInputFiles(FONT);
 await page.waitForFunction(()=>{const d=document.querySelector('dialog.motion-studio[open]');return [...d.querySelectorAll('select')].some(s=>/^file:/.test(s.value));},null,{timeout:30000});
 const chosen=await select.evaluate(s=>({value:s.value.slice(0,5),label:s.selectedOptions[0].textContent}));
 assert.equal(chosen.value,'file:');assert.match(chosen.label,/dot\.ttf/);
 assert.deepEqual(problems,[]);
 console.log('PASS motion studio: font file chosen and selected',chosen);
}finally{await browser.close();await server.close();}
