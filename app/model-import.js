import * as THREE from './vendor/three.module.min.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {modelLayout,MAX_MODEL_TRIANGLES} from './model-layout.js?v=14';
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
 // opts.colors: also keep the model's own look — base colour × vertex colour per corner, the base colour texture (drawn by the shader through
 // the model's texture coordinates, so at its own resolution) and the smooth normals. The textures are decoded here from the GLB's own
 // binary chunk only; the loader below still never resolves textures or URLs.
 const paint=opts.colors?await modelPaint(json,bin):null;
 // asset.extras.unfold.fit = "frame": a scene laid out to fill the picture (confetti, a starry sky…) is sized to the 16:9 frame instead of the usual size
 const frame=json.asset?.extras?.unfold?.fit==='frame';
 // Only geometry is needed: never resolve the model's textures or external URLs.
 delete json.materials;delete json.textures;delete json.images;delete json.animations;delete json.cameras;delete json.extensions;
 json.extensionsUsed=(json.extensionsUsed||[]).filter(x=>['KHR_mesh_quantization','EXT_mesh_gpu_instancing'].includes(x));
 json.extensionsRequired=required.filter(x=>['KHR_mesh_quantization','EXT_mesh_gpu_instancing'].includes(x));
 for(const n of json.nodes||[]){delete n.camera;if(n.extensions)n.extensions=Object.fromEntries(Object.entries(n.extensions).filter(([k])=>k==='EXT_mesh_gpu_instancing'))}
 for(const m of json.meshes||[])for(const p of m.primitives){delete p.material;delete p.extensions;const a=p.attributes;p.attributes={POSITION:a.POSITION};if(paint)for(const k of ['NORMAL','TEXCOORD_0','TEXCOORD_1','TEXCOORD_2','TEXCOORD_3','COLOR_0'])if(a[k]!==undefined)p.attributes[k]=a[k];if(p.targets)p.targets=p.targets.map(t=>({POSITION:t.POSITION}));}
 const encoded=new TextEncoder().encode(JSON.stringify(json)),size=Math.ceil(encoded.length/4)*4;
 const packed=new ArrayBuffer(12+8+size+8+bin.byteLength),out=new DataView(packed),bytes=new Uint8Array(packed);
 out.setUint32(0,0x46546c67,true);out.setUint32(4,2,true);out.setUint32(8,packed.byteLength,true);out.setUint32(12,size,true);out.setUint32(16,0x4e4f534a,true);bytes.fill(32,20,20+size);bytes.set(encoded,20);out.setUint32(20+size,bin.byteLength,true);out.setUint32(24+size,0x004e4942,true);bytes.set(bin,28+size);
 const manager=new THREE.LoadingManager();manager.setURLModifier(()=>{throw new Error('外部データの読み込みには対応していません。')});
 const gltf=await new GLTFLoader(manager).parseAsync(packed,'');const objects=[];
 try{
  gltf.scene.updateMatrixWorld(true);gltf.scene.traverse(o=>{if(o.isMesh)objects.push(o)});
  let total=0;
  for(const o of objects){if(o.isSkinnedMesh)throw new Error('ボーンを含むモデルは、静止メッシュに変換してGLBを書き出してね。');
   const g=o.geometry,count=g.getIndex()?.count??g.getAttribute('position').count;
   if(count%3)throw new Error('三角形メッシュのGLBを選んでね。');
   total+=count*(o.isInstancedMesh?o.count:1);if(total/3>MAX_MODEL_TRIANGLES)throw new Error('三角形100万枚以下に軽量化したGLBを選んでね。');
  }
  // per corner: position, and with opts.colors 9 extras — linear rgb, texture u, v, "uses the texture" (0/1), normal xyz
  const vertices=new Float32Array(total*3),extras=paint?new Float32Array(total*X):null,v=new THREE.Vector3(),nv=new THREE.Vector3(),matrix=new THREE.Matrix4(),inst=new THREE.Matrix4(),nm=new THREE.Matrix3(),out=new Float32Array(6);
  let c=0;
  for(const o of objects){
   const g=o.geometry,index=g.getIndex(),count=index?.count??g.getAttribute('position').count,normals=paint?g.getAttribute('normal'):null;
   const where=gltf.parser.associations.get(o),look=paint&&where?.meshes!==undefined?paint.look(where.meshes,where.primitives,g):null;
   for(let copy=0;copy<(o.isInstancedMesh?o.count:1);copy++){matrix.copy(o.matrixWorld);if(o.isInstancedMesh){o.getMatrixAt(copy,inst);matrix.multiply(inst)}nm.getNormalMatrix(matrix);
    for(let i=0;i<count;i++,c++){const n=index?index.getX(i):i;o.getVertexPosition(n,v);v.applyMatrix4(matrix);vertices[c*3]=v.x;vertices[c*3+1]=v.y;vertices[c*3+2]=v.z;
     if(!extras)continue;
     if(look)look(n,out);else{out.fill(0);out[0]=out[1]=out[2]=1}
     extras.set(out,c*X);
     if(normals){nv.fromBufferAttribute(normals,n).applyMatrix3(nm).normalize();extras[c*X+6]=nv.x;extras[c*X+7]=nv.y;extras[c*X+8]=nv.z}
    }
   }
  }
  const data=modelLayout(vertices,{...opts,extras:extras?{data:extras,stride:X}:null});
  if(paint)splitExtras(data,paint);
  if(frame)fitFrame(data);
  return data;
 }finally{gltf.scene.traverse(o=>{o.geometry?.dispose();const materials=Array.isArray(o.material)?o.material:[o.material];materials.forEach(m=>m?.dispose())})}
}

