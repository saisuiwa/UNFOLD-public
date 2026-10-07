// The JavaScript image methods added by the daily routine (docs/daily-samples-routine.md). New ones go at the END of the list.
// They are appended to IMAGE_METHOD_PRESETS (image-method-presets.js), so the method workshop and the image method editor list them as samples.
//   key: lower-case letters, digits and "-" (the id of its preview is image-<key>). name: up to 20 characters (the editor's name box). symbol: one character.
//   desc: one line for the samples page (10-60 characters, ends with "。"). added: the day it was added (YYYY-MM-DD, Japan time).
//   poster (optional): the second of the 6 second clip the still picture is taken at (1.8 if left out; pick when the effect is easiest to see).
//   code: { version: 1, runtime: IMAGE_RUNTIME, source, params } as in image-method-format.js (see docs/image-code-methods.md for the api).
//   previewShape: leave it out (a sphere in the workshop). 'none' is for the eight surface effects and is counted by their tests.
import {IMAGE_RUNTIME} from './image-method-format.js';

export const DAILY_IMAGE_METHODS=[
 {key:'tile-vortex',name:'渦に巻かれるタイル',symbol:'渦',desc:'タイルが渦を巻いて中心へ寄り、また元の絵へ戻ります。',added:'2026-10-07',poster:1.8,
  code:{version:1,runtime:IMAGE_RUNTIME,params:{columns:14,gravity:4,bounce:.5,seed:7,returnMode:'reverse',label:'UNFOLD',font:'gothic'},source:`// タイルが渦を巻いて中心へ寄る。内側ほど速く回り、強さ(amount)が戻ると元の位置へ帰る
const {createImageTiles,THREE,size}=api;
const tiles=createImageTiles();
const half=size.width*.5;
return {update(frame){
 const e=Math.min(1,frame.amount/.8);
 for(const piece of tiles){
  const x=piece.home.x,y=piece.home.y,r=Math.hypot(x,y)/half;
  const turn=e*(3.4/(r+.5)),c=Math.cos(turn),s=Math.sin(turn),pull=1-.5*e*(1-r*.35);
  piece.mesh.position.set((x*c-y*s)*pull,(x*s+y*c)*pull,0);
  piece.mesh.rotation.set(0,0,turn);
  piece.mesh.scale.setScalar(1-.3*e);
 }
}};`}}
];
