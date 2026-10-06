import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(new URL('../../.worktrees/method-workshop/tools/image-code-build/.test-deps/node_modules/playwright-core/index.mjs',import.meta.url));
const source=await readFile(process.argv[2]||new URL('../methods/burn-through.js',import.meta.url),'utf8'),out=new URL('../out/burn-study/',import.meta.url).pathname;await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{const p=await browser.newPage();await p.goto('http://127.0.0.1:8779/workshop.html');const result=await p.evaluate(async source=>{
 const {createImageMethodRuntime}=await import('./image-method-runtime.js'),{IMAGE_RUNTIME,imageFrame}=await import('./image-method-format.js'),THREE=await import('./vendor/three.module.min.js');
 const image=document.createElement('canvas');image.width=640;image.height=360;const x=image.getContext('2d');x.fillStyle='#a0a0a0';x.fillRect(0,0,640,360);x.strokeStyle='#d0d0d0';x.lineWidth=2;for(let i=0;i<640;i+=40){x.beginPath();x.moveTo(i,0);x.lineTo(i,360);x.stroke()}for(let i=0;i<360;i+=40){x.beginPath();x.moveTo(0,i);x.lineTo(640,i);x.stroke()}
 const camera=new THREE.OrthographicCamera(-4,4,2.25,-2.25,.1,100);camera.position.z=10;camera.updateMatrixWorld();const runtime=createImageMethodRuntime();
 const c=document.createElement('canvas');c.width=800;c.height=450;const ctx=c.getContext('2d',{willReadFrequently:true}),frames=[];
 try{await runtime.prepare({code:{version:1,runtime:IMAGE_RUNTIME,source,params:{seed:7}},imageA:image,imageB:image,size:{width:5.25,height:2.953125},target:null});
 for(const time of [0,.9,1.8,2.7,3.6,5.8,6,1.8]){const b=await runtime.render({...imageFrame(time,6,.8),width:800,height:450,bg:'#101819',camera:{projection:camera.projectionMatrix.toArray(),world:camera.matrixWorld.toArray()}});ctx.drawImage(b,0,0);b.close();const data=ctx.getImageData(0,0,800,450).data;let warm=0,hole=0,hash=0;for(let y=100;y<350;y++)for(let x=160;x<640;x++){const i=(y*800+x)*4,r=data[i],g=data[i+1],b=data[i+2];hash=Math.imul(hash^r,16777619)^g^b;if(r>120&&r>b*1.8&&g>25&&g<230)warm++;if(Math.abs(r-16)<3&&Math.abs(g-24)<3&&Math.abs(b-25)<3)hole++;}frames.push({time,warm,hole,hash,png:c.toDataURL().split(',')[1]})}
 }finally{runtime.dispose()}return frames;
 },source);
 for(let i=0;i<result.length;i++){await writeFile(out+'frame-'+i+'.png',Buffer.from(result[i].png,'base64'));delete result[i].png;}await writeFile(out+'result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 assert.ok(result.some(f=>f.warm>100),'burn boundary must emit visibly warm colors');assert.ok(result.slice(1,6).some(f=>f.hole>1000),'burn must open a hole');assert.equal(result[0].hash,result[6].hash,'same input image restored at endpoints');assert.equal(result[2].hash,result[7].hash,'reverse seek must be deterministic');console.log('burn method: ember color, hole, endpoints and reverse seek PASS');
}finally{await browser.close()}
