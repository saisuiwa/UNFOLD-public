import assert from 'node:assert/strict';
import {withStudioPage} from './browser-helper.mjs';
/**
 * Two code-motion clips at the same time on two layers: a text-less background effect and a text motion.
 * Both must show up, and the layer order (z) must decide which one is on top.
 */
await withStudioPage(async page=>{
 const r=await page.evaluate(async()=>{
  const {createCompositor}=await import('/studio/compositor.js'),{createProject,newLayout}=await import('/studio/model.js');
  const {DAILY_CODE_MOTIONS}=await import('/code-motion-daily.js'),{approveStudioCode}=await import('/studio/code-trust.js');
  const source=key=>DAILY_CODE_MOTIONS.find(m=>m.key===key).source;
  // a plain red plate that fills the frame, to make the stacking order unmistakable
  const plate='const {THREE,scene,width,height}=api;const m=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({color:0xff0000,depthTest:false,depthWrite:false}));m.position.z=-10;m.renderOrder=-5;scene.add(m);return {update(){},dispose(){m.geometry.dispose();m.material.dispose();scene.remove(m);}};';
  for(const s of [source('bg-square-tunnel'),source('kn-slam'),plate])approveStudioCode(s);
  const clip=(id,z,src,text)=>({id,name:id,kind:'text',sceneId:'s',startUs:0,endUs:4e6,sourceInUs:0,effectOriginUs:0,opacity:1,z,seed:7,settings:{},text,runs:[{id,text}],
    motion:{font:'gothic',color:'#ffffff',emphasisColor:'#c5f377',code:{version:1,source:src}}});
  const render=async clips=>{
   const p=createProject();p.scenes=[{id:'s',startUs:0,endUs:4e6,originUs:0}];p.clips=clips;
   for(const v of Object.values(p.views))for(const c of clips)v.layout[c.id]=newLayout();
   const compositor=createCompositor({assets:{get:async()=>{throw Error('no assets expected');}}});
   await compositor.prepare(p);
   const f=await compositor.render({projectUs:1.6e6,viewId:'wide',width:480,height:270,epoch:1});
   const canvas=new OffscreenCanvas(480,270),x=canvas.getContext('2d');x.drawImage(f.bitmap,0,0);f.close();
   const d=x.getImageData(0,0,480,270).data,layers=compositor.stats().layers;compositor.dispose();
   const bg=[0x11,0x17,0x18];let changed=0,red=0,white=0,hash=2166136261;
   for(let i=0;i<d.length;i+=4){
    const diff=Math.abs(d[i]-bg[0])+Math.abs(d[i+1]-bg[1])+Math.abs(d[i+2]-bg[2]);if(diff>40)changed++;
    if(d[i]>200&&d[i+1]<60&&d[i+2]<60)red++;if(d[i]>220&&d[i+1]>220&&d[i+2]>220)white++;
    hash=Math.imul(hash^d[i]^(d[i+1]<<8)^(d[i+2]<<16),16777619);
   }
   return {changed,red,white,layers,hash};
  };
  const tunnel=await render([clip('bg',0,source('bg-square-tunnel'),' ')]);
  const words=await render([clip('tx',0,source('kn-slam'),'語ごとにドンと落ちる')]);
  const both=await render([clip('bg',0,source('bg-square-tunnel'),' '),clip('tx',1,source('kn-slam'),'語ごとにドンと落ちる')]);
  const plateUnder=await render([clip('plate',0,plate,' '),clip('tx',1,source('kn-slam'),'語ごとにドンと落ちる')]);
  const plateOver=await render([clip('plate',1,plate,' '),clip('tx',0,source('kn-slam'),'語ごとにドンと落ちる')]);
  return {tunnel,words,both,plateUnder,plateOver};
 });
 assert.ok(r.tunnel.changed>1500,'the background draws something on its own: '+r.tunnel.changed);
 assert.ok(r.words.changed>400&&r.words.white>200,'the text motion draws its words on its own');
 assert.equal(r.both.layers,2,'two code-motion layers are live at the same time');
 assert.ok(r.both.changed>Math.max(r.tunnel.changed,r.words.changed),'together they show more than either one alone');
 assert.ok(r.both.changed>=.6*(r.tunnel.changed+r.words.changed),'both layers contribute');
 // the stacking order: a full-frame red plate hides the words when it is above and not when it is below
 assert.ok(r.plateUnder.white>200,'words stay visible above a plate: '+r.plateUnder.white);
 assert.equal(r.plateOver.white,0,'a plate above the words hides them');
 assert.ok(r.plateOver.red>r.plateUnder.red,'and the plate then fills the frame');
 console.log('PASS layered code motions: background + text motion at once, z decides the stacking order');
});
