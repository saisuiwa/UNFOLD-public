import assert from 'node:assert/strict';
import {withStudioPage} from './browser-helper.mjs';
/**
 * Opening a project gives its assets new ids. Only REFERENCES to assets may change: a settings key or a text that happens
 * to equal an asset id (here the asset id "orbit" and the camera setting cam.orbit) must stay exactly as authored.
 */
await withStudioPage(async page=>{
 const r=await page.evaluate(async()=>{
  const {openStudioStore}=await import('/studio/store.js'),{createController}=await import('/studio/controller.js'),{createProject,newLayout}=await import('/studio/model.js'),{blobHash}=await import('/studio/assets.js'),{writeStudioFile}=await import('/studio/file.js');
  const canvas=new OffscreenCanvas(64,36),ctx=canvas.getContext('2d');ctx.fillStyle='#456';ctx.fillRect(0,0,64,36);
  const png=await canvas.convertToBlob({type:'image/png'});
  const pid='11111111-1111-4111-8111-111111111111',blobs=new Map(),p=createProject({id:pid,durationUs:6e6});
  for(const id of ['orbit','sky']){blobs.set(id,png);p.assets[id]={id,projectId:pid,type:'image/png',name:id+'.png',byteLength:png.size,hash:await blobHash(png)};}
  p.scenes=[{id:'s',startUs:0,endUs:6e6,originUs:0}];
  p.clips=[
   {id:'u',name:'orbit',sceneId:'s',kind:'unfold',startUs:0,endUs:6e6,sourceInUs:0,effectOriginUs:0,unfoldId:'un',opacity:1,z:0,seed:7},
   {id:'t',name:'sky',sceneId:'s',kind:'text',startUs:0,endUs:6e6,sourceInUs:0,effectOriginUs:0,text:'orbit',motion:{font:'gothic',color:'#ffffff'},opacity:1,z:1,seed:7}];
  for(const v of Object.values(p.views))for(const c of p.clips)v.layout[c.id]=newLayout();
  p.unfolds.un={id:'un',version:1,dependencies:['orbit','sky'],state:{settings:{bpm:120,holdBeats:2,strength:.8,fill:true,bg:'#111718',cam:{persp:.12,orbit:.08}},slides:[{img:'orbit'},{img:'sky'}],transitions:[{method:'fold',shape:'none',beats:4}],methods:[],modelAssets:{},fontAssets:{}}};
  const parts=[];await writeStudioFile(p,{get:async id=>blobs.get(id)},{write:async x=>parts.push(x),close:async()=>{},abort:async()=>{}},{});
  localStorage.removeItem('unfold-studio-current');
  const store=await openStudioStore({dbName:'unfold-studio-open-remap'}),c=createController({store});await c.ready;
  await c.openFile(new File(parts,'colliding-ids.unfoldstudio'));
  const q=c.get().project,u=Object.values(q.unfolds)[0],ids=Object.keys(q.assets);
  const out={cam:u.state.settings.cam,camKeys:Object.keys(u.state.settings.cam),text:q.clips.find(x=>x.kind==='text').text,clipName:q.clips.find(x=>x.kind==='unfold').name,
   slidesAreOwnedIds:u.state.slides.every(s=>ids.includes(s.img)&&!['orbit','sky'].includes(s.img)),
   depsAreOwnedIds:u.dependencies.every(d=>ids.includes(d)&&!['orbit','sky'].includes(d)),
   assetKeysRenamed:!ids.includes('orbit')&&!ids.includes('sky'),assetCount:ids.length,metaIdsMatchKeys:ids.every(k=>q.assets[k].id===k),
   status:c.get().saveStatus,message:c.get().message};
  await c.dispose();return out;
 });
 assert.deepEqual(r.cam,{persp:.12,orbit:.08},'camera setting cam.orbit must survive opening a project');
 assert.equal(r.text,'orbit','text equal to an asset id must stay unchanged');
 assert.equal(r.clipName,'orbit','a clip name equal to an asset id must stay unchanged');
 assert.equal(r.slidesAreOwnedIds,true);assert.equal(r.depsAreOwnedIds,true);assert.equal(r.assetKeysRenamed,true);
 assert.equal(r.assetCount,2);assert.equal(r.metaIdsMatchKeys,true);assert.equal(r.status,'保存済み');
 console.log('PASS open keeps authored settings/text that equal an asset id; every asset reference gets the new id');
});
