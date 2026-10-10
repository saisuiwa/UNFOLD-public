import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.UNFOLD_PLAYWRIGHT_PATH||'/Volumes/ORICO/UNFOLD/.worktrees/method-workshop/tools/image-code-build/.test-deps/node_modules/playwright-core/index.mjs');
const out=fileURLToPath(new URL('../out/workshop-collection/text/',import.meta.url));await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.UNFOLD_CHROMIUM||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{
 const p=await browser.newPage();await p.goto((process.env.UNFOLD_BASE_URL||'http://127.0.0.1:8780/')+'workshop.html');await p.waitForFunction(()=>!document.querySelector('main').inert);
 const results=[];
 for(const key of await p.evaluate(async()=>(await import('./workshop-examples.js')).WORKSHOP_EXAMPLES.filter(x=>x.kind==='text').map(x=>x.key))){
  const rows=await p.evaluate(async key=>{
   const {WORKSHOP_EXAMPLES}=await import('./workshop-examples.js'),{createCodeMotionRuntime}=await import('./code-motion-runtime.js'),{getCodeMotionFont}=await import('./lyric-fonts.js'),{codeFrameInput}=await import('./code-motion-layer.js'),{lyricRuns}=await import('./lyric-document.js?v=4'),{motionOf}=await import('./workshop-library.js');
   const item=WORKSHOP_EXAMPLES.find(x=>x.key===key),results=[];
   const cases=[{name:'short',words:'*朝*',font:'gothic',duration:6,width:800,height:450},{name:'long',words:'明日の光が少しずつ街を染めてゆくそれでも私たちは同じ空を見上げながら新しい言葉を探して歩き続ける',font:'mincho',duration:6,width:800,height:450},{name:'multiline',words:'*色*づく朝/君と歩く道/星を編む夜',font:'round',duration:2,width:390,height:693}];
   for(const c of cases){
    const runs=lyricRuns(c.words);if(runs.length)runs[0].color='#ff3344';const event={start:0,end:c.duration,text:runs.map(x=>x.text).join(''),runs,motion:motionOf({...item,font:c.font,color:'#00ccff',accent:'#ffee00'})};
    const input=t=>codeFrameInput(event,t,{width:c.width,height:c.height});const params=input(0).params,fontBytes=await getCodeMotionFont(c.font);
    const runtime=createCodeMotionRuntime(),canvas=document.createElement('canvas');canvas.width=c.width;canvas.height=c.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});const frames=[];
    try{await runtime.prepare({...params,fontBytes});for(const f of [0,.4,.55,.8,.4,1]){const bitmap=await runtime.render(input(f*c.duration).time);ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(bitmap,0,0);bitmap.close();const pixels=ctx.getImageData(0,0,c.width,c.height).data;let hash=2166136261,visible=0,red=0,cyan=0;for(let i=0;i<pixels.length;i++){hash=Math.imul(hash^pixels[i],16777619);if(i%4===3&&pixels[i]>20){visible++;if(pixels[i-3]>180&&pixels[i-2]<170&&pixels[i-1]<190)red++;if(pixels[i-3]<100&&pixels[i-2]>110&&pixels[i-1]>110)cyan++;}}frames.push({f,hash,visible,red,cyan,...(f===.55?{png:canvas.toDataURL().split(',')[1]}:{})});}}
    finally{runtime.dispose()}
    // Actual Troika bounds after font sync and ancestor transforms; only the readable hold section.
    const wrapped=`const labels=[];const make=api.createText;api={...api,createText(...args){const label=make(...args);labels.push(label);return label}};const result=(()=>{${item.source}\n})();const previous=result.update;return {...result,update(t){previous?.(t);api.scene.updateMatrixWorld(true);if(t/api.duration>.35&&t/api.duration<.7){for(const label of labels){if(!label.visible||label.fillOpacity<.2)continue;let on=true;for(let p=label.parent;p;p=p.parent)if(!p.visible)on=false;if(!on)continue;const b=label.textRenderInfo?.blockBounds;if(!b)continue;if(label.text.length>30&&b[2]-b[0]>api.width*.9)throw Error('TEXT_NOT_WRAPPED');for(const x of [b[0],b[2]])for(const y of [b[1],b[3]]){const v=new api.THREE.Vector3(x,y,0).applyMatrix4(label.matrixWorld).project(api.camera);if(Math.abs(v.x)>1.02||Math.abs(v.y)>1.02)throw Error('TEXT_CLIPPED '+label.text+' '+v.x+','+v.y);}}}}};`;
    const probe=createCodeMotionRuntime();let bounds='PASS';try{await probe.prepare({...params,source:wrapped,fontBytes});for(const f of [.4,.55]){const b=await probe.render(input(f*c.duration).time);b.close();}}catch(e){bounds=e.message}finally{probe.dispose()}
    results.push({key,name:item.name,case:c.name,font:c.font,frames,bounds});
   }return results;
  },key);
  for(const r of rows){for(const f of r.frames){if(f.png){await writeFile(out+r.key.split(':').at(-1)+'-'+r.case+'.png',Buffer.from(f.png,'base64'));delete f.png;}}assert.equal(r.frames[1].hash,r.frames[4].hash,r.name+' '+r.case+' reverse seek');assert.ok(r.frames[2].visible>30,r.name+' '+r.case+' is visible');if(r.case==='multiline'){assert.ok(r.frames[2].red>15,r.name+' selected partial red');assert.ok(r.frames[2].cyan>30,r.name+' selected text cyan');}results.push(r);console.log(r.name,r.case,r.bounds);}
 }
 await writeFile(out+'results.json',JSON.stringify(results,null,2));assert.deepEqual(results.filter(x=>x.bounds!=='PASS').map(x=>({name:x.name,case:x.case,bounds:x.bounds})),[]);console.log('7 text motions x short/long/multiline, three fonts, actual Troika bounds and deterministic seeking PASS');
}finally{await browser.close()}
