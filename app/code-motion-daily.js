// The text code motions added by the daily routine (docs/daily-samples-routine.md). New ones go at the END of the list.
// They are appended to CODE_MOTION_PRESETS (code-motion-presets.js), so the method workshop and the code motion editor list them as samples.
//   key: lower-case letters, digits and "-" (the id of its preview is codetext-<key>). name: up to 20 characters.
//   desc: one line for the samples page (10-60 characters, ends with "。"). added: the day it was added (YYYY-MM-DD, Japan time).
//   poster (optional): how many seconds after the line starts the still picture is taken (0.2 if left out).
//   source: the body of a function that takes `api` (see app/guide/code-motions.html); text is in px, y points up, and everything is computed from the time t.

export const DAILY_CODE_MOTIONS=[
 {key:'rgb-settle',name:'色ずれが重なる',desc:'赤とシアンにずれた像が、本体に重なって落ち着きます。',added:'2026-10-07',poster:.35,source:`// 赤とシアンの像が左右にずれた状態から、本体に重なって落ち着く。退場でもう一度ずれて消える
const {createText,text,width,duration}=api;
const opts={maxWidth:width*.82,textAlign:'center',lineHeight:1.25,outlineWidth:'2%'};
const red=createText(text,{...opts,color:'#ff5d73',colorRanges:null,outlineColor:'#ff5d73'});
const cyan=createText(text,{...opts,color:'#4fd8ff',colorRanges:null,outlineColor:'#4fd8ff'});
const label=createText(text,{...opts,outlineColor:'#101819'});
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
const enter=Math.min(.9,duration*.3),exit=Math.min(.5,duration*.18);
return {update(t){
 const a=smooth(t/enter),fin=smooth(t/(enter*.45)),b=smooth((duration-t)/exit),apart=(1-a)+(1-b),fade=fin*b;   // 出てくるのは速く、ずれが重なるのはゆっくり
 const shift=width*.045*apart,ghost=fade*Math.min(1,.2+.8*Math.min(1,apart*1.4));
 red.position.set(-shift,shift*.15,0);cyan.position.set(shift,-shift*.15,0);
 red.fillOpacity=ghost;cyan.fillOpacity=ghost;red.outlineOpacity=0;cyan.outlineOpacity=0;
 label.fillOpacity=fade;label.outlineOpacity=fade;
}};`},
 {key:'drop-settle',name:'落ちて静かに止まる',desc:'文字が上から落ちてきて、少し沈んでから静かに止まります。',added:'2026-10-08',poster:.5,source:`// 上から落ちて、わずかに沈み込んでから止まる。退場は上へ戻りながら消える
const {createText,text,width,height,duration}=api;
const label=createText(text,{maxWidth:width*.8,textAlign:'center',lineHeight:1.25,outlineWidth:'2%',outlineColor:'#101819'});
const clamp=x=>Math.max(0,Math.min(1,x));
const enter=Math.min(.7,duration*.25),exit=Math.min(.4,duration*.15);
const drop=height*.35;
return {update(t){
 const a=clamp(t/enter),b=clamp((duration-t)/exit);
 const fall=(1-a)*(1-a);                              // 落ちる間は速くなる
 const sink=Math.sin(Math.PI*clamp((a-.7)/.3))*height*.015;   // 着地の直前にわずかに沈む
 label.position.set(0,fall*drop-sink+(1-b)*drop*.4,0);
 const fade=clamp(t/(enter*.4))*b;
 label.fillOpacity=fade;label.outlineOpacity=fade;
}};`},
 {key:'squash-in',name:'ぐにゃっと伸びて止まる',desc:'横に平たく潰れた文字が、ぐにゃっと伸びて縦に弾み、止まります。',added:'2026-10-09',poster:.18,source:`// 平たく潰れた文字が、ばねのように伸び縮みしながら元の形に落ち着く。退場は縦に潰れて消える
const {createText,text,width,duration}=api;
const label=createText(text,{maxWidth:width*.7,textAlign:'center',lineHeight:1.25,outlineWidth:'2%',outlineColor:'#101819'});
const clamp=x=>Math.max(0,Math.min(1,x));
const enter=Math.min(.8,duration*.3),exit=Math.min(.4,duration*.15);
return {update(t){
 const u=clamp(t/enter),b=clamp((duration-t)/exit);
 const g=1-Math.exp(-5*u)*Math.cos(12*u);             // 0 から1を少し行き過ぎて、1へ落ち着く
 const sy=Math.max(.02,g)*b,sx=1+(1-g)*.5*(u<1?1:0);  // 縦が伸びる間、横は縮む
 label.scale.set(Math.max(.02,sx),sy,1);
 const fade=clamp(t/(enter*.25))*b;
 label.fillOpacity=fade;label.outlineOpacity=fade;
}};`},
 {key:'flip-up',name:'めくれて立ち上がる',desc:'横たわった文字が、手前へめくれるように起き上がって止まります。',added:'2026-10-10',poster:.12,source:`// 寝ていた文字が手前へ起き上がる（x軸まわりの回転）。わずかに行き過ぎてから止まり、退場は倒れながら消える
const {createText,text,width,duration}=api;
const label=createText(text,{maxWidth:width*.8,textAlign:'center',lineHeight:1.25,outlineWidth:'2%',outlineColor:'#101819'});
const clamp=x=>Math.max(0,Math.min(1,x));
const enter=Math.min(.75,duration*.28),exit=Math.min(.4,duration*.15);
return {update(t){
 const u=clamp(t/enter),b=clamp((duration-t)/exit);
 const g=1-Math.exp(-5*u)*Math.cos(9*u);              // 0 から1を少し行き過ぎて、1へ落ち着く
 label.rotation.x=(1-g)*1.45+(1-b)*1.2;
 label.position.set(0,-(1-g)*40*(width/480),0);
 const fade=clamp(t/(enter*.35))*b;
 label.fillOpacity=fade;label.outlineOpacity=fade;
}};`}
];
