import test from 'node:test';
import assert from 'node:assert/strict';
import * as library from '../../app/workshop-library.js';
const source='return {update(frame){}};';
test('surface shape and preview strength survive sharing without changing code params',()=>{
 const d={kind:'image',name:'表面',source,shape:'none',strength:.63};
 const file=library.workshopFile(d),parsed=library.importedDrafts(file.text)[0];
 assert.equal(parsed.shape,'none');assert.equal(parsed.strength,.63);assert.equal(parsed.source,source);
 assert.equal(JSON.parse(file.text).methods[0].code.params.shape,undefined);
});
test('text preview words and typography survive sharing',()=>{
 const d={kind:'text',name:'文字',source,words:'朝の*色*/夜の声',font:'mincho',color:'#112233',accent:'#ff8844',motion:{size:112,speed:1.3,position:'bottom'}};
 const p=library.importedDrafts(library.workshopFile(d).text)[0];
 assert.equal(p.words,d.words);assert.equal(p.motion.size,112);assert.equal(p.font,'mincho');assert.equal(p.color,d.color);
});
test('verification manifests get actionable guidance',()=>{
 assert.throws(()=>library.importedDrafts('{"files":[],"checks":[]}',{fileName:'manifest.json'}),/検証|作例/);
});
test('plain JS is imported as an unexecuted draft with filename and explicit kind',()=>{
 globalThis.__workshopImportExecuted=false;
 const code='globalThis.__workshopImportExecuted=true; return {update(){}};';
 const d=library.importedDrafts(code,{fileName:'わたしの動き.js',kind:'image'})[0];
 assert.equal(d.name,'わたしの動き');assert.equal(d.kind,'image');assert.equal(globalThis.__workshopImportExecuted,false);
 assert.throws(()=>library.importedDrafts(code,{fileName:'わたしの動き.js'}),e=>e.code==='JS_KIND_REQUIRED');
});
test('invalid JS and invalid preview settings are rejected',()=>{
 assert.throws(()=>library.importedDrafts('const = ;',{fileName:'bad.js',kind:'text'}),/JavaScript|構文/);
 const file=JSON.parse(library.workshopFile({kind:'image',name:'bad',source}).text);
 file.methods[0].workshop={shape:'javascript:bad'};
 assert.throws(()=>library.importedDrafts(JSON.stringify(file)),/設定/);
});
test('all eleven new samples have stable distinct IDs, and raw sources recover names and kind',()=>{
 assert.ok(Array.isArray(library.WORKSHOP_EXAMPLES),'the eleven-example catalog is exported');
 assert.equal(library.WORKSHOP_EXAMPLES.length,11);
 assert.equal(new Set(library.WORKSHOP_EXAMPLES.map(x=>x.key)).size,11);
 for(const d of library.WORKSHOP_EXAMPLES){
  assert.match(d.key,/^sample:collection:/);new Function('api',d.source);
  for(const old of d.originalSources||[])assert.equal(library.importedDrafts(old,{fileName:'old.js'})[0].source,d.source);
  const p=library.importedDrafts(d.source,{fileName:'renamed.js'})[0];
  assert.equal(p.name,d.name);assert.equal(p.kind,d.kind);
  if(d.kind==='image')assert.equal(p.shape,'none');
 }
});
import {registerQuarantined,planImport} from '../../app/method-project.js';
import {getCustom,unregisterCustom} from '../../app/method-registry.js';
import {parseMethodFile} from '../../app/method-file.js';
import {createMotionLibrary} from '../../app/lyric-library.js';
test('normal project imports retain surface settings and do not reuse different settings',async()=>{
 const d={kind:'image',name:'surface',source,shape:'none',strength:.4};
 const m=parseMethodFile(library.workshopFile(d).text).methods[0];
 registerQuarantined([m]);assert.equal(getCustom(m.id).workshop?.shape,'none');unregisterCustom(m.id);
 const plan=await planImport({embedded:[m],local:[{...m,id:'im-existing',workshop:{shape:'sphere',strength:.4}}],hash:async x=>x,newId:()=> 'cm-new'});
 assert.equal(plan.created.length,1);assert.equal(plan.created[0].workshop.shape,'none');
});
test('GLSL shared previews also preserve settings',()=>{
 const d={kind:'glsl',name:'GLSL',source:'vec3 userMethod(vec2 p,float amount){return vec3(p,amount);}',strength:.31};
 assert.equal(library.importedDrafts(library.workshopFile(d).text)[0].strength,.31);
});
test('saving a text motion with different preview words preserves both variants',()=>{
 const data=new Map(),store={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},lib=createMotionLibrary(store);
 const first=lib.save({name:'文字',motion:{code:{version:1,source}},workshop:{words:'朝'}}),second=lib.save({name:'文字',motion:{code:{version:1,source}},workshop:{words:'夜'}});
 assert.notEqual(first.id,second.id);assert.equal(lib.list().length,2);assert.equal(lib.list()[0].workshop.words,'朝');assert.equal(second.workshop.words,'夜');
 assert.equal(lib.save(second).id,second.id);
});
