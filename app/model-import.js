import * as THREE from './vendor/three.module.min.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {modelLayout,MAX_MODEL_TRIANGLES} from './model-layout.js?v=11';
export async function importModel(buffer,opts={}){
 if(buffer.byteLength>50*1024*1024)throw new Error('50 MB以下のGLBを選んでね。');
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
 // Only geometry is needed: never resolve the model's textures or external URLs.
 delete json.materials;delete json.textures;delete json.images;delete json.animations;delete json.cameras;delete json.extensions;
 json.extensionsUsed=(json.extensionsUsed||[]).filter(x=>['KHR_mesh_quantization','EXT_mesh_gpu_instancing'].includes(x));
 json.extensionsRequired=required.filter(x=>['KHR_mesh_quantization','EXT_mesh_gpu_instancing'].includes(x));
 for(const n of json.nodes||[]){delete n.camera;if(n.extensions)n.extensions=Object.fromEntries(Object.entries(n.extensions).filter(([k])=>k==='EXT_mesh_gpu_instancing'))}
 for(const m of json.meshes||[])for(const p of m.primitives){delete p.material;delete p.extensions;const pos=p.attributes.POSITION;p.attributes={POSITION:pos};if(p.targets)p.targets=p.targets.map(t=>({POSITION:t.POSITION}));}
 const encoded=new TextEncoder().encode(JSON.stringify(json)),size=Math.ceil(encoded.length/4)*4;
 const packed=new ArrayBuffer(12+8+size+8+bin.byteLength),out=new DataView(packed),bytes=new Uint8Array(packed);
 out.setUint32(0,0x46546c67,true);out.setUint32(4,2,true);out.setUint32(8,packed.byteLength,true);out.setUint32(12,size,true);out.setUint32(16,0x4e4f534a,true);bytes.fill(32,20,20+size);bytes.set(encoded,20);out.setUint32(20+size,bin.byteLength,true);out.setUint32(24+size,0x004e4942,true);bytes.set(bin,28+size);
 const manager=new THREE.LoadingManager();manager.setURLModifier(()=>{throw new Error('外部データの読み込みには対応していません。')});
 const gltf=await new GLTFLoader(manager).parseAsync(packed,'');const objects=[];
 try{
  gltf.scene.updateMatrixWorld(true);const vertices=[];const v=new THREE.Vector3(),matrix=new THREE.Matrix4(),inst=new THREE.Matrix4();
  gltf.scene.traverse(o=>{if(o.isMesh)objects.push(o)});
  for(const o of objects){if(o.isSkinnedMesh)throw new Error('ボーンを含むモデルは、静止メッシュに変換してGLBを書き出してね。');
   const g=o.geometry,pos=g.getAttribute('position'),index=g.getIndex(),count=index?.count??pos.count;
   if(count%3)throw new Error('三角形メッシュのGLBを選んでね。');
   const copies=o.isInstancedMesh?o.count:1;if((vertices.length/3+count*copies)/3>MAX_MODEL_TRIANGLES)throw new Error('三角形100万枚以下に軽量化したGLBを選んでね。');
   for(let copy=0;copy<copies;copy++){matrix.copy(o.matrixWorld);if(o.isInstancedMesh){o.getMatrixAt(copy,inst);matrix.multiply(inst)}
    for(let i=0;i<count;i++){o.getVertexPosition(index?index.getX(i):i,v);v.applyMatrix4(matrix);vertices.push(v.x,v.y,v.z)}
   }
  }
  return modelLayout(new Float32Array(vertices),opts);
 }finally{gltf.scene.traverse(o=>{o.geometry?.dispose();const materials=Array.isArray(o.material)?o.material:[o.material];materials.forEach(m=>m?.dispose())})}
}
