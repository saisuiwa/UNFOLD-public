import * as THREE from './vendor/three.module.min.js';
const ids={sphere:0,torus:1,helix:2,mass:3,cube:4,heart:5,star:6,saturn:7,mobius:8,diamond:9,flower:10};
const cached=new WeakMap();
export function imageTarget(geometry,{shape='sphere',preset=false,project=false}={}){
 const key=JSON.stringify([shape,preset,project]);let entries=cached.get(geometry);if(!entries)cached.set(geometry,entries=new Map());
 if(!entries.has(key)){
  const g=geometry.index?geometry.toNonIndexed():geometry;
  entries.set(key,{uv:g.attributes.uv.array,positions:g.attributes.targetPosition?.array||new Float32Array(g.attributes.position.array.length),shape:ids[shape]??0,preset:!!preset,project:!!project});
  if(g!==geometry)g.dispose();
 }
 return entries.get(key);
}
export function previewTarget(shape='sphere'){
 const g=new THREE.PlaneGeometry(5.25,3,80,80).toNonIndexed();const target=imageTarget(g,{shape});g.dispose();return target;
}
export function validateImageTarget(target){
 if(target==null)return null;
 const {positions,uv,shape,preset,project}=target;
 if(!(positions instanceof Float32Array)||!(uv instanceof Float32Array)||positions.length<9||positions.length%9||positions.length>Math.ceil(1000000/512)*512*9||uv.length!==positions.length/3*2||!Number.isInteger(shape)||shape<0||shape>10||typeof preset!=='boolean'||typeof project!=='boolean')throw Error('立体形状のデータが不正です。');
 for(const a of [positions,uv])for(const v of a)if(!Number.isFinite(v))throw Error('立体形状に無効な座標があります。');
 return target;
}
