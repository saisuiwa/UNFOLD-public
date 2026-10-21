import * as THREE from './vendor/three.module.min.js';
const ids={sphere:0,torus:1,helix:2,mass:3,cube:4,heart:5,star:6,saturn:7,mobius:8,diamond:9,flower:10};
const cached=new WeakMap();
// texture: the GLB's base colour texture (model-import.js data.texture). With the geometry's modelColor / modelUv it lets image code show the
// model's own colours as it becomes the solid, like the GLSL methods (frame.modelColor = the 「GLBの色」 slider; image-method-solid.js).
export function imageTarget(geometry,{shape='sphere',preset=false,project=false,texture=null}={}){
 const key=JSON.stringify([shape,preset,project]);let entries=cached.get(geometry);if(!entries)cached.set(geometry,entries=new Map());
 if(!entries.has(key)){
  const g=geometry.index?geometry.toNonIndexed():geometry;
  const color=g.attributes.modelColor?.itemSize===4?g.attributes.modelColor.array:null,modelUv=texture?.image&&g.attributes.modelUv?.itemSize===3?g.attributes.modelUv.array:null;
  entries.set(key,{uv:g.attributes.uv.array,positions:g.attributes.targetPosition?.array||new Float32Array(g.attributes.position.array.length),shape:ids[shape]??0,preset:!!preset,project:!!project,...(color?{color}:{}),...(modelUv?{modelUv,texture}:{})});
  if(g!==geometry)g.dispose();
 }
 return entries.get(key);
}
export function previewTarget(shape='sphere'){
 const g=new THREE.PlaneGeometry(5.25,3,80,80).toNonIndexed();const target=imageTarget(g,{shape});g.dispose();return target;
}
export function validateImageTarget(target){
 if(target==null)return null;
 const {positions,uv,shape,preset,project,color,modelUv,texture}=target;
 if(!(positions instanceof Float32Array)||!(uv instanceof Float32Array)||positions.length<9||positions.length%9||positions.length>Math.ceil(1000000/512)*512*9||uv.length!==positions.length/3*2||!Number.isInteger(shape)||shape<0||shape>10||typeof preset!=='boolean'||typeof project!=='boolean')throw Error('立体形状のデータが不正です。');
 // the model's own colours are optional: rgb + "has colour" per corner, and texture coordinates only together with the texture they read
 const corners=positions.length/3;
 if(color!==undefined&&!(color instanceof Float32Array&&color.length===corners*4))throw Error('立体形状の色のデータが不正です。');
 if((modelUv===undefined)!==(texture===undefined)||modelUv!==undefined&&!(modelUv instanceof Float32Array&&modelUv.length===corners*3&&texture?.image?.width>0&&texture.image.height>0))throw Error('立体形状のテクスチャのデータが不正です。');
 for(const a of [positions,uv,color,modelUv])if(a)for(const v of a)if(!Number.isFinite(v))throw Error('立体形状に無効な座標があります。');
 return target;
}
