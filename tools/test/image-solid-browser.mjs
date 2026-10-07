import {chromium} from '../image-code-build/.test-deps/node_modules/playwright-core/index.mjs';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try {const p=await browser.newPage();p.on('pageerror',e=>console.log('PAGEERROR',e.message));await p.goto('http://127.0.0.1:8776/');console.log(JSON.stringify(await p.evaluate(async()=>{
 const {createImageMethodRuntime}=await import('/app/image-method-runtime.js');const {imageFrame}=await import('/app/image-method-format.js');const {IMAGE_METHOD_PRESETS}=await import('/app/image-method-presets.js');const T=await import('/app/vendor/three.module.min.js');
 const image=document.createElement('canvas');image.width=160;image.height=90;const x=image.getContext('2d');x.fillStyle='#804020';x.fillRect(0,0,160,90);x.fillStyle='#00ff99';x.fillRect(0,0,80,45);
 const g=new T.PlaneGeometry(5.25,2.953125,80,80).toNonIndexed();const target={uv:g.attributes.uv.array,positions:new Float32Array(g.attributes.position.array.length),shape:0,preset:false,project:false};
 const cam=new T.OrthographicCamera(-4,4,2.25,-2.25,.1,100);cam.position.z=10;cam.updateMatrixWorld();
 const f=(t,form)=>({...imageFrame(t,6,.8),form,width:640,height:360,bg:'#101819',camera:{projection:cam.projectionMatrix.toArray(),world:cam.matrixWorld.toArray()},depth:1,seed:28});
 const out=document.createElement('canvas');out.width=640;out.height=360;document.body.append(out);const cx=out.getContext('2d');
 const hash=async(r,frame)=>{const b=await r.render(frame);cx.drawImage(b,0,0);b.close();let h=2166136261;for(const v of cx.getImageData(0,0,640,360).data)h=Math.imul(h^v,16777619);return h};
 const solids=[];for(const preset of IMAGE_METHOD_PRESETS.slice(0,2)){
 const r=createImageMethodRuntime();await r.prepare({code:preset.code,imageA:image,size:{width:5.25,height:2.953125},target});
 const a=await hash(r,f(3,1)),b=await hash(r,f(1,.4)),c=await hash(r,f(3,1));if(a!==c)throw Error('solid reverse seek differs');solids.push(a);r.dispose();}
 if(solids[0]!==solids[1])throw Error('full solid still depends on physics preset: '+solids);
 const r=createImageMethodRuntime();await r.prepare({code:IMAGE_METHOD_PRESETS[0].code,imageA:image,size:{width:5.25,height:2.953125},target});
 const base=await hash(r,f(0,0)),last=await hash(r,f(6,0)),zero=await hash(r,{...f(3,1),amount:0});
 if(base!==last||zero!==solids[0])throw Error('endpoint or strength-zero solid regression');r.dispose();
 const shapes=[];for(const shape of [1,5,6,9]){const q=createImageMethodRuntime();await q.prepare({code:IMAGE_METHOD_PRESETS[0].code,imageA:image,size:{width:5.25,height:2.953125},target:{...target,shape}});shapes.push(await hash(q,f(3,1)));if(await hash(q,f(0,0))!==base)throw Error('shape changed endpoint');q.dispose()}
 if(new Set([...shapes,solids[0]]).size!==5)throw Error('selected shapes rendered the same');
 // Construct an actual self-contained GLB, then use the app importer (including its UV layout).
 const shape=new T.TorusKnotGeometry(1,.28,72,12).toNonIndexed();const pos=shape.attributes.position.array;
 const json={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0}}]}],buffers:[{byteLength:pos.byteLength}],bufferViews:[{buffer:0,byteLength:pos.byteLength}],accessors:[{bufferView:0,componentType:5126,count:pos.length/3,type:'VEC3',min:[-2,-2,-2],max:[2,2,2]}]};
 const encoded=new TextEncoder().encode(JSON.stringify(json)),padded=Math.ceil(encoded.length/4)*4,buffer=new ArrayBuffer(28+padded+pos.byteLength),view=new DataView(buffer),bytes=new Uint8Array(buffer);
 view.setUint32(0,0x46546c67,true);view.setUint32(4,2,true);view.setUint32(8,buffer.byteLength,true);view.setUint32(12,padded,true);view.setUint32(16,0x4e4f534a,true);bytes.fill(32,20,20+padded);bytes.set(encoded,20);view.setUint32(20+padded,pos.byteLength,true);view.setUint32(24+padded,0x004e4942,true);bytes.set(new Uint8Array(pos.buffer),28+padded);
 const {importModel}=await import('/app/model-import.js');const data=await importModel(buffer);
 const q=createImageMethodRuntime();await q.prepare({code:IMAGE_METHOD_PRESETS[0].code,imageA:image,size:{width:5.25,height:2.953125},target:{positions:data.target,uv:data.uv,shape:0,preset:true,project:false}});
 if(!data.target.byteLength||!data.uv.byteLength)throw Error('target geometry was detached');
 const custom=await hash(q,f(3,1));const partial=await hash(q,f(2,.5));const again=await hash(q,f(3,1));
 if(custom===solids[0]||custom!==again||partial===custom)throw Error('GLB morph/reverse failed');
 const depth=await hash(q,{...f(3,1),depth:.2,rootQuaternion:new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),.7).toArray()});
 if(depth===custom)throw Error('GLB depth/camera transform ignored');q.dispose();
 // Existing author code may create a helper plane on its first update.
 const renderSource=async(source,frame)=>{const q=createImageMethodRuntime();await q.prepare({code:{...IMAGE_METHOD_PRESETS[0].code,source},imageA:image,size:{width:5.25,height:2.953125},target});const result=await hash(q,frame);q.dispose();return result};
 const issues=[];const initial=await renderSource('const mesh=api.createImagePlane();mesh.position.x=1;return {update(){}};',f(3,.5));
 const lazy=await renderSource('let mesh;return {update(){if(!mesh){mesh=api.createImagePlane();mesh.position.x=1}}};',f(3,.5));
 if(initial!==lazy)issues.push('late image piece ignored by solid mapping');
 const hidden=await renderSource('const mesh=api.createImagePlane();mesh.visible=false;return {update(){}};',f(3,.00001));
 const blank=await renderSource('return {update(){}};',f(3,0));
 if(hidden!==blank)issues.push('hidden image piece reappears when morph starts');
 const parentHidden=await renderSource('const group=new api.THREE.Group();api.root.add(group);group.add(api.createImagePlane());group.visible=false;return {update(){}};',f(3,.00001));
 if(parentHidden!==blank)issues.push('hidden parent ignored by solid mapping');
 if(issues.length)throw Error(issues.join('; '));
 return {solids,reverse:true,shapes,endpoints:true,strengthZeroSolid:true,latePieces:true,hiddenPieces:true,glb:{triangles:data.target.length/9,custom,partial,depth},iframes:document.querySelectorAll('iframe').length};
})));}finally{await browser.close()}
