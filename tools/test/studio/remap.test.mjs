import test from 'node:test';
import assert from 'node:assert/strict';
import {remapAssetIds} from '../../../app/studio/remap.js';
import {collectAssetRefs} from '../../../app/studio/assets.js';
import {createProject} from '../../../app/studio/model.js';

const ids=['orbit','sky','eye','gothicFont','glbShape','lyricPic','track'];
function project(){
 const p=createProject({id:'p',durationUs:6e6});
 for(const id of ids)p.assets[id]={id,projectId:'p',type:'x/y',byteLength:1,hash:'h-'+id,name:id+'.bin'};
 p.clips=[
  {id:'c1',name:'orbit',kind:'image',assetId:'sky',text:'orbit',motion:{font:'gothic',fontAssetId:'gothicFont'},settings:{note:'eye'}},
  {id:'c2',name:'sky',kind:'unfold',unfoldId:'u1'}];
 p.lyrics=[{id:'l1',text:'sky',runs:[{text:'eye'}],motion:{font:'local:x',fontAssetId:'gothicFont'}}];
 p.audio=[{id:'a1',role:'music',assetId:'track'}];
 p.unfolds.u1={id:'u1',version:1,dependencies:['eye','sky','glbShape','gothicFont','lyricPic'],state:{
  settings:{cam:{persp:.12,orbit:.08},bg:'#111718'},
  slides:[{img:'eye'},{img:'sky',lyric:{img:'lyricPic',text:'orbit'}}],
  transitions:[{method:'fold',shape:'glb-1',beats:4}],
  modelAssets:{'glb-1':'glbShape'},fontAssets:{'local:x':'gothicFont'}}};
 return p;
}
const map=new Map(ids.map(id=>[id,'new-'+id]));

test('every asset reference gets the new id',()=>{
 const q=remapAssetIds(project(),map);
 assert.deepEqual(Object.keys(q.assets).sort(),ids.map(i=>'new-'+i).sort());
 assert.ok(Object.entries(q.assets).every(([k,m])=>m.id===k));
 assert.equal(q.clips[0].assetId,'new-sky');
 assert.equal(q.clips[0].motion.fontAssetId,'new-gothicFont');
 assert.equal(q.lyrics[0].motion.fontAssetId,'new-gothicFont');
 assert.equal(q.audio[0].assetId,'new-track');
 const u=q.unfolds.u1;
 assert.deepEqual(u.dependencies,['new-eye','new-sky','new-glbShape','new-gothicFont','new-lyricPic']);
 assert.deepEqual(u.state.slides.map(s=>[s.img,s.lyric?.img]),[['new-eye',undefined],['new-sky','new-lyricPic']]);
 assert.deepEqual(u.state.modelAssets,{'glb-1':'new-glbShape'});
 assert.deepEqual(u.state.fontAssets,{'local:x':'new-gothicFont'});
});

test('authored keys and texts that equal an asset id are untouched',()=>{
 const q=remapAssetIds(project(),map);
 assert.deepEqual(q.unfolds.u1.state.settings.cam,{persp:.12,orbit:.08});
 assert.equal(q.clips[0].name,'orbit');assert.equal(q.clips[0].text,'orbit');assert.equal(q.clips[0].settings.note,'eye');
 assert.equal(q.clips[1].name,'sky');
 assert.equal(q.lyrics[0].text,'sky');assert.equal(q.lyrics[0].runs[0].text,'eye');
 assert.equal(q.unfolds.u1.state.slides[1].lyric.text,'orbit');
});

test('the set of referenced assets is the mapped original set, and the input is not modified',()=>{
 const original=project(),before=structuredClone(original),q=remapAssetIds(original,map);
 assert.deepEqual(original,before);
 assert.deepEqual([...collectAssetRefs(q)].sort(),[...collectAssetRefs(original)].map(i=>'new-'+i).sort());
 for(const ref of collectAssetRefs(q))assert.ok(q.assets[ref],ref);
});

test('documents the old behaviour: rewriting every key and value corrupted authored data',()=>{
 const rewriteEverything=(value,m)=>{const r=v=>{if(Array.isArray(v))return v.map(r);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[m.get(k)||k,r(x)]));return typeof v==='string'&&m.has(v)?m.get(v):v;};return r(value);};
 const old=rewriteEverything(project(),map);
 assert.equal(old.unfolds.u1.state.settings.cam.orbit,undefined,'cam.orbit was lost');
 assert.equal(old.clips[0].text,'new-orbit','text was rewritten');
});