// ---- the model's own look ----------------------------------------------------------------------------------------------
// glTF colours are linear; the texture is sRGB (the shader reads it as such). Everything per corner is linear, like the picture the shader samples.
const X=9;   // extras per corner (see importModel)
const MAX_TEXTURE_SIDE=4096;   // one texture as it is up to this; several share one atlas of this size
// Decode one image of the GLB. Only images stored in the GLB itself (a bufferView, or a data: URI) are read.
async function decodeImage(json,bin,image){
 let blob;
 if(image.bufferView!==undefined){const bv=json.bufferViews?.[image.bufferView];if(!bv||(bv.buffer??0)!==0)return null;const o=bv.byteOffset||0;if(o+bv.byteLength>bin.byteLength)return null;
  blob=new Blob([bin.slice(o,o+bv.byteLength)],{type:image.mimeType||'image/png'});}
 else if(typeof image.uri==='string'&&image.uri.startsWith('data:'))blob=await (await fetch(image.uri)).blob();
 else return null;
 return createImageBitmap(blob);
}
const canvasOf=(w,h)=>typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):Object.assign(document.createElement('canvas'),{width:w,height:h});
const WRAP={33071:THREE.ClampToEdgeWrapping,33648:THREE.MirroredRepeatWrapping,10497:THREE.RepeatWrapping};
const wrap=(t,mode)=>mode===33071?Math.min(1,Math.max(0,t)):mode===33648?1-Math.abs(((t%2)+2)%2-1):t-Math.floor(t);
// Read the model's colours and its base colour textures. One texture is used as it is (its own wrapping); several are put side by side in one atlas,
// with each corner's coordinates moved into its texture's cell. look(mesh, primitive, geometry) -> (vertex, out) writes rgb, u, v, uses-texture into out.
async function modelPaint(json,bin){
 const refs=(json.materials||[]).map(m=>{const pbr=m.pbrMetallicRoughness||{},ref=pbr.baseColorTexture;if(!ref)return null;
  const t=json.textures?.[ref.index],e=t?.extensions||{},src=t?.source??e.EXT_texture_webp?.source??e.EXT_texture_avif?.source;   // KTX2-only textures cannot be read here
  if(src===undefined||!json.images?.[src])return null;
  const s=json.samplers?.[t.sampler]||{},tr=ref.extensions?.KHR_texture_transform||{},sc=tr.scale||[1,1],off=tr.offset||[0,0],r=tr.rotation||0;
  return {src,set:tr.texCoord??ref.texCoord??0,ws:s.wrapS??10497,wt:s.wrapT??10497,m:[sc[0]*Math.cos(r),sc[0]*Math.sin(r),off[0],-sc[1]*Math.sin(r),sc[1]*Math.cos(r),off[1]]}});
 const sources=[...new Set(refs.filter(Boolean).map(r=>r.src))];
 const bitmaps=await Promise.all(sources.map(i=>decodeImage(json,bin,json.images[i]).catch(()=>null)));
 const ok=sources.filter((_,i)=>bitmaps[i]),cellOf=new Map();let texture=null;
 try{
  if(ok.length){
   const one=ok.length===1,cols=Math.ceil(Math.sqrt(ok.length)),rows=Math.ceil(ok.length/cols);
   const first=bitmaps[sources.indexOf(ok[0])],cell=one?null:Math.min(2048,Math.floor(MAX_TEXTURE_SIDE/Math.max(cols,rows)));
   const k=one?Math.min(1,MAX_TEXTURE_SIDE/Math.max(first.width,first.height)):1,W=one?Math.max(1,Math.round(first.width*k)):cols*cell,H=one?Math.max(1,Math.round(first.height*k)):rows*cell;
   const canvas=canvasOf(W,H),x=canvas.getContext('2d');
   ok.forEach((src,i)=>{const b=bitmaps[sources.indexOf(src)];
    if(one){x.drawImage(b,0,0,W,H);cellOf.set(src,null)}
    else{const cx=(i%cols)*cell,cy=Math.floor(i/cols)*cell;x.drawImage(b,cx,cy,cell,cell);cellOf.set(src,{x:cx/W,y:cy/H,w:cell/W,h:cell/H,inset:.5/cell})}});
   texture=new THREE.Texture(canvas);texture.flipY=false;texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
   texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
   const r0=refs.find(r=>r&&r.src===ok[0]);texture.wrapS=one?WRAP[r0.ws]??THREE.RepeatWrapping:THREE.ClampToEdgeWrapping;texture.wrapT=one?WRAP[r0.wt]??THREE.RepeatWrapping:THREE.ClampToEdgeWrapping;
   texture.needsUpdate=true;
  }
 }finally{bitmaps.forEach(b=>b?.close?.())}
 const materials=(json.materials||[]).map((m,i)=>({f:m.pbrMetallicRoughness?.baseColorFactor||[1,1,1,1],tex:refs[i]&&cellOf.has(refs[i].src)?{...refs[i],cell:cellOf.get(refs[i].src)}:null}));
 const prims=(json.meshes||[]).map(m=>m.primitives.map(p=>({material:materials[p.material]??null,vertexColor:p.attributes.COLOR_0!==undefined})));
 const any=prims.some(m=>m.some(p=>p.material||p.vertexColor));
 function look(meshIndex,primIndex,g){
  const p=prims[meshIndex]?.[primIndex];if(!p)return null;
  const f=p.material?.f||[1,1,1,1],tex=p.material?.tex,uv=tex?g.getAttribute(tex.set?'uv'+tex.set:'uv'):null,vc=p.vertexColor?g.getAttribute('color'):null;
  return (n,out)=>{
   let r=f[0],gg=f[1],b=f[2];
   if(vc){r*=vc.getX(n);gg*=vc.getY(n);b*=vc.getZ(n);}
   out[0]=r;out[1]=gg;out[2]=b;out[3]=out[4]=out[5]=0;
   if(uv){const u0=uv.getX(n),v0=uv.getY(n),M=tex.m;let u=M[0]*u0+M[1]*v0+M[2],v=M[3]*u0+M[4]*v0+M[5];   // glTF uv (0,0) is the image's top-left, as the texture is uploaded
    const c=tex.cell;if(c){u=c.x+Math.min(1-c.inset,Math.max(c.inset,wrap(u,tex.ws)))*c.w;v=c.y+Math.min(1-c.inset,Math.max(c.inset,wrap(v,tex.wt)))*c.h}
    out[3]=u;out[4]=v;out[5]=1;}
  };
 }
 return {any:any||!!texture,look,texture};
}
// layout extras -> the attributes the shader reads: color (rgb, a = 2 when the model has colour), modelUv (u, v, uses-texture), normal (xyz, w = 2 when known)
function splitExtras(data,paint){
 const e=data.extras,corners=e.length/X,color=paint.any?new Float32Array(corners*4):null,modelUv=new Float32Array(corners*3),normal=new Float32Array(corners*4);
 for(let c=0;c<corners;c++){const o=c*X;
  if(color){color[c*4]=e[o];color[c*4+1]=e[o+1];color[c*4+2]=e[o+2];color[c*4+3]=2}
  modelUv[c*3]=e[o+3];modelUv[c*3+1]=e[o+4];modelUv[c*3+2]=e[o+5];
  const x=e[o+6],y=e[o+7],z=e[o+8],l=Math.hypot(x,y,z);if(l>1e-6){normal[c*4]=x/l;normal[c*4+1]=y/l;normal[c*4+2]=z/l;normal[c*4+3]=2}
 }
 data.color=color;data.modelUv=paint.texture?modelUv:null;data.normal=normal;data.texture=paint.texture;data.extras=null;
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
