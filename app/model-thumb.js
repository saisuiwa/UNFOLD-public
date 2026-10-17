// A small shaded portrait of an added shape, drawn from its target triangles — the tile icon in the shape dashboards.
import {importModel} from './model-import.js?v=12';
import {getModel,updateModel} from './model-library.js?v=4';
export const THUMB_COLOR=[127,214,255];
export function modelThumb(target,size=96){
 const n=Math.floor(target.length/9);if(!n)return '';
 const step=Math.max(1,Math.ceil(n/150000));   // huge models: a sampled subset is plenty at icon size
 const yaw=.55,pitch=-.3,cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
 const count=Math.ceil(n/step),pts=new Float32Array(count*9),depth=new Float32Array(count),order=new Uint32Array(count);
 let lo=[Infinity,Infinity],hi=[-Infinity,-Infinity];
 for(let t=0,k=0;t<n;t+=step,k++){
  let zs=0;
  for(let j=0;j<3;j++){
   const o=t*9+j*3,x=target[o],y=target[o+1],z=target[o+2];
   const x1=x*cy+z*sy,z1=-x*sy+z*cy,y2=y*cp-z1*sp,z2=y*sp+z1*cp;
   pts[k*9+j*3]=x1;pts[k*9+j*3+1]=y2;pts[k*9+j*3+2]=z2;zs+=z2;
   lo=[Math.min(lo[0],x1),Math.min(lo[1],y2)];hi=[Math.max(hi[0],x1),Math.max(hi[1],y2)];
  }
  depth[k]=zs;order[k]=k;
 }
 const c=document.createElement('canvas');c.width=c.height=size;const g=c.getContext('2d');
 const span=Math.max(hi[0]-lo[0],hi[1]-lo[1])||1,sc=size*.86/span,ox=size/2-(lo[0]+hi[0])/2*sc,oy=size/2+(lo[1]+hi[1])/2*sc;
 order.sort((a,b)=>depth[a]-depth[b]);   // far first, near last
 const L=[-.4,.65,.65],ll=Math.hypot(...L);
 for(const k of order){
  const p=k*9,ax=pts[p+3]-pts[p],ay=pts[p+4]-pts[p+1],az=pts[p+5]-pts[p+2],bx=pts[p+6]-pts[p],by=pts[p+7]-pts[p+1],bz=pts[p+8]-pts[p+2];
  let nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx;const nl=Math.hypot(nx,ny,nz)||1;if(nz<0){nx=-nx;ny=-ny;nz=-nz}
  const light=.35+.65*Math.abs((nx*L[0]+ny*L[1]+nz*L[2])/(nl*ll));
  g.fillStyle=`rgb(${THUMB_COLOR.map(v=>Math.round(v*light)).join(',')})`;g.strokeStyle=g.fillStyle;g.lineWidth=.6;
  g.beginPath();g.moveTo(ox+pts[p]*sc,oy-pts[p+1]*sc);g.lineTo(ox+pts[p+3]*sc,oy-pts[p+4]*sc);g.lineTo(ox+pts[p+6]*sc,oy-pts[p+7]*sc);g.closePath();g.fill();g.stroke();
 }
 return c.toDataURL('image/png');
}
// Models saved before thumbnails existed get one in the background, one at a time.
export async function fillMissingThumbs(models,onThumb){
 for(const meta of models){
  if(meta.thumb)continue;
  try{const record=await getModel(meta.id);if(!record)continue;
   const thumb=modelThumb((await importModel(record.buffer)).target);meta.thumb=thumb;
   await updateModel(meta.id,{thumb});onThumb(meta.id,thumb);
  }catch(e){console.warn('thumbnail:',e)}
 }
}
