// Shared motion settings for a single clip and one sequence transition.
import { easeP } from './camera-work.js?v=1';
export const DIRECTIONS = [['right','右'],['left','左'],['up','上'],['down','下'],['up-right','右上（斜め）'],['up-left','左上（斜め）'],['down-right','右下（斜め）'],['down-left','左下（斜め）'],['none','回転なし']];
const finite=(x,lo,hi,d)=>typeof x==='number'&&Number.isFinite(x)?Math.max(lo,Math.min(hi,x)):d;
const obj=x=>x&&typeof x==='object'&&!Array.isArray(x)?x:{};
const direction=(v,d)=>DIRECTIONS.some(([k])=>k===v)?v:d;
export function cleanRotation(value){const x=obj(value);return {enabled:x.enabled===true,inDirection:direction(x.inDirection,'right'),outDirection:direction(x.outDirection,'left'),inTurns:Math.round(finite(x.inTurns,0,3,1)),outTurns:Math.round(finite(x.outTurns,0,3,1))};}
const point=value=>{const x=obj(value);return {x:finite(x.x,-1,1,0),y:finite(x.y,-1,1,0),zoom:finite(x.zoom,.5,4,1)}};
export function cleanCameraMove(value){const x=obj(value),start=finite(x.start,8,85,10);return {enabled:x.enabled===true,from:point(x.from),to:point(x.to),start,end:finite(x.end,start+1,92,80),ease:['smooth','out','in','linear'].includes(x.ease)?x.ease:'smooth'};}
export function cleanShot(value){const x=obj(value);return {rotation:cleanRotation(x.rotation),camera:cleanCameraMove(x.camera)}};
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
function axisFor(direction){
 const y=direction.includes('right')?1:direction.includes('left')?-1:0;
 const x=direction.includes('up')?-1:direction.includes('down')?1:0;
 const n=Math.hypot(x,y)||1;return x||y?[x/n,y/n,0]:[0,1,0];
}
export function rotationAt(value,t,mode='single'){
 const r=cleanRotation(value);if(!r.enabled)return null;
 const [a,b,c,d]=mode==='sequence'?[.20,.45,.60,.86]:[.32,.58,.70,.94];
 const entering=t<c,dir=entering?r.inDirection:r.outDirection,turns=entering?r.inTurns:r.outTurns;
 // Each phase completes whole turns so arbitrary entry/exit axes both end at identity.
 const p=smooth(entering?a:c,entering?b:d,t);
 return {axis:axisFor(dir),angle:dir==='none'||p===0||p===1?0:p*Math.PI*2*turns};
}
export function cameraAt(value,t){
 const c=cleanCameraMove(value);if(!c.enabled)return null;
 const p=easeP(c.ease,(t-c.start/100)/((c.end-c.start)/100));
 const w=smooth(0,.08,t)*(1-smooth(.92,1,t));
 if(w===0)return {x:0,y:0,zoom:1,roll:0};
 const mix=k=>p===0?c.from[k]:p===1?c.to[k]:c.from[k]+(c.to[k]-c.from[k])*p;
 return {x:mix('x')*w,y:mix('y')*w,zoom:1+(mix('zoom')-1)*w,roll:0};
}

// Replace the old camera through the interior, joining its live values at both ends.
export function blendCameraMove(current,value,t,plane){
 const move=cameraAt(value,t);if(!move)return {...current};
 const w=smooth(0,.08,t)*(1-smooth(.92,1,t));if(!w)return {...current};
 return {x:current.x*(1-w)+move.x*plane.width,y:current.y*(1-w)+move.y*plane.height,
 zoom:current.zoom*(1-w)+plane.zoom*(move.zoom-1+w),roll:current.roll*(1-w)};
}

export function cameraPadRect(width,height){
 const scale=Math.min(320/width,180/height),w=width*scale,h=height*scale;
 return {x:(320-w)/2,y:(180-h)/2,width:w,height:h};
}
export function cameraPadPoint(rect,x,y){return {x:Math.max(-.5,Math.min(.5,(x-rect.x)/rect.width-.5)),y:Math.max(-.5,Math.min(.5,.5-(y-rect.y)/rect.height))};}
