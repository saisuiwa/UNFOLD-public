import * as THREE from './vendor/three.module.min.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {modelLayout,MAX_MODEL_TRIANGLES} from './model-layout.js?v=13';
export async function importModel(buffer,opts={}){
 if(buffer.byteLength>100*1024*1024)throw new Error('100 MB以下のGLBを選んでね。');
 if(buffer.byteLength<20)throw new Error('GLBファイルを読み取れませんでした。');
 const view=new DataView(buffer);
 if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==buffer.byteLength)throw new Error('glTF 2.0のGLBファイルを選んでね。');
 let json,bin;
 for(let p=12;p<buffer.byteLength;){if(p+8>buffer.byteLength)throw new Error('GLBが途中で切れています。');const n=view.getUint32(p,true),type=view.getUint32(p+4,true);p+=8;if(p+n>buffer.byteLength)throw new Error('GLBが途中で切れています。');
  if(type===0x4e4f534a)json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,p,n)));
  if(type===0x004e4942)bin=new Uint8Array(buffer,p,n);p+=n;
 }
 if(!json||!bin)throw new Error('形状データを含むGLBを選んでね。');
 if(json.buffers?.some(b=>b.uri))throw new Error('外部ファイルを含まない、1ファイルのGLBに書き出してね。');
 const required=json.extensionsRequired||[];
 if(json.meshes?.some(m=>m.primitives.some(p=>p.extensions?.KHR_draco_mesh_compression))||json.bufferViews?.some(v=>v.extensions?.EXT_meshopt_compression||v.extensions?.KHR_meshopt_compression))throw new Error('この圧縮方式には未対応です。圧縮をOFFにしてGLBを書き出してね。');
 if(required.some(x=>!['KHR_mesh_quantization','EXT_mesh_gpu_instancing','KHR_texture_transform','KHR_texture_basisu','KHR_lights_punctual'].includes(x)&&!x.startsWith('KHR_materials_')))throw new Error('このGLBの拡張機能には未対応です。標準の静止メッシュで書き出してね。');
 if(json.nodes?.some(n=>n.skin!==undefined))throw new Error('ボーンを含むモデルは、静止メッシュに変換してGLBを書き出してね。');
 // opts.colors: also read the model's own colours (base colour × base colour texture × vertex colour) for each corner.
 // The textures are decoded here from the GLB's own binary chunk only; the loader below still never resolves textures or URLs.
 const paint=opts.colors?await modelPaint(json,bin):null;
 // asset.extras.unfold.fit = "frame": a scene laid out to fill the picture (confetti, a starry sky…) is sized to the 16:9 frame instead of the usual size
 const frame=json.asset?.extras?.unfold?.fit==='frame';
 // Only geometry is needed: never resolve the model's textures or external URLs.
 delete json.materials;delete json.textures;delete json.images;delete json.animations;delete json.cameras;delete json.extensions;
 json.extensionsUsed=(json.extensionsUsed||[]).filter(x=>['KHR_mesh_quantization','EXT_mesh_gpu_instancing'].includes(x));
 json.extensionsRequired=required.filter(x=>['KHR_mesh_quantization','EXT_mesh_gpu_instancing'].includes(x));
 for(const n of json.nodes||[]){delete n.camera;if(n.extensions)n.extensions=Object.fromEntries(Object.entries(n.extensions).filter(([k])=>k==='EXT_mesh_gpu_instancing'))}
 for(const m of json.meshes||[])for(const p of m.primitives){delete p.material;delete p.extensions;const a=p.attributes;p.attributes={POSITION:a.POSITION};if(paint)for(const k of ['TEXCOORD_0','TEXCOORD_1','TEXCOORD_2','TEXCOORD_3','COLOR_0'])if(a[k]!==undefined)p.attributes[k]=a[k];if(p.targets)p.targets=p.targets.map(t=>({POSITION:t.POSITION}));}
 const encoded=new TextEncoder().encode(JSON.stringify(json)),size=Math.ceil(encoded.length/4)*4;
 const packed=new ArrayBuffer(12+8+size+8+bin.byteLength),out=new DataView(packed),bytes=new Uint8Array(packed);
 out.setUint32(0,0x46546c67,true);out.setUint32(4,2,true);out.setUint32(8,packed.byteLength,true);out.setUint32(12,size,true);out.setUint32(16,0x4e4f534a,true);bytes.fill(32,20,20+size);bytes.set(encoded,20);out.setUint32(20+size,bin.byteLength,true);out.setUint32(24+size,0x004e4942,true);bytes.set(bin,28+size);
 const manager=new THREE.LoadingManager();manager.setURLModifier(()=>{throw new Error('外部データの読み込みには対応していません。')});
 const gltf=await new GLTFLoader(manager).parseAsync(packed,'');const objects=[];
 try{
  gltf.scene.updateMatrixWorld(true);const vertices=[],colors=paint?[]:null;const v=new THREE.Vector3(),matrix=new THREE.Matrix4(),inst=new THREE.Matrix4(),rgb=[0,0,0];
  gltf.scene.traverse(o=>{if(o.isMesh)objects.push(o)});
  for(const o of objects){if(o.isSkinnedMesh)throw new Error('ボーンを含むモデルは、静止メッシュに変換してGLBを書き出してね。');
   const g=o.geometry,pos=g.getAttribute('position'),index=g.getIndex(),count=index?.count??pos.count;
   if(count%3)throw new Error('三角形メッシュのGLBを選んでね。');
   const copies=o.isInstancedMesh?o.count:1;if((vertices.length/3+count*copies)/3>MAX_MODEL_TRIANGLES)throw new Error('三角形100万枚以下に軽量化したGLBを選んでね。');
   const where=gltf.parser.associations.get(o),look=paint&&where?.meshes!==undefined?paint.look(where.meshes,where.primitives,g):null;
   for(let copy=0;copy<copies;copy++){matrix.copy(o.matrixWorld);if(o.isInstancedMesh){o.getMatrixAt(copy,inst);matrix.multiply(inst)}
    for(let i=0;i<count;i++){const n=index?index.getX(i):i;o.getVertexPosition(n,v);v.applyMatrix4(matrix);vertices.push(v.x,v.y,v.z);
     if(colors){if(look)look(n,rgb);else rgb[0]=rgb[1]=rgb[2]=1;colors.push(rgb[0],rgb[1],rgb[2])}}
   }
  }
  const data=modelLayout(new Float32Array(vertices),{...opts,colors:paint?.any?new Float32Array(colors):null});
  if(frame)fitFrame(data);
  return data;
 }finally{gltf.scene.traverse(o=>{o.geometry?.dispose();const materials=Array.isArray(o.material)?o.material:[o.material];materials.forEach(m=>m?.dispose())})}
}

