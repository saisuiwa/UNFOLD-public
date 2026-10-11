// "05 STUDIO" in the sequence carries the whole piece (pictures, 崩れ方, song, lyrics) to STUDIO without a file.
import assert from 'node:assert/strict';
import {withStudioPage} from './browser-helper.mjs';
await withStudioPage(async(page,{server})=>{
 await page.goto(server.url+'/sequence.html?empty');await page.waitForFunction(()=>window.unfoldSeq);
 await page.evaluate(async()=>{
  const u=unfoldSeq;
  for(const [i,color] of ['#164f61','#c96542'].entries()){const c=new OffscreenCanvas(320,180),x=c.getContext('2d');x.fillStyle=color;x.fillRect(0,0,320,180);await u.addImageBlob(await c.convertToBlob(),'画像'+(i+1));}
  u.seq.slides.forEach(s=>s.hold=1);u.seq.transitions[0].beats=2;u.seq.transitions[0].method='crumple';u.seq.transitions[0].shape='heart';u.seq.bpm=120;
  const n=3*48000,buf=new ArrayBuffer(44+n*2),d=new DataView(buf),str=(i,s)=>[...s].forEach((v,j)=>d.setUint8(i+j,v.charCodeAt(0)));
  str(0,'RIFF');d.setUint32(4,buf.byteLength-8,true);str(8,'WAVE');str(12,'fmt ');d.setUint32(16,16,true);d.setUint16(20,1,true);d.setUint16(22,1,true);d.setUint32(24,48000,true);d.setUint32(28,96000,true);d.setUint16(32,2,true);d.setUint16(34,16,true);str(36,'data');d.setUint32(40,n*2,true);
  for(let i=0;i<n;i++)d.setInt16(44+i*2,Math.sin(i*2*Math.PI*440/48000)*3276,true);
  await u.loadAudio(new Blob([buf],{type:'audio/wav'}),'自作音.wav');
  await u.lyricAction({type:'text',value:'小さな光を\nつないで進もう'});
 });
 // the link still works as a plain link for a ctrl/cmd click, and a normal click sends the piece
 assert.equal(await page.getAttribute('#studio-entry','href'),'studio.html');
 await Promise.all([page.waitForURL(/studio\.html/),page.click('#studio-entry')]);
 await page.waitForSelector('[data-testid="save-status"]');
 await page.waitForFunction(()=>document.querySelector('[data-testid="clip-count"]')?.textContent==='1'&&location.search==='',null,{timeout:30000});
 const r=await page.evaluate(async()=>({
  url:location.search,
  lyrics:document.querySelectorAll('.timeline-block.lyric').length,
  music:[...document.querySelectorAll('.timeline-block.audio')].some(b=>/主曲/.test(b.textContent)),
  scenes:document.querySelectorAll('.timeline-block.scene').length,
  scene:document.querySelector('.timeline-block.scene .tl-sub')?.textContent||'',
  box:await (await import('/studio-handoff.js?v=1')).peekHandoff(),
 }));
 assert.equal(r.url,'','the address is cleaned, so a reload does not import again');
 assert.equal(r.lyrics,2,'both lyric lines arrived');
 assert.equal(r.music,true,'the song arrived as the main song');
 assert.equal(r.scenes,1);assert.match(r.scene,/◆\s*くしゃくしゃ \/ ハート/,'the 崩れ方 and the shape arrived');
 assert.equal(r.box,null,'the box was emptied once the piece was saved');
 const names=await page.evaluate(async()=>{const {openStudioStore}=await import('/studio/store.js');const st=await openStudioStore();const list=await st.listProjects();st.close();return list.map(p=>p.name);});assert.equal(names.length,1,'no empty leftover project: '+names.join());
 // a reload keeps the project (it was saved) and does not import a second one
 await page.reload({waitUntil:'load'});await page.waitForSelector('[data-testid="save-status"]');
 await page.waitForFunction(()=>document.querySelector('[data-testid="clip-count"]')?.textContent==='1',null,{timeout:30000});
 assert.equal(await page.locator('.timeline-block.lyric').count(),2);
 // an empty box says so instead of failing silently
 await page.goto(server.url+'/studio.html?from=sequence');await page.waitForSelector('[data-testid="save-status"]');
 await page.getByRole('status').filter({hasText:'見つかりません'}).waitFor();
 console.log('PASS 05 STUDIO: song, lyrics, pictures, 崩れ方 and shape arrive in STUDIO in one click; the box is emptied; empty box is explained');
});
