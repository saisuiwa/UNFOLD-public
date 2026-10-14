import {SAMPLES,aiTemplate} from './method-samples.js?v=12';
import {IMAGE_METHOD_PRESETS} from './image-method-presets.js';
import {CODE_MOTION_PRESETS,codeMotionPrompt} from './code-motion-presets.js';
import {LYRIC_PALETTES} from './lyric-style.js';
import {listModels} from './model-library.js?v=4';
import {readDrafts,writeDrafts,sampleEdited,colorFormats,loadWorkshopImage,assetStore,viewOf} from './workshop-data.js';
import {effectPrompt} from './effect-prompt.js';
import {createWorkshopPreview,testImage} from './workshop-preview.js';
import {savedWorkshopItems,addWorkshopItem,announceWorkshopItem,workshopFile,importedDrafts,WORKSHOP_EXAMPLES} from './workshop-library.js';
const $=id=>document.getElementById(id),node=(tag,text)=>Object.assign(document.createElement(tag),text==null?{}:{textContent:text});
const samples=[...SAMPLES.map(s=>({key:'sample:glsl:'+s.key,kind:'glsl',name:s.name,source:s.source})),...IMAGE_METHOD_PRESETS.map((s,i)=>({key:'sample:image:'+i,kind:'image',name:s.name,source:s.code.source,params:s.code.params,shape:s.previewShape||'sphere',thumb:s.thumbnail})),...CODE_MOTION_PRESETS.map((s,i)=>({key:'sample:text:'+i,kind:'text',name:s.name,source:s.source,...(s.shelf==='effect'?{shelf:'effect'}:{})})),...WORKSHOP_EXAMPLES];
const contentKey=d=>JSON.stringify([d.kind,d.name,d.source,d.params,d.motion,d.shape,d.strength,d.words,d.font,d.color,d.accent]);
let saving=false;
let state={active:'',drafts:{}},draft,saved=[],kind='glsl',view='glsl',storageOK=true,current=null,serial=0,playing=false,busy=false,time=0,checked='',last=0,libraryError='',assetRevision=0;
const preview=createWorkshopPreview($('preview-host')),assets=assetStore(),images={a:null,b:null,reference:null},urls={},assetVersions={};
const notice=(message,type='idle')=>{$('status').textContent=message;$('status').dataset.state=type};
const original=key=>samples.find(x=>x.key===key);
let resetShown=false;
// The button and the card follow whether the open sample has left the original; the list is only redrawn when that flips.
function syncReset(){const edited=!!(draft&&sampleEdited(draft,original(draft.key)));$('reset-sample').hidden=!edited;if(edited!==resetShown){resetShown=edited;cards()}}
function stash(){if(!draft)return;state.active=draft.key;state.drafts[draft.key]=structuredClone(draft);syncReset();if(!storageOK)return;try{writeDrafts(localStorage,state);$('draft-status').textContent='下書き保存済み'}catch(e){$('draft-status').textContent='保存できません';notice(e.message,'error')}}
function stop(message){serial++;playing=false;current=null;checked='';preview.dispose();$('preview-play').textContent='再生／一時停止';if(message)notice(message);}
function edit(){stop('変更しました。プレビューで確認してください。');draft.dirty=true;delete draft.thumb;draft.updated=Date.now();$('handoff').hidden=true;stash();}
const signature=()=>JSON.stringify([draft.kind,draft.source,draft.params,draft.words,draft.font,draft.color,draft.accent,draft.shape,draft.strength,draft.motion,assetRevision]);
function defaults(d){return {strength:.8,shape:'sphere',words:'かたちをほどいて/自由に。',font:'gothic',color:'#78ddff',accent:'#d9f878',...structuredClone(d),params:{...IMAGE_METHOD_PRESETS[0].code.params,...d.params}}}
function select(item){stash();stop();draft=defaults(state.drafts[item.key]||item);state.active=draft.key;kind=draft.kind;view=viewOf(draft);fill();stash();cards();notice('「プレビュー」で確認できます。コードはまだ実行していません。');}
function fill(){
 $('name').value=draft.name;$('name').maxLength=kind==='text'?40:20;$('code').value=draft.source;$('code').maxLength=kind==='glsl'?8000:32000;$('words').value=draft.words;$('font').value=draft.font;
 $('strength').value=draft.strength;$('shape').value=draft.shape;$('color').value=draft.color;$('hex').value=draft.color;$('accent').value=draft.accent;
 for(const k of ['columns','gravity','bounce','seed'])$(k).value=draft.params[k];$('return-mode').value=draft.params.returnMode;
 $('shape-field').hidden=kind!=='image';$('physics-settings').hidden=kind!=='image';$('text-settings').hidden=kind!=='text';$('handoff').hidden=true;
 $('engine-label').textContent=view==='effect'?'EFFECT':{glsl:'GLSL',image:'JS + PHYSICS',text:'TEXT MOTION'}[kind];document.querySelectorAll('[data-kind]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.kind===view)));$('shelf-note').hidden=view!=='effect';
 $('api-help').textContent={glsl:'vec3 userMethod(vec2 p,float amount) を1つ。amount 0で原画、最大0.8。hash / rot / cell / partC / ph。8000文字以内、forは各64回・合計256回。書き方、GPUコンパイル、負荷を確認します。',image:'api.THREE / Text / gsap / RAPIER。createImageTiles / createImagePlane / createText / physics.bind / floor / at。return {timeline,update(frame),physicsTime(frame)}。座標はワールド単位。表面の演出は「立体化なし」で確認し、工房から作品へ適用すると「立体化なし」も引き継ぎます。外部import・通信は使えません。',text:'api.THREE / Text / gsap / createText / text / runs / color / accent / width / height / duration。return {timeline,update(t)}。画面中心が原点、単位px。GSAPはpaused:true。外部import・通信は使えません。'}[kind];
 $('palette-help').textContent=kind==='text'?'文字色・強調色は次のプレビューに反映します。独自に固定した色はコードで変更してください。':'コードに使う色をコピーします。GLSLの位置メソッドや画像全体の色は自動変更しません。';$('color-code').textContent=colorFormats(draft.color).hex;
}
function diagram(index){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 256 144');svg.setAttribute('aria-hidden','true');const add=(tag,attrs)=>{const n=document.createElementNS(svg.namespaceURI,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);svg.append(n);return n};add('rect',{width:256,height:144,fill:'#0b191a'});add('path',{d:'M20 113H236 M20 72H236 M20 31H236',stroke:'#253d37','stroke-width':.5});for(let y=0;y<4;y++)for(let x=0;x<7;x++){const n=y*7+x,angle=(index%3===0?Math.sin(n)*15:index%3===1?(x-3)*9:Math.cos(n*3)*28),dx=Math.sin(n*(index+1))*(index%3+1)*4,dy=Math.cos(n+index)*9;add('rect',{x:41+x*24+dx,y:28+y*23+dy,width:17,height:17,rx:2,fill:['#d9f878','#78ddff','#9c9de7'][Math.floor(n/7)%3],opacity:.65+(n%3)*.12,transform:`rotate(${angle} ${50+x*24+dx} ${36+y*23+dy})`})}return svg;}
function cards(){
 const all=new Map(samples.map(x=>[x.key,x]));for(const x of saved)all.set(x.key,x);for(const x of Object.values(state.drafts))if(x.key&&!x.key.startsWith('sample:'))all.set(x.key,x);
 const query=$('search').value.trim().toLowerCase(),items=[...all.values()].filter(x=>viewOf(x)===view&&(!query||(state.drafts[x.key]||x).name.toLowerCase().includes(query)));$('card-count').textContent=items.length+' BLOCKS';$('cards').replaceChildren();
 items.forEach((item,i)=>{const d=state.drafts[item.key]||item,edited=item.key.startsWith('sample:')&&sampleEdited(state.drafts[item.key],item),b=node('button');b.className='card';b.dataset.card=item.key;b.setAttribute('aria-pressed',String(draft?.key===item.key));b.setAttribute('aria-label',item.key.startsWith('sample:')?d.name+' 選んでプレビュー':d.name+' 編集');
 if(d.thumb){const img=node('img');img.src=d.thumb;img.alt=d.name+'のプレビュー';b.append(img)}else b.append(diagram(i));
 const tag=node('span',edited?'EDITED':item.key.startsWith('sample:')?'SAMPLE':d.savedId?'MY METHOD':'DRAFT');tag.className='card-tag';const info=node('div');info.className='card-info';info.append(node('strong',d.name),node('small',edited?'編集した版 · 元に戻せます':d.thumb?'実際の描画から':item.key.startsWith('sample:')?'図解 · タップして試す':'下書き · 開いて編集'));b.append(tag,info);b.onclick=async()=>{select(item);if(item.key.startsWith('sample:')&&!draft.dirty&&draft.source===item.source)await run()};$('cards').append(b)});
}
function thumbnail(){if(!current)return;const c=document.createElement('canvas');c.width=256;c.height=144;c.getContext('2d').drawImage(current.canvas,0,0,256,144);draft.thumb=c.toDataURL('image/jpeg',.65);stash();cards();}
async function render(){if(!current||busy)return;busy=true;const own=serial,r=current;try{await r.render(time,Number($('strength').value));if(own===serial){$('time').value=time;$('clock').textContent=time.toFixed(2)+' / 6.00'}}catch(e){if(own===serial){stop();notice(e.message,'error')}}finally{busy=false}}
async function run(){stop();const own=serial,sig=signature();notice('コードと描画を確認しています…','loading');try{
 const r=await preview.prepare(structuredClone(draft),images);if(own!==serial)return;current=r;time=1.5;await r.render(time,Number($('strength').value));if(own!==serial)return;checked=sig;thumbnail();playing=true;notice('確認できました。再生・追加・共有ができます。','ready');
 }catch(e){if(own===serial){stop();notice(e.message,'error')}}}
$('preview-run').onclick=run;$('preview-stop').onclick=()=>stop('実行を終了しました。プレビューで再開できます。');$('preview-play').onclick=()=>{if(!current){notice('先にプレビューを押してください。');return}playing=!playing};$('time').oninput=()=>{playing=false;time=Number($('time').value);render()};$('strength').oninput=()=>{const wasChecked=checked===signature();draft.strength=Number($('strength').value);draft.dirty=true;delete draft.thumb;if(wasChecked)checked=signature();stash();render()};
$('name').oninput=()=>{draft.name=$('name').value;stash()};$('code').oninput=()=>{draft.source=$('code').value;edit()};$('code').onkeydown=e=>{if(e.key==='Tab'){e.preventDefault();const a=e.target;a.setRangeText('  ',a.selectionStart,a.selectionEnd,'end');a.dispatchEvent(new Event('input'))}};
for(const [id,k]of [['words','words'],['font','font'],['shape','shape']])$(id).oninput=()=>{draft[k]=$(id).value;edit()};
for(const k of ['columns','gravity','bounce','seed'])$(k).oninput=()=>{draft.params[k]=Number($(k).value);edit()};$('return-mode').onchange=()=>{draft.params.returnMode=$('return-mode').value;edit()};
$('search').oninput=cards;document.querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>{const item=Object.values(state.drafts).findLast(x=>viewOf(x)===b.dataset.kind)||samples.find(x=>viewOf(x)===b.dataset.kind);select(item)});
function newDraft(copy=false){const base=copy?draft:samples.find(x=>viewOf(x)===view);const d={...structuredClone(base),key:'draft:'+crypto.randomUUID(),name:copy?(draft.name+' コピー').slice(0,kind==='text'?40:20):view==='effect'?'新しいエフェクト':'新しいメソッド',dirty:true};delete d.savedId;delete d.thumb;select(d)}
$('new-draft').onclick=()=>newDraft();$('duplicate').onclick=()=>newDraft(true);
// A sample you edited stays on its card; this puts the original back (the edit is dropped, "コピーを作る" first keeps it).
$('reset-sample').onclick=async()=>{const sample=original(draft?.key);if(!sample||!confirm('「'+sample.name+'」への編集は消えて、元のサンプルに戻ります。\n残したいときは、先に「コピーを作る」を押してください。\n元に戻しますか？'))return;stop();delete state.drafts[sample.key];draft=null;select(sample);await run();if(current)notice('「'+sample.name+'」を元のサンプルに戻しました。再生・追加・共有ができます。','ready')};
async function copy(value){try{await navigator.clipboard.writeText(value);notice('コピーしました。')}catch{const area=node('textarea');area.value=value;area.setAttribute('aria-label','手動コピー用');$('status').after(area);area.focus();area.select();notice('コピーできませんでした。選択した文字を手動でコピーしてください。')}}
$('copy-code').onclick=()=>copy(draft.source);$('copy-prompt').onclick=()=>copy(kind==='glsl'?aiTemplate():view==='effect'?effectPrompt():kind==='text'?codeMotionPrompt():`UNFOLD画像メソッドのJavaScript関数本体を書いてください。外部importは不可。api.THREE, Text, gsap, RAPIER, root, size, params, createImageTiles, createImagePlane, createText, physics.bind/floor/at, random, returnTime, assemble が利用可能。return {timeline,physicsTime(frame),update(frame)}。timelineはpaused:true。frame.clipTime/duration/progress/amount/form/imageMix。サイズはワールド単位。最大32000文字。画像片と剛体は1024個以内。同じ時刻は同じ結果に。独自の物理step、実時間、累積加算は避ける。画像片はcreateImageTilesで作れば既存の立体へ集合する。createImagePlaneのマテリアルはShaderMaterialで、material.color/opacityだけでは画像の色や透明度は変わらない。表面の色・穴はfragmentShaderとuniformsで実装する。表面演出は工房と作品で立体化なしを指定する。\n参考:\n${draft.source}\n希望する動き：`);
function colorChange(value){try{const f=colorFormats(value);draft.color=f.hex;$('color').value=f.hex;$('hex').value=f.hex;$('color-code').textContent=f.hex;if(kind==='text')edit();else stash()}catch(e){notice(e.message,'error')}}
$('color').oninput=()=>colorChange($('color').value);$('hex').onchange=()=>colorChange($('hex').value);$('accent').oninput=()=>{draft.accent=$('accent').value;if(kind==='text')edit();else stash()};
for(const p of LYRIC_PALETTES){const b=node('button');b.title=p.name;b.setAttribute('aria-label','配色 '+p.name);b.style.setProperty('--a',p.color);b.style.setProperty('--b',p.emphasisColor);b.onclick=()=>{draft.accent=p.emphasisColor;$('accent').value=p.emphasisColor;colorChange(p.color)};$('palettes').append(b)}
document.querySelectorAll('[data-copy-color]').forEach(b=>b.onclick=()=>{try{const value=colorFormats($('hex').value)[b.dataset.copyColor];$('color-code').textContent=value;copy(value)}catch(e){notice(e.message,'error')}});
const nextAssetVersion=key=>assetVersions[key]=(assetVersions[key]||0)+1;
async function showAsset(key,value,persist=true,mine=nextAssetVersion(key)){
 if(mine!==assetVersions[key])return false;
 if(persist)await assets.put(key,value);
 if(mine!==assetVersions[key])return false;
 if(!value){images[key]=null;if(urls[key])URL.revokeObjectURL(urls[key]);delete urls[key];$('thumb-'+key).hidden=true;return true;}
 const loaded=await loadWorkshopImage(new File([value.blob],value.name,{type:value.blob.type}));if(mine!==assetVersions[key])return false;images[key]=loaded.canvas;if(urls[key])URL.revokeObjectURL(urls[key]);urls[key]=URL.createObjectURL(loaded.blob);$('thumb-'+key).src=urls[key];$('thumb-'+key).hidden=false;return true;
}
for(const key of ['a','b','reference'])$('image-'+key).onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;const mine=nextAssetVersion(key);try{const loaded=await loadWorkshopImage(file);if(!await showAsset(key,{blob:loaded.blob,name:loaded.name},true,mine))return;if(key!=='reference'){assetRevision++;edit()}notice('画像を読み込み、このブラウザに保存しました。')}catch(error){notice(error.message,'error')}};
$('reference-use').onclick=async()=>{const mine=nextAssetVersion('a');try{const value=await assets.get('reference');if(!value)throw Error('先に参照画像を選んでください。');if(!await showAsset('a',value,true,mine))return;assetRevision++;edit()}catch(e){notice(e.message,'error')}};
$('reset-images').onclick=async()=>{try{await Promise.all(['a','b'].map(k=>showAsset(k,null)));assetRevision++;edit()}catch(e){notice(e.message,'error')}};
function requireChecked(){if(!checked||checked!==signature())throw Error('現在のコードと設定をプレビューしてから追加してください。')}
$('add-unfold').onclick=async()=>{
 if(saving)return;
 try{
  requireChecked();saving=true;$('add-unfold').disabled=true;
  const submitted=structuredClone(draft),revision=JSON.stringify(submitted),receipt=await addWorkshopItem(submitted);
  const completed={...submitted,savedId:receipt.id,dirty:false,key:'saved:'+receipt.id};
  const unchanged=draft.key===submitted.key&&JSON.stringify(draft)===revision;
  const destination=state.drafts[completed.key],keepDestination=destination&&completed.key!==submitted.key&&contentKey(destination)!==contentKey(submitted);
  // A duplicate save must not replace independent edits on an existing saved card.
  if(keepDestination)completed.key=submitted.key;
  // A slow save owns only its submitted revision; switching or editing never transfers its identity.
  if(receipt.previousId&&JSON.stringify(state.drafts[submitted.key])===revision)delete state.drafts[submitted.key];
  if(unchanged)draft=completed;
  if(completed.key!==submitted.key||JSON.stringify(state.drafts[submitted.key])===revision)state.drafts[completed.key]=completed;
  stash();saved=await savedWorkshopItems();cards();announceWorkshopItem(receipt);
  if(draft===completed){$('handoff').hidden=false;$('open-single').hidden=receipt.kind==='text';$('open-single').href='./?workshopMethod='+encodeURIComponent(receipt.id);$('open-sequence').href='./sequence.html?'+(receipt.kind==='text'?'workshopMotion=':'workshopMethod=')+encodeURIComponent(receipt.id);}
  notice('「'+submitted.name+'」をUNFOLDに追加しました。'+(keepDestination?'保存済みカードの編集中の内容も残しています。':receipt.previousId?'変更前のブロックも残しています。':'本体で選んだブロックに使えます。'),current?'ready':'idle');
 }catch(e){notice(e.message,'error')}finally{saving=false;$('add-unfold').disabled=false}
};
$('export-file').onclick=()=>{try{requireChecked();const value=workshopFile(draft),url=URL.createObjectURL(new Blob([value.text],{type:'application/json'})),a=node('a');a.href=url;a.download=(draft.name.replace(/[\\/:*?"<>|]/g,'')||'method')+value.extension;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}catch(e){notice(e.message,'error')}};
let pendingImport=null,importSerial=0;
function acceptImports(items){
 const incoming=items.map(d=>defaults({...d,key:'draft:'+crypto.randomUUID(),dirty:true}));
 // Match only unchanged content and settings: never overwrite an edited draft or a saved item.
 const identity=contentKey;
 stash();const added=incoming.map(d=>{const same=Object.values(state.drafts).find(old=>old.key.startsWith('draft:')&&identity(defaults(old))===identity(d));if(same)return same;state.drafts[d.key]=d;return d});
 select(added[0]);notice('名前・種類・設定を読み込みました。内容を確認してプレビューしてください。');
}
$('js-import-dialog').addEventListener('close',()=>{
 const pending=pendingImport;pendingImport=null;if(!pending||$('js-import-dialog').returnValue!=='import')return;
 try{acceptImports(importedDrafts(pending.text,{fileName:pending.name,kind:$('js-import-kind').value}))}catch(e){notice(e.message,'error')}
});
$('import-file').onclick=()=>$('file-import').click();$('file-import').onchange=async e=>{
 const f=e.target.files[0];e.target.value='';if(!f)return;const mine=++importSerial;
 try{
  if(f.size>2e6)throw Error('読み込むファイルは2MB以内にしてください。');
  const text=await f.text();if(mine!==importSerial)return;
  try{acceptImports(importedDrafts(text,{fileName:f.name}))}catch(error){
   if(error.code!=='JS_KIND_REQUIRED')throw error;
   pendingImport={text,name:f.name};$('js-import-name').textContent=f.name;$('js-import-kind').value='';$('js-import-dialog').returnValue='';$('js-import-dialog').showModal();
  }
 }catch(error){notice(error.message,'error')}
};
function tick(now){const dt=Math.min(.1,(now-last)/1000);last=now;if(playing&&current&&!busy&&!document.hidden){time=(time+dt)%6;render()}requestAnimationFrame(tick)}
addEventListener('visibilitychange',()=>{if(document.hidden)stop('非表示になったため実行を停止しました。')});addEventListener('pagehide',()=>{stash();stop();Object.values(urls).forEach(u=>URL.revokeObjectURL(u))});
// A sample's draft stored by an older workshop has no `shelf` (the effect shelf did not exist yet), so the saved copy would pull an effect back onto the 文字モーション tab. The sample says which shelf it is on.
function syncSampleShelves(){for(const x of Object.values(state.drafts)){const base=x&&original(x.key);if(!base)continue;if(base.shelf)x.shelf=base.shelf;else delete x.shelf}}
async function boot(){try{state=readDrafts(localStorage);syncSampleShelves()}catch(e){storageOK=false;libraryError=e.message}try{saved=await savedWorkshopItems()}catch(e){libraryError+=' '+e.message}try{for(const m of await listModels())$('shape').append(new Option('GLB：'+m.name,m.id))}catch(e){libraryError+=' GLB一覧を読み込めません。'}
 for(const key of ['a','b','reference'])try{await showAsset(key,await assets.get(key),false)}catch(e){libraryError+=' 保存した画像を読み込めません。'}
 select(state.drafts[state.active]||samples[0]);document.querySelector('main').inert=false;if(libraryError)notice(libraryError,'error');requestAnimationFrame(tick);
}
boot().catch(e=>notice(e.message,'error'));
