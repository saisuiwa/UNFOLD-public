import assert from 'node:assert/strict';
import {withStudioPage} from './browser-helper.mjs';
/** The old Sequence tab bar must keep its four tabs on one row and fit their labels; the STUDIO entry is a styled link outside the tablist. */
await withStudioPage(async(page,{server})=>{
 const measure=()=>page.evaluate(()=>{const tabs=document.querySelector('.tabs'),entry=document.querySelector('a.studio-entry');const items=[...tabs.children].map(el=>{const r=el.getBoundingClientRect(),cs=getComputedStyle(el);return {text:el.textContent.trim(),tag:el.tagName,top:Math.round(r.top),width:Math.round(r.width),height:Math.round(r.height),overflow:el.scrollWidth>el.clientWidth+1,wraps:el.getClientRects().length>0&&el.scrollHeight>el.clientHeight+2,color:cs.color,decoration:cs.textDecorationLine,radius:cs.borderTopLeftRadius};});const cs=entry&&getComputedStyle(entry),r=entry?.getBoundingClientRect();return {items,panel:Math.round(tabs.getBoundingClientRect().width),entry:entry&&{inTablist:!!entry.closest('[role=tablist]'),color:cs.color,decoration:cs.textDecorationLine,radius:cs.borderTopLeftRadius,width:Math.round(r.width),href:entry.getAttribute('href'),above:r.bottom<=tabs.getBoundingClientRect().top+1}};});
 for(const [w,h] of [[1440,1000],[1180,800]]){
  await page.setViewportSize({width:w,height:h});
  await page.goto(server.url+'/sequence.html');await page.waitForSelector('.tabs');
  const {items,panel,entry}=await measure();
  assert.equal(items.length,4,'the tablist holds exactly the four tabs');
  assert.ok(items.every(x=>x.tag==='BUTTON'),'only real tabs live in the tablist');
  const label=i=>`${w}px wide, panel ${panel}px: ${JSON.stringify(items.map(x=>[x.text,x.top,x.width]))}`;
  assert.equal(new Set(items.map(x=>x.top)).size,1,'all tabs on one row — '+label());
  assert.equal(new Set(items.map(x=>x.height)).size,1,'all tabs have the same height — '+label());
  for(const x of items){assert.equal(x.overflow,false,`label "${x.text}" overflows its tab — `+label());}
  assert.ok(entry,'STUDIO entry link exists');assert.equal(entry.href,'studio.html');assert.equal(entry.inTablist,false);assert.equal(entry.above,true,'the entry sits above the tabs');
  assert.notEqual(entry.color,'rgb(0, 0, 238)','the entry must not be the browser-default blue link');
  assert.equal(entry.decoration,'none');assert.notEqual(entry.radius,'0px','the entry is styled like a control');assert.ok(entry.width>=panel-2,'the entry spans the panel');
 }
 console.log('PASS sequence tab bar: four tabs on one row with fitting labels; STUDIO entry is a styled link outside the tablist');
});