// ---- the model's own colours -------------------------------------------------------------------------------------------
// glTF colours are linear; texture pixels are sRGB. Everything is returned linear, like the picture the shader samples.
const toLinear=c=>c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4);
const SRGB=new Float32Array(256).map((_,i)=>toLinear(i/255));
const MAX_TEXTURE_SIDE=2048;   // colour per corner only needs this much; keeps 8K textures from using gigabytes
// Decode one image of the GLB. Only images stored in the GLB itself (a bufferView, or a data: URI) are read.
async function decodeImage(json,bin,image){
 let blob;
 if(image.bufferView!==undefined){const bv=json.bufferViews?.[image.bufferView];if(!bv||(bv.buffer??0)!==0)return null;const o=bv.byteOffset||0;if(o+bv.byteLength>bin.byteLength)return null;
  blob=new Blob([bin.slice(o,o+bv.byteLength)],{type:image.mimeType||'image/png'});}
 else if(typeof image.uri==='string'&&image.uri.startsWith('data:'))blob=await (await fetch(image.uri)).blob();
 else return null;
 const bmp=await createImageBitmap(blob);
 try{const k=Math.min(1,MAX_TEXTURE_SIDE/Math.max(bmp.width,bmp.height)),w=Math.max(1,Math.round(bmp.width*k)),h=Math.max(1,Math.round(bmp.height*k));
  const canvas=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):Object.assign(document.createElement('canvas'),{width:w,height:h});
  const x=canvas.getContext('2d',{willReadFrequently:true});x.drawImage(bmp,0,0,w,h);return {w,h,data:x.getImageData(0,0,w,h).data};
 }finally{bmp.close?.()}
}
const wrap=(t,mode)=>mode===33071?Math.min(1,Math.max(0,t)):mode===33648?1-Math.abs(((t%2)+2)%2-1):t-Math.floor(t);
// Read what colours the model has. look(mesh, primitive, geometry) -> (vertex, out) writes that vertex's linear rgb into out.
async function modelPaint(json,bin){
 const cache=new Map();
 const image=i=>{if(!cache.has(i)){const def=json.images?.[i];cache.set(i,def?decodeImage(json,bin,def).catch(()=>null):Promise.resolve(null))}return cache.get(i)};
 const materials=await Promise.all((json.materials||[]).map(async m=>{
  const pbr=m.pbrMetallicRoughness||{},f=pbr.baseColorFactor||[1,1,1,1],ref=pbr.baseColorTexture;let tex=null;
  if(ref){const t=json.textures?.[ref.index],e=t?.extensions||{},src=t?.source??e.EXT_texture_webp?.source??e.EXT_texture_avif?.source;   // KTX2-only textures cannot be read here
   const img=src!==undefined?await image(src):null;
   if(img){const s=json.samplers?.[t.sampler]||{},tr=ref.extensions?.KHR_texture_transform||{},sc=tr.scale||[1,1],off=tr.offset||[0,0],r=tr.rotation||0;
    tex={img,set:tr.texCoord??ref.texCoord??0,ws:s.wrapS??10497,wt:s.wrapT??10497,m:[sc[0]*Math.cos(r),sc[0]*Math.sin(r),off[0],-sc[1]*Math.sin(r),sc[1]*Math.cos(r),off[1]]};}
  }
  return {f,tex};
 }));
 const prims=(json.meshes||[]).map(m=>m.primitives.map(p=>({material:materials[p.material]??null,vertexColor:p.attributes.COLOR_0!==undefined})));
 const any=prims.some(m=>m.some(p=>p.material||p.vertexColor));
 function look(meshIndex,primIndex,g){
  const p=prims[meshIndex]?.[primIndex];if(!p)return null;
  const f=p.material?.f||[1,1,1,1],tex=p.material?.tex,uv=tex?g.getAttribute(tex.set?'uv'+tex.set:'uv'):null,vc=p.vertexColor?g.getAttribute('color'):null;
  return (n,out)=>{
   let r=f[0],gg=f[1],b=f[2];
   if(uv){const u0=uv.getX(n),v0=uv.getY(n),M=tex.m,{w,h,data}=tex.img;
    const u=wrap(M[0]*u0+M[1]*v0+M[2],tex.ws),v=wrap(M[3]*u0+M[4]*v0+M[5],tex.wt);   // glTF uv (0,0) is the image's top-left
    const k=(Math.min(h-1,Math.floor(v*h))*w+Math.min(w-1,Math.floor(u*w)))*4;r*=SRGB[data[k]];gg*=SRGB[data[k+1]];b*=SRGB[data[k+2]];}
   if(vc){r*=vc.getX(n);gg*=vc.getY(n);b*=vc.getZ(n);}
   out[0]=r;out[1]=gg;out[2]=b;
  };
 }
 return {any,look};
}

// ---- "fill the frame" GLBs --------------------------------------------------------------------------------------------------
// Every other model is sized so its longest side is 3.5. The 16:9 picture plane is 5.25 × 2.95 (sequence.js: planeH = min(3.65, 5.25/aspect)),
// so a wide scene that should cover the screen is sized to that instead (a little inside it).
const FRAME_W=5.25*.97,FRAME_H=2.95*.97;
function fitFrame(data){
 const t=data.target;let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
 for(let i=0;i<t.length;i+=3){x0=Math.min(x0,t[i]);x1=Math.max(x1,t[i]);y0=Math.min(y0,t[i+1]);y1=Math.max(y1,t[i+1])}
 const k=Math.min(FRAME_W/Math.max(1e-6,x1-x0),FRAME_H/Math.max(1e-6,y1-y0));
 for(let i=0;i<t.length;i++)t[i]*=k;
 data.scale*=k;data.fit='frame';
}
