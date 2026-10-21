// 新しいMVの素材: 「新しいMV」を押すと、歌（MP3 など）・歌詞ファイル（LRC / SRT / JSON / TXT）・画像と動画を選ぶ窓が出る。
// 選んだものは作品に入る（歌が作品の長さを決め、歌詞はその時刻に、絵は曲の頭から同じ長さずつ順に）。何も選ばずに「あとで入れる」でも始められ、
// かんたんの素材の欄の「♪ 歌を入れる」「歌詞ファイルを入れる」から、あとで入れられる（入っている時は確かめてから差し替え、元に戻すで戻る）。
// 動画を足しても歌詞は消えない（作者の報告「シーケンスで歌と歌詞を入れて、スタジオで動画を入れると歌詞が消えて…」の確かめ）。
import assert from 'node:assert/strict';import {withStudioPage} from './browser-helper.mjs';import {makeMediaFixtures} from './media-fixtures.mjs';
const wav=seconds=>{const rate=48000,n=Math.round(seconds*rate),b=Buffer.alloc(44+n*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVE',8);b.write('fmt ',12);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);for(let i=0;i<n;i++)b.writeInt16LE(Math.round(.12*Math.sin(2*Math.PI*220*i/rate)*32767),44+i*2);return {mimeType:'audio/wav',buffer:b};};
const text=(name,body)=>({name,mimeType:'text/plain',buffer:Buffer.from(body,'utf8')});
await withStudioPage(async page=>{
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.evaluate(async()=>{
  const {createController}=await import('/studio/controller.js'),{openStudioStore}=await import('/studio/store.js'),{mountStudio}=await import('/studio/view.js');
  const root=document.createElement('main');document.body.replaceChildren(root);for(const href of ['/studio.css','/lyric-controls.css?v=3']){const css=document.createElement('link');css.rel='stylesheet';css.href=href;document.head.append(css);}
  try{localStorage.removeItem('unfold-studio-current');}catch{}
  window.c=createController({store:await openStudioStore({dbName:'unfold-studio-new-mv-materials'})});mountStudio(root,c);await c.ready;
 });
 await makeMediaFixtures(page);
 const state=()=>page.evaluate(()=>{const p=c.get().project;return {id:p.id,durationUs:p.durationUs,music:p.audio.filter(a=>a.role==='music').map(a=>({startUs:a.startUs,endUs:a.endUs,name:p.assets[a.assetId]?.name})),lyrics:p.lyrics.map(l=>({text:l.text,startUs:l.startUs,endUs:l.endUs,timingSource:l.timingSource,preset:l.motion?.preset})),scenes:p.scenes.map(s=>[s.startUs,s.endUs]),clips:p.clips.map(x=>({kind:x.kind,name:x.name,scene:p.scenes.findIndex(s=>s.id===x.sceneId)})),source:p.audio.filter(a=>a.role==='source').map(a=>a.muted),locks:p.locks};});
 // the easy panel: the song and lyric file buttons are there in かんたん, with a hint that names the formats
 assert.equal(await page.locator('.studio-root').getAttribute('data-mode'),'easy');
 for(const id of ['song-add','lyric-file-add'])assert.equal(await page.getByTestId(id).isVisible(),true,id+' in かんたん');
 assert.match(await page.locator('.easy-only').innerText(),/MP3[\s\S]*LRC \/ SRT \/ JSON \/ TXT/);
 // 1) 新しいMV (the open work is empty, so no question first) → the materials window
 const first=(await state()).id;
 await page.getByTestId('new-project').click();
 const fill=page.locator('dialog.fill-new');await fill.waitFor();
 assert.match(await fill.innerText(),/歌（MP3 など）[\s\S]*歌詞ファイル（LRC \/ SRT \/ JSON \/ TXT）[\s\S]*画像・動画/);
 assert.equal(await page.getByTestId('new-fill-ok').isDisabled(),true,'nothing chosen yet: only あとで入れる starts');
 assert.equal(await page.getByTestId('new-fill-later').isEnabled(),true);
 // the song through its 選ぶ… button, the lyrics and pictures straight into their inputs
 const [chooser]=await Promise.all([page.waitForEvent('filechooser'),fill.locator('.pick-row').nth(0).getByRole('button',{name:'選ぶ…'}).click()]);
 await chooser.setFiles({name:'うた.wav',...wav(12)});
 await page.getByTestId('new-lyrics').setInputFiles(text('うた.lrc','[ti:テスト]\n[00:01.00]一行目のひかり\n[00:04.50]二行目のかぜ\n[00:08.00]三行目のそら\n'));
 await page.evaluate(async()=>{const dt=new DataTransfer();for(const [i,color] of ['#1d5d73','#b8573a'].entries()){const cv=new OffscreenCanvas(320,180),x=cv.getContext('2d');x.fillStyle=color;x.fillRect(0,0,320,180);dt.items.add(new File([await cv.convertToBlob()],`絵${i+1}.png`,{type:'image/png'}));}dt.items.add(new File([mediaFixtures.get('av')],'動画.mp4',{type:'video/mp4'}));const input=document.querySelector('[data-testid=new-media]');input.files=dt.files;input.dispatchEvent(new Event('change'));});
 assert.match(await fill.innerText(),/うた\.wav[\s\S]*うた\.lrc[\s\S]*絵1\.png、絵2\.png、動画\.mp4/,'the chosen file names are shown');
 // a video is among them: its own sound must be decided before starting
 assert.equal(await page.getByTestId('new-source-audio').isVisible(),true);assert.equal(await page.getByTestId('new-fill-ok').isDisabled(),true);
 await page.getByTestId('new-source-audio').selectOption('mute');assert.equal(await page.getByTestId('new-fill-ok').isEnabled(),true);
 await page.screenshot({path:'tools/out/studio/new-mv-materials.png'});
 await page.getByTestId('new-fill-ok').click();
 await fill.waitFor({state:'detached',timeout:30000});
 const a=await state();
 assert.notEqual(a.id,first,'a new work');
 assert.equal(a.durationUs,12e6,'the song decides the length');
 assert.deepEqual(a.music,[{startUs:0,endUs:12e6,name:'うた.wav'}]);
 assert.deepEqual(a.lyrics.map(l=>[l.text,l.startUs,l.endUs,l.timingSource,l.preset]),[['一行目のひかり',1e6,4.5e6,'file','reveal'],['二行目のかぜ',4.5e6,8e6,'file','reveal'],['三行目のそら',8e6,12e6,'file','reveal']],'the LRC times, read as the sequence reads them');
 assert.deepEqual(a.scenes,[[0,4e6],[4e6,8e6],[8e6,12e6]],'one after another, the same length each');
 assert.deepEqual(a.clips.map(x=>[x.kind,x.name,x.scene]),[['image','絵1.png',0],['image','絵2.png',1],['video','動画.mp4',2]]);
 assert.deepEqual(a.source,[true],'the video sound is muted as chosen');
 assert.deepEqual(a.locks,{music:true,lyrics:true},'the locks stay on');
 assert.equal(await page.locator('.timeline-block.lyric').count(),3);
 assert.match(await page.locator('.notice').innerText(),/新しいMVに歌、歌詞3行（時刻つき）、画像・動画3つを入れました/);
 assert.equal(await page.getByTestId('omakase-panel').isVisible(),true,'nothing selected: the right panel offers おまかせ next');
 await page.screenshot({path:'tools/out/studio/new-mv-materials-filled.png'});
 // 2) the work with content asks first; then あとで入れる opens an empty work
 await page.getByTestId('new-project').click();await page.locator('dialog.confirm-new').waitFor();await page.getByTestId('new-project-ok').click();
 await fill.waitFor();await page.getByTestId('new-fill-later').click();await fill.waitFor({state:'detached'});
 const b=await state();
 assert.notEqual(b.id,a.id);assert.deepEqual([b.music.length,b.lyrics.length,b.scenes.length],[0,0,0]);
 assert.equal(await page.getByTestId('back-to-previous').isVisible(),true);assert.match(await page.locator('.notice').innerText(),/前の作品「新しいMV」は保存してあります/);
 // 3) later, from the panel: the song, then a plain TXT (times are 仮; an unknown heading is left out and counted)
 const [songChooser]=await Promise.all([page.waitForEvent('filechooser'),page.getByTestId('song-add').click()]);await songChooser.setFiles({name:'あとの歌.wav',...wav(15)});
 await page.waitForFunction(()=>c.get().project.durationUs===15e6);
 await page.locator('.notice',{hasText:/歌「あとの歌\.wav」を入れました（15秒）/}).waitFor();
 await page.getByTestId('lyric-file').setInputFiles(text('歌詞.txt','朝の光\n[Chorus]\n新しい空\n[Hook]\nもう一度\n'));
 await page.waitForFunction(()=>c.get().project.lyrics.length===3);
 const t=await state();
 assert.deepEqual(t.lyrics.map(l=>[l.text,l.timingSource]),[['朝の光','provisional'],['新しい空','provisional'],['もう一度','provisional']]);
 assert.ok(t.lyrics.at(-1).endUs<=15e6&&t.lyrics[1].startUs>=4e6,'spread over the song');
 await page.locator('.notice',{hasText:/歌詞3行（時刻は仮：曲全体に等間隔）。歌詞か見出しか分からない1行は入れていません/}).waitFor();
 // the song is replaced after a question (still one song, the new length); the lyrics whose times are all 仮 are spread over the new length
 let asked='';page.once('dialog',d=>{asked=d.message();d.accept();});const [again]=await Promise.all([page.waitForEvent('filechooser'),page.getByTestId('song-add').click()]);await again.setFiles({name:'差し替え.wav',...wav(20)});
 await page.waitForFunction(()=>c.get().project.durationUs===20e6);
 assert.match(asked,/いまの曲「あとの歌\.wav」を、「差し替え\.wav」に差し替えますか/);
 const s=await state();assert.deepEqual(s.music,[{startUs:0,endUs:20e6,name:'差し替え.wav'}]);assert.deepEqual(s.locks,{music:true,lyrics:true});
 assert.deepEqual(s.lyrics.map(l=>[l.startUs,l.endUs,l.timingSource]),t.lyrics.map(l=>[Math.round(l.startUs*20/15),Math.round(l.endUs*20/15),'provisional']));assert.equal(s.lyrics.at(-1).endUs,20e6);
 await page.locator('.notice',{hasText:/時刻が仮の歌詞は、曲の長さに合わせて並べ直しました/}).waitFor();
 await page.evaluate(()=>c.undo());await page.waitForFunction(()=>c.get().project.durationUs===15e6);assert.deepEqual((await state()).lyrics,t.lyrics,'one undo puts the song and the lyric times back');
 await page.evaluate(()=>c.redo());await page.waitForFunction(()=>c.get().project.durationUs===20e6);
 // an SRT replaces them after a question; saying no changes nothing, one undo brings the old lines back
 page.once('dialog',d=>d.dismiss());await page.getByTestId('lyric-file').setInputFiles(text('字幕.srt','1\n00:00:02,000 --> 00:00:05,000\nそらへ\n\n2\n00:00:06,500 --> 00:00:09,000\nとどけ\n'));
 await page.waitForTimeout(500);assert.equal((await state()).lyrics[0].text,'朝の光','no: nothing changes');
 asked='';page.once('dialog',d=>{asked=d.message();d.accept();});await page.getByTestId('lyric-file').setInputFiles(text('字幕2.srt','1\n00:00:02,000 --> 00:00:05,000\nそらへ\n\n2\n00:00:06,500 --> 00:00:09,000\nとどけ\n'));
 await page.waitForFunction(()=>c.get().project.lyrics.length===2);
 assert.match(asked,/いまの歌詞（3行）を、「字幕2\.srt」の歌詞に置き換えますか/);
 assert.deepEqual((await state()).lyrics.map(l=>[l.text,l.startUs,l.endUs,l.timingSource]),[['そらへ',2e6,5e6,'file'],['とどけ',6.5e6,9e6,'file']]);
 await page.evaluate(()=>c.undo());await page.waitForFunction(()=>c.get().project.lyrics.length===3);
 assert.equal((await state()).locks.lyrics,true,'undo brings the old lyrics back in one step, lock still on');
 await page.evaluate(()=>c.redo());await page.waitForFunction(()=>c.get().project.lyrics.length===2);
 // 4) a video added afterwards (at the playhead, as 「＋ 画像・動画」 does): the lyrics stay and are still drawn
 await page.locator('select[aria-label="動画元音声"]').selectOption('use');
 await page.evaluate(()=>c.seek(2.5e6));
 const bytes=await page.evaluate(async()=>[...new Uint8Array(await mediaFixtures.get('av').arrayBuffer())]);
 const [videoChooser]=await Promise.all([page.waitForEvent('filechooser'),page.getByRole('button',{name:'＋ 画像・動画',exact:true}).click()]);await videoChooser.setFiles({name:'あとの動画.mp4',mimeType:'video/mp4',buffer:Buffer.from(bytes)});
 await page.waitForFunction(()=>c.get().project.clips.some(x=>x.kind==='video'),null,{timeout:30000});
 const v=await state();assert.deepEqual(v.lyrics.map(l=>l.text),['そらへ','とどけ'],'the lyrics are still there after a video');
 assert.equal(await page.locator('.timeline-block.lyric').count(),2);
 const drawn=await page.evaluate(async()=>{const {createCompositor}=await import('/studio/compositor.js'),{createMediaReader}=await import('/studio/media.js'),{openStudioStore}=await import('/studio/store.js');const store=await openStudioStore({dbName:'unfold-studio-new-mv-materials'}),media=createMediaReader(store),comp=createCompositor({assets:store,media}),p=structuredClone(c.get().project);
  const ink=async q=>{await comp.prepare(q);const f=await comp.render({projectUs:3.5e6,viewId:'wide',width:480,height:270,epoch:0}),cv=new OffscreenCanvas(480,270),x=cv.getContext('2d');x.drawImage(f.bitmap,0,0);f.close();return x.getImageData(0,0,480,270).data;};
  try{const withLyrics=await ink(p),without=await ink({...p,lyrics:[]});let changed=0;for(let i=0;i<withLyrics.length;i+=4)if(Math.abs(withLyrics[i]-without[i])+Math.abs(withLyrics[i+1]-without[i+1])+Math.abs(withLyrics[i+2]-without[i+2])>60)changed++;return changed;}finally{comp.dispose();media.dispose();store.close();}});
 assert.ok(drawn>200,'the lyric is drawn over the video: '+drawn+' pixels differ');
 await page.screenshot({path:'tools/out/studio/new-mv-materials-later.png'});
 await page.evaluate(()=>c.dispose());
 assert.deepEqual(errors,[]);
 console.log('PASS 新しいMVの素材: the window after 新しいMV puts the song, lyric file (LRC) and pictures/video in; あとで入れる starts empty; the panel adds a song, TXT/SRT lyrics (asks before replacing, one undo) and replaces the song (仮 lyric times follow the new length); a video added later keeps the lyrics drawn');
},{mode:null});
