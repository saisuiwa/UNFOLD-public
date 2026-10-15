// The sequence's 「05 曲・歌詞」 tab after the clean-up: no second music picker, no おまかせ / per-lyric panel (STUDIO has them), the numbers are 05 and 06,
// and hiragana lyrics can be turned into kanji-kana lyrics with an AI's answer pasted back (ids and timings stay, one Undo).
import assert from 'node:assert/strict';
import {startStaticServer} from '../lib/static-server.mjs';
import {launchBrowser} from '../lib/browser.mjs';
const server=await startStaticServer(),browser=await launchBrowser();
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),problems=[];
 page.on('pageerror',e=>problems.push(String(e).slice(0,200)));
 await page.goto(server.url+'/sequence.html?empty',{waitUntil:'load'});await page.waitForFunction(()=>window.unfoldSeq,null,{timeout:60000});
 // the clean-up
 assert.equal(await page.locator('#seq-audio').count(),0,'the left music picker is gone');
 assert.equal(await page.locator('.audio-pick').count(),0);
 const tabs=await page.locator('.tabs [data-tab]').allTextContents();
 assert.deepEqual(tabs.map(t=>t.trim()),['03 選択中','04 見た目','05 曲・歌詞','動画保存・GLB追加']);
 assert.match((await page.locator('#studio-entry').textContent()).trim(),/^06 STUDIO/);
 await page.locator('.tabs [data-tab="lyric"]').click();
 assert.equal(await page.locator('#lm-quick').count(),0,'the per-lyric panel is STUDIO\'s now');
 for(const label of ['読みやすく','元気に','やわらかく'])assert.equal(await page.getByRole('button',{name:label,exact:true}).count(),0,label);
 assert.equal(await page.getByRole('button',{name:'モーション集・自作'}).count(),0,'the sequence has no 歌詞の見え方 (motions are decided in STUDIO)');
 assert.equal(await page.getByText('歌詞の見え方').count(),0);assert.equal(await page.getByLabel('歌詞を表示').count(),0);
 assert.equal(await page.locator('#pane-lyric .lm-section h3').allTextContents().then(a=>a.map(t=>t.replace(/\s/g,''))).then(a=>a.join('|')),'1曲を入れる|2歌詞を入れる|3曲に合わせる');
 assert.equal(await page.getByRole('button',{name:'この歌詞をその場で編集'}).count(),0);
 // a song still loads from the tab
 assert.equal(await page.locator('#pane-lyric input[type=file][accept="audio/*"]').count(),1);
 // kanji
 await page.evaluate(async()=>{
  const u=unfoldSeq;await u.lyricAction({type:'text',value:'いちまいの えを ここにおいて\nぐしゃっと *くずれて* ほどけだす\nこなごなの いろが/ふりそそぐ'});
  const e=u.seq.lyricDocument.events.find(x=>x.kind==='line');await u.lyricAction({type:'edit',id:e.id,patch:{s:1.5,e:3.5}});
 });
 // each lyric row: no 区分 (A/Bメロ・サビ), no per-line lock, and the only motion to pick is 「一文字ずつ」 (the rest is decided in STUDIO)
 await page.locator('.lm-event').first().evaluate(d=>{d.open=true});
 const row=page.locator('.lm-event').first();
 assert.equal(await row.getByText('区分',{exact:true}).count(),0,'no section select');
 assert.equal(await row.locator('select[aria-label="この行の区分"]').count(),0);
 assert.equal(await row.getByRole('button',{name:/動きを固定|固定を解除/}).count(),0,'no per-line lock');
 const selects=await row.locator('select').evaluateAll(els=>els.map(s=>({label:s.parentElement.firstChild.textContent,options:[...s.options].filter(o=>!o.disabled).map(o=>o.textContent),placeholder:[...s.options].filter(o=>o.disabled).map(o=>o.textContent),value:s.value})));
 const picker=selects.find(x=>x.label==='動き');
 assert.deepEqual(picker?.options,['一文字ずつ'],'one motion to pick; the others are STUDIO\'s');
 assert.deepEqual(picker?.placeholder,[],'typed lines are plain 一文字ずつ: no STUDIO motion is assigned in the sequence');
 assert.equal(picker?.value,'reveal');
 assert.deepEqual(await page.evaluate(()=>unfoldSeq.seq.lyricDocument.events.filter(e=>e.kind==='line').map(e=>[e.motion?.preset,!!e.motion?.recipe,!!e.motion?.code])),[['reveal',false,false],['reveal',false,false],['reveal',false,false]],'every typed line is reveal, without a recipe or code');
 // a line locked by an older version can still be set free (the lock itself is not offered any more)
 await page.evaluate(async()=>{const u=unfoldSeq,e=u.seq.lyricDocument.events.find(x=>x.kind==='line');await u.lyricAction({type:'edit',id:e.id,patch:{locked:true}});});
 await page.waitForFunction(()=>unfoldSeq.seq.lyricDocument.events.find(x=>x.kind==='line').locked===true);
 const legacy=page.locator('.lm-event').first();await legacy.evaluate(d=>{d.open=true});
 await legacy.getByRole('button',{name:'固定を解除'}).click();
 await page.waitForFunction(()=>unfoldSeq.seq.lyricDocument.events.find(x=>x.kind==='line').locked===false);
 assert.equal(await page.locator('.lm-event').first().getByRole('button',{name:'固定を解除'}).count(),0);
 const before=await page.evaluate(()=>unfoldSeq.seq.lyricDocument.events.filter(e=>e.kind==='line').map(e=>({id:e.id,raw:e.raw,s:e.s,e:e.e})));
 await page.locator('.lm-kanji > summary').click();
 await page.getByRole('button',{name:'① 依頼文を作ってコピー'}).click();
 const request=await page.locator('textarea[aria-label="AIに貼る依頼文"]').inputValue();
 assert.match(request,/行数と行の順番は変えない/);assert.ok(request.includes('ぐしゃっと *くずれて* ほどけだす'));
 // a wrong line count is refused, with the numbers
 await page.locator('textarea[aria-label="AIが直した歌詞"]').fill('一枚の 絵を ここに置いて\nぐしゃっと *崩れて* ほどけだす');
 await page.getByRole('button',{name:'③ 確認する'}).click();
 assert.match(await page.locator('.lm-kanji .lm-status').innerText(),/歌詞は 3 行、貼り付けは 2 行/);
 await page.getByRole('button',{name:'④ この歌詞にする'}).click();
 assert.match(await page.locator('.lm-kanji .lm-status').innerText(),/先に「確認する」/);
 assert.equal(await page.evaluate(()=>unfoldSeq.seq.lyricDocument.events.filter(e=>e.kind==='line')[0].raw),'いちまいの えを ここにおいて','nothing changed');
 // the right answer is shown line by line and applied
 await page.locator('textarea[aria-label="AIが直した歌詞"]').fill('```\n一枚の 絵を ここに置いて\nぐしゃっと *崩れて* ほどけだす\nこなごなの 色が/降りそそぐ\n```');
 await page.getByRole('button',{name:'③ 確認する'}).click();
 assert.equal(await page.locator('.lm-kanji-row.changed').count(),3);
 await page.getByRole('button',{name:'④ この歌詞にする'}).click();
 await page.waitForFunction(()=>unfoldSeq.seq.lyricDocument.events.filter(e=>e.kind==='line')[0].raw==='一枚の 絵を ここに置いて');
 const after=await page.evaluate(()=>unfoldSeq.seq.lyricDocument.events.filter(e=>e.kind==='line').map(e=>({id:e.id,raw:e.raw,text:e.text,s:e.s,e:e.e,runs:e.runs.map(r=>r.text+(r.emphasis?'*':'')).join('|')})));
 assert.deepEqual(after.map(x=>x.id),before.map(x=>x.id),'the same lines (ids)');
 assert.deepEqual(after.map(x=>[x.s,x.e]),before.map(x=>[x.s,x.e]),'the timings did not move');
 assert.equal(after[1].raw,'ぐしゃっと *崩れて* ほどけだす');assert.equal(after[1].text,'ぐしゃっと 崩れて ほどけだす');assert.match(after[1].runs,/崩れて\*/,'the emphasis mark survived');
 assert.equal(await page.evaluate(()=>unfoldSeq.seq.lyricDocument.sourceText.includes('こなごなの 色が/降りそそぐ')),true);
 // one Undo takes all three lines back
 await page.evaluate(()=>unfoldSeq.undo());
 await page.waitForFunction(()=>unfoldSeq.seq.lyricDocument.events.filter(e=>e.kind==='line')[0].raw==='いちまいの えを ここにおいて');
 const undone=await page.evaluate(()=>unfoldSeq.seq.lyricDocument.events.filter(e=>e.kind==='line').map(e=>e.raw));
 assert.deepEqual(undone,before.map(x=>x.raw));
 // a document that already holds recipes (older projects picked them automatically): the sequence plays it plain, the document itself is not changed
 const view=await page.evaluate(async()=>{
  const {BUILTIN_MOTIONS}=await import('./lyric-recipe.js'),url=performance.getEntriesByType('resource').map(r=>r.name).find(n=>/\/lyric-motion\.js/.test(n)),{plainLyricView}=await import(url),u=unfoldSeq;
  await u.lyricAction({type:'recipe-apply',motion:BUILTIN_MOTIONS[5].motion});
  const doc=u.seq.lyricDocument,lines=doc.events.filter(e=>e.kind==='line'),plain=plainLyricView(doc).events.filter(e=>e.kind==='line');
  return {stored:lines.map(e=>!!e.motion.recipe),shown:plain.map(e=>[e.motion.preset,!!e.motion.recipe,!!e.motion.code]),same:plainLyricView(doc)===plainLyricView(doc)};
 });
 assert.deepEqual(view.stored,[true,true,true],'the document keeps the recipes (STUDIO gets them as they are)');
 assert.deepEqual(view.shown,[['reveal',false,false],['reveal',false,false],['reveal',false,false]],'what the sequence shows is plain');
 assert.equal(view.same,true);
 await page.locator('.lm-event').first().evaluate(d=>{d.open=true});
 assert.deepEqual(await page.locator('.lm-event').first().locator('select:has(option[value="reveal"]) option:disabled').allTextContents(),['STUDIOで決める動き'],'a line that holds a STUDIO motion says so');
 // lyrics switched off by an older version can be switched on again (the 歌詞を表示 box is gone)
 await page.evaluate(()=>unfoldSeq.lyricAction({type:'settings',patch:{enabled:false}}));
 await page.waitForFunction(()=>unfoldSeq.seq.lyricDocument.enabled===false);
 await page.getByRole('button',{name:'歌詞を表示する'}).click();
 await page.waitForFunction(()=>unfoldSeq.seq.lyricDocument.enabled===true);
 assert.equal(await page.getByRole('button',{name:'歌詞を表示する'}).isVisible(),false);
 assert.deepEqual(problems,[]);
 console.log('PASS sequence lyric tab: clean-up, numbers, plain 一文字ずつ only, kanji paste-back with kept timings and one Undo');
}finally{await browser.close();await server.close();}
