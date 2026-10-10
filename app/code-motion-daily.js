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
}};`},
 {key:'gucha-gather',name:'散らかって集まる',desc:'画面じゅうに散らばった文字が、くるくる回りながら集まって並びます。',added:'2026-10-10',poster:.5,source:`// 散らばった文字が、ばねで元の位置へ集まる。退場は、また別の場所へ散らばって消える
const {THREE,scene,createText,text,width,height,fontSize,duration,random}=api;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
const spring=x=>{x=clamp(x);return 1-(1-x)*Math.exp(-3.4*x)*Math.cos(6.6*x)};
const mix=(a,b,k)=>a+(b-a)*k;
const hash=(a,b)=>{const s=Math.sin(a*127.1+b*311.7)*43758.5453;return s-Math.floor(s)};
const W=Math.max(1,width),H=Math.max(1,height),em=Math.max(8,fontSize||H*.18),life=Math.max(.05,duration);
const intro=Math.min(1.05,life*.38),outro=Math.min(.6,life*.2),stag=Math.min(.2,life*.07);
const root=new THREE.Group();scene.add(root);
const lines=[[]];let off=0;
for(const ch of Array.from(String(text||''))){if(ch==='\\r')continue;if(ch==='\\n'){lines.push([]);off+=1;continue;}lines[lines.length-1].push({ch,start:off});off+=ch.length;}
const count=lines.reduce((s,l)=>s+l.length,0),group=Math.max(1,Math.ceil(count/64));
const L=[];
lines.forEach((line,r)=>{for(let k=0;k<line.length;k+=group){const part=line.slice(k,k+group),value=part.map(p=>p.ch).join('');
 const w=em*Math.max(.3,part.reduce((s,p)=>s+(/\\s/.test(p.ch)?.32:p.ch.codePointAt(0)<256?.6:1),0));
 if(!value.trim()){L.push({row:r,w,meshes:[],blank:true});continue;}
 const mesh=createText(value,{textStart:part[0].start,fontSize:em,anchorX:'center',anchorY:'middle',outlineWidth:'3%',outlineColor:'#101819'});
 mesh.fillOpacity=0;mesh.outlineOpacity=0;root.add(mesh);
 L.push({row:r,w,mesh,meshes:[mesh],value,start:part[0].start,info:null,r1:random(),r2:random(),r3:random(),r4:random(),x:0,y:0});}});
const vis=L.filter(l=>l.mesh);vis.forEach((l,j)=>{l.i=j;l.o=vis.length>1?j/(vis.length-1):.5;});
let fit=1,laid=false,dead=false;
function layout(){
 const gap=em*.06,limit=W*.86,rows=[];
 const hard=[];for(const l of L)(hard[l.row]=hard[l.row]||[]).push(l);
 for(const row of hard){if(!row)continue;let cur=[],x=0;
  for(const l of row){const b=l.mesh&&l.mesh.textRenderInfo&&l.mesh.textRenderInfo.blockBounds;
   if(b&&b.length===4&&b.every(Number.isFinite))l.w=Math.max(em*.2,b[2]-b[0]);
   if(cur.length&&x+gap+l.w>limit){rows.push(cur);cur=[];x=0;}
   x+=(cur.length?gap:0)+l.w;cur.push(l);}
  rows.push(cur);}
 const step=em*1.25;let maxW=1;
 rows.forEach((row,r)=>{let x=0;for(const l of row){l.x=x+l.w/2;x+=l.w+gap;}const tw=x-gap;maxW=Math.max(maxW,tw);for(const l of row){l.x-=tw/2;l.y=((rows.length-1)/2-r)*step;}});
 fit=Math.min(1,W*.84/maxW,H*.66/(rows.length*step));root.scale.setScalar(fit);
}
function place(l,x,y,rot,sx,sy,a){for(const m of l.meshes){m.position.set(x,y,0);m.rotation.z=rot;m.scale.set(sx,sy,1);m.fillOpacity=a;m.outlineOpacity=a;m.visible=a>.002;}}
function update(time){
 if(dead)return;const t=clamp(Number.isFinite(time)?time:0,0,life);
 let changed=!laid;for(const l of vis)if(l.mesh.textRenderInfo&&l.info!==l.mesh.textRenderInfo){l.info=l.mesh.textRenderInfo;changed=true;}
 if(changed){layout();laid=true;if(typeof onLaid==='function')onLaid();}
 for(const l of vis){const u=clamp((t-stag*l.o)/intro),v=clamp((life-t-stag*(1-l.o))/outro);pose(l,t,u,v);}
}
function dispose(){if(dead)return;dead=true;for(const l of L)for(const m of l.meshes){root.remove(m);m.dispose();}scene.remove(root);}
function pose(l,t,u,v){
 const e=spring(u),k=1-e,q=1-smooth(v);
 const x1=(l.r1-.5)*W*.95/fit,y1=(l.r2-.5)*H*.8/fit,x2=(l.r3-.5)*W*.95/fit,y2=(l.r4-.5)*H*.8/fit;
 let x=mix(l.x,x1,k),y=mix(l.y,y1,k);x=mix(x,x2,q);y=mix(y,y2,q);
 const rot=(l.r3-.5)*5*k+(l.r1-.5)*6*q+Math.sin(t*2.4+l.r2*6)*.025;
 const s=1+(l.r4-.4)*1.2*k-.5*q*q;
 place(l,x,y,rot,s,s,smooth(u*2)*smooth(v*2));
}
update(0);
return {update,dispose};`},
 {key:'gucha-melt',name:'とろけてたれる',desc:'文字がぷるんと現れて、最後は下へどろりと溶けて垂れていきます。',added:'2026-10-10',poster:.33,source:`// 横に太って縦に潰れた状態からぷるんと立つ。退場は縦に伸びながら下へ垂れて消える
const {THREE,scene,createText,text,width,height,fontSize,duration,random}=api;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
const spring=x=>{x=clamp(x);return 1-(1-x)*Math.exp(-3.4*x)*Math.cos(6.6*x)};
const mix=(a,b,k)=>a+(b-a)*k;
const hash=(a,b)=>{const s=Math.sin(a*127.1+b*311.7)*43758.5453;return s-Math.floor(s)};
const W=Math.max(1,width),H=Math.max(1,height),em=Math.max(8,fontSize||H*.18),life=Math.max(.05,duration);
const intro=Math.min(1.05,life*.38),outro=Math.min(.6,life*.2),stag=Math.min(.2,life*.07);
const root=new THREE.Group();scene.add(root);
const lines=[[]];let off=0;
for(const ch of Array.from(String(text||''))){if(ch==='\\r')continue;if(ch==='\\n'){lines.push([]);off+=1;continue;}lines[lines.length-1].push({ch,start:off});off+=ch.length;}
const count=lines.reduce((s,l)=>s+l.length,0),group=Math.max(1,Math.ceil(count/64));
const L=[];
lines.forEach((line,r)=>{for(let k=0;k<line.length;k+=group){const part=line.slice(k,k+group),value=part.map(p=>p.ch).join('');
 const w=em*Math.max(.3,part.reduce((s,p)=>s+(/\\s/.test(p.ch)?.32:p.ch.codePointAt(0)<256?.6:1),0));
 if(!value.trim()){L.push({row:r,w,meshes:[],blank:true});continue;}
 const mesh=createText(value,{textStart:part[0].start,fontSize:em,anchorX:'center',anchorY:'middle',outlineWidth:'3%',outlineColor:'#101819'});
 mesh.fillOpacity=0;mesh.outlineOpacity=0;root.add(mesh);
 L.push({row:r,w,mesh,meshes:[mesh],value,start:part[0].start,info:null,r1:random(),r2:random(),r3:random(),r4:random(),x:0,y:0});}});
const vis=L.filter(l=>l.mesh);vis.forEach((l,j)=>{l.i=j;l.o=vis.length>1?j/(vis.length-1):.5;});
let fit=1,laid=false,dead=false;
function layout(){
 const gap=em*.06,limit=W*.86,rows=[];
 const hard=[];for(const l of L)(hard[l.row]=hard[l.row]||[]).push(l);
 for(const row of hard){if(!row)continue;let cur=[],x=0;
  for(const l of row){const b=l.mesh&&l.mesh.textRenderInfo&&l.mesh.textRenderInfo.blockBounds;
   if(b&&b.length===4&&b.every(Number.isFinite))l.w=Math.max(em*.2,b[2]-b[0]);
   if(cur.length&&x+gap+l.w>limit){rows.push(cur);cur=[];x=0;}
   x+=(cur.length?gap:0)+l.w;cur.push(l);}
  rows.push(cur);}
 const step=em*1.25;let maxW=1;
 rows.forEach((row,r)=>{let x=0;for(const l of row){l.x=x+l.w/2;x+=l.w+gap;}const tw=x-gap;maxW=Math.max(maxW,tw);for(const l of row){l.x-=tw/2;l.y=((rows.length-1)/2-r)*step;}});
 fit=Math.min(1,W*.84/maxW,H*.66/(rows.length*step));root.scale.setScalar(fit);
}
function place(l,x,y,rot,sx,sy,a){for(const m of l.meshes){m.position.set(x,y,0);m.rotation.z=rot;m.scale.set(sx,sy,1);m.fillOpacity=a;m.outlineOpacity=a;m.visible=a>.002;}}
function update(time){
 if(dead)return;const t=clamp(Number.isFinite(time)?time:0,0,life);
 let changed=!laid;for(const l of vis)if(l.mesh.textRenderInfo&&l.info!==l.mesh.textRenderInfo){l.info=l.mesh.textRenderInfo;changed=true;}
 if(changed){layout();laid=true;if(typeof onLaid==='function')onLaid();}
 for(const l of vis){const u=clamp((t-stag*l.o)/intro),v=clamp((life-t-stag*(1-l.o))/outro);pose(l,t,u,v);}
}
function dispose(){if(dead)return;dead=true;for(const l of L)for(const m of l.meshes){root.remove(m);m.dispose();}scene.remove(root);}
function pose(l,t,u,v){
 const e=spring(u),q=1-smooth(v),sag=Math.sin(t*3+l.r1*6.283)*.03;
 const sx=(1+.9*(1-e))*(1-.45*q)*(1-sag),sy=(.15+.85*e)*(1+2.6*q*q)+sag*.8;
 const drop=q*q*em*(1.2+l.r2*1.6)+Math.max(0,sy-1)*em*.5;
 place(l,l.x+Math.sin(q*5+l.r3*6)*em*.05*q,l.y+(1-e)*em*.35-drop,Math.sin(q*3+l.r4*6)*.08*q,sx,Math.max(.05,sy),smooth(u*2.5)*(1-smooth(q*1.15)));
}
update(0);
return {update,dispose};`},
 {key:'gucha-boil',name:'手描きのぶるぶる',desc:'手描きアニメのように、文字が小刻みにぶるぶる震えながら現れます。',added:'2026-10-10',poster:.35,source:`// 10コマ/秒の手描きのゆれ。登場と退場では、ゆれが大きく荒れる
const {THREE,scene,createText,text,width,height,fontSize,duration,random}=api;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
const spring=x=>{x=clamp(x);return 1-(1-x)*Math.exp(-3.4*x)*Math.cos(6.6*x)};
const mix=(a,b,k)=>a+(b-a)*k;
const hash=(a,b)=>{const s=Math.sin(a*127.1+b*311.7)*43758.5453;return s-Math.floor(s)};
const W=Math.max(1,width),H=Math.max(1,height),em=Math.max(8,fontSize||H*.18),life=Math.max(.05,duration);
const intro=Math.min(1.05,life*.38),outro=Math.min(.6,life*.2),stag=Math.min(.2,life*.07);
const root=new THREE.Group();scene.add(root);
const lines=[[]];let off=0;
for(const ch of Array.from(String(text||''))){if(ch==='\\r')continue;if(ch==='\\n'){lines.push([]);off+=1;continue;}lines[lines.length-1].push({ch,start:off});off+=ch.length;}
const count=lines.reduce((s,l)=>s+l.length,0),group=Math.max(1,Math.ceil(count/64));
const L=[];
lines.forEach((line,r)=>{for(let k=0;k<line.length;k+=group){const part=line.slice(k,k+group),value=part.map(p=>p.ch).join('');
 const w=em*Math.max(.3,part.reduce((s,p)=>s+(/\\s/.test(p.ch)?.32:p.ch.codePointAt(0)<256?.6:1),0));
 if(!value.trim()){L.push({row:r,w,meshes:[],blank:true});continue;}
 const mesh=createText(value,{textStart:part[0].start,fontSize:em,anchorX:'center',anchorY:'middle',outlineWidth:'3%',outlineColor:'#101819'});
 mesh.fillOpacity=0;mesh.outlineOpacity=0;root.add(mesh);
 L.push({row:r,w,mesh,meshes:[mesh],value,start:part[0].start,info:null,r1:random(),r2:random(),r3:random(),r4:random(),x:0,y:0});}});
const vis=L.filter(l=>l.mesh);vis.forEach((l,j)=>{l.i=j;l.o=vis.length>1?j/(vis.length-1):.5;});
let fit=1,laid=false,dead=false;
function layout(){
 const gap=em*.06,limit=W*.86,rows=[];
 const hard=[];for(const l of L)(hard[l.row]=hard[l.row]||[]).push(l);
 for(const row of hard){if(!row)continue;let cur=[],x=0;
  for(const l of row){const b=l.mesh&&l.mesh.textRenderInfo&&l.mesh.textRenderInfo.blockBounds;
   if(b&&b.length===4&&b.every(Number.isFinite))l.w=Math.max(em*.2,b[2]-b[0]);
   if(cur.length&&x+gap+l.w>limit){rows.push(cur);cur=[];x=0;}
   x+=(cur.length?gap:0)+l.w;cur.push(l);}
  rows.push(cur);}
 const step=em*1.25;let maxW=1;
 rows.forEach((row,r)=>{let x=0;for(const l of row){l.x=x+l.w/2;x+=l.w+gap;}const tw=x-gap;maxW=Math.max(maxW,tw);for(const l of row){l.x-=tw/2;l.y=((rows.length-1)/2-r)*step;}});
 fit=Math.min(1,W*.84/maxW,H*.66/(rows.length*step));root.scale.setScalar(fit);
}
function place(l,x,y,rot,sx,sy,a){for(const m of l.meshes){m.position.set(x,y,0);m.rotation.z=rot;m.scale.set(sx,sy,1);m.fillOpacity=a;m.outlineOpacity=a;m.visible=a>.002;}}
function update(time){
 if(dead)return;const t=clamp(Number.isFinite(time)?time:0,0,life);
 let changed=!laid;for(const l of vis)if(l.mesh.textRenderInfo&&l.info!==l.mesh.textRenderInfo){l.info=l.mesh.textRenderInfo;changed=true;}
 if(changed){layout();laid=true;if(typeof onLaid==='function')onLaid();}
 for(const l of vis){const u=clamp((t-stag*l.o)/intro),v=clamp((life-t-stag*(1-l.o))/outro);pose(l,t,u,v);}
}
function dispose(){if(dead)return;dead=true;for(const l of L)for(const m of l.meshes){root.remove(m);m.dispose();}scene.remove(root);}
function pose(l,t,u,v){
 const tq=Math.floor(t*10),a=hash(l.i,tq),b=hash(l.i+7,tq),c=hash(l.i+13,tq);
 const loose=(1-smooth(u))+(1-smooth(v)),j=em*(.07+.26*loose);
 place(l,l.x+(a-.5)*j*2,l.y+(b-.5)*j*2,(c-.5)*(.12+.6*loose),1+(a-.5)*.16+.4*loose*(b-.5),1+(b-.5)*.1+.3*loose*(c-.5),smooth(u*3)*smooth(v*3));
}
update(0);
return {update,dispose};`},
 {key:'gucha-shuffle',name:'入れ替わって整列',desc:'文字が互いに入れ替わりながら弧を描いて動き、正しい並びに揃います。',added:'2026-10-10',poster:.5,source:`// 文字が互いの位置から弧を描いて元の位置へ。退場ではまた別の文字の位置へ入れ替わって消える
const {THREE,scene,createText,text,width,height,fontSize,duration,random}=api;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
const spring=x=>{x=clamp(x);return 1-(1-x)*Math.exp(-3.4*x)*Math.cos(6.6*x)};
const mix=(a,b,k)=>a+(b-a)*k;
const hash=(a,b)=>{const s=Math.sin(a*127.1+b*311.7)*43758.5453;return s-Math.floor(s)};
const W=Math.max(1,width),H=Math.max(1,height),em=Math.max(8,fontSize||H*.18),life=Math.max(.05,duration);
const intro=Math.min(1.05,life*.38),outro=Math.min(.6,life*.2),stag=Math.min(.2,life*.07);
const root=new THREE.Group();scene.add(root);
const lines=[[]];let off=0;
for(const ch of Array.from(String(text||''))){if(ch==='\\r')continue;if(ch==='\\n'){lines.push([]);off+=1;continue;}lines[lines.length-1].push({ch,start:off});off+=ch.length;}
const count=lines.reduce((s,l)=>s+l.length,0),group=Math.max(1,Math.ceil(count/64));
const L=[];
lines.forEach((line,r)=>{for(let k=0;k<line.length;k+=group){const part=line.slice(k,k+group),value=part.map(p=>p.ch).join('');
 const w=em*Math.max(.3,part.reduce((s,p)=>s+(/\\s/.test(p.ch)?.32:p.ch.codePointAt(0)<256?.6:1),0));
 if(!value.trim()){L.push({row:r,w,meshes:[],blank:true});continue;}
 const mesh=createText(value,{textStart:part[0].start,fontSize:em,anchorX:'center',anchorY:'middle',outlineWidth:'3%',outlineColor:'#101819'});
 mesh.fillOpacity=0;mesh.outlineOpacity=0;root.add(mesh);
 L.push({row:r,w,mesh,meshes:[mesh],value,start:part[0].start,info:null,r1:random(),r2:random(),r3:random(),r4:random(),x:0,y:0});}});
const vis=L.filter(l=>l.mesh);vis.forEach((l,j)=>{l.i=j;l.o=vis.length>1?j/(vis.length-1):.5;});
let fit=1,laid=false,dead=false;
function layout(){
 const gap=em*.06,limit=W*.86,rows=[];
 const hard=[];for(const l of L)(hard[l.row]=hard[l.row]||[]).push(l);
 for(const row of hard){if(!row)continue;let cur=[],x=0;
  for(const l of row){const b=l.mesh&&l.mesh.textRenderInfo&&l.mesh.textRenderInfo.blockBounds;
   if(b&&b.length===4&&b.every(Number.isFinite))l.w=Math.max(em*.2,b[2]-b[0]);
   if(cur.length&&x+gap+l.w>limit){rows.push(cur);cur=[];x=0;}
   x+=(cur.length?gap:0)+l.w;cur.push(l);}
  rows.push(cur);}
 const step=em*1.25;let maxW=1;
 rows.forEach((row,r)=>{let x=0;for(const l of row){l.x=x+l.w/2;x+=l.w+gap;}const tw=x-gap;maxW=Math.max(maxW,tw);for(const l of row){l.x-=tw/2;l.y=((rows.length-1)/2-r)*step;}});
 fit=Math.min(1,W*.84/maxW,H*.66/(rows.length*step));root.scale.setScalar(fit);
}
function place(l,x,y,rot,sx,sy,a){for(const m of l.meshes){m.position.set(x,y,0);m.rotation.z=rot;m.scale.set(sx,sy,1);m.fillOpacity=a;m.outlineOpacity=a;m.visible=a>.002;}}
function update(time){
 if(dead)return;const t=clamp(Number.isFinite(time)?time:0,0,life);
 let changed=!laid;for(const l of vis)if(l.mesh.textRenderInfo&&l.info!==l.mesh.textRenderInfo){l.info=l.mesh.textRenderInfo;changed=true;}
 if(changed){layout();laid=true;if(typeof onLaid==='function')onLaid();}
 for(const l of vis){const u=clamp((t-stag*l.o)/intro),v=clamp((life-t-stag*(1-l.o))/outro);pose(l,t,u,v);}
}
function dispose(){if(dead)return;dead=true;for(const l of L)for(const m of l.meshes){root.remove(m);m.dispose();}scene.remove(root);}
const order=vis.map(l=>l.i).sort((a,b)=>vis[a].r1-vis[b].r1||a-b),order2=vis.map(l=>l.i).sort((a,b)=>vis[a].r3-vis[b].r3||a-b);
function pose(l,t,u,v){
 const e=smooth(u),q=1-smooth(v),s1=vis[order[l.i]],s2=vis[order2[l.i]];
 const arc=(l.r2-.5)*em*3.2,bend=Math.sin(Math.PI*e)*arc,bend2=Math.sin(Math.PI*q)*arc;
 let x=mix(s1.x,l.x,e),y=mix(s1.y,l.y,e)+bend;
 x=mix(x,s2.x,q);y=mix(y,s2.y,q)+bend2;
 place(l,x,y,Math.sin(Math.PI*e)*(l.r4-.5)*1.4+Math.sin(Math.PI*q)*(l.r1-.5)*1.4,1,1,smooth(u*3)*smooth(v*3));
}
update(0);
return {update,dispose};`},
 {key:'gucha-pile',name:'山から弾けて広がる',desc:'文字がひと山に重なった状態から、ぱっと弾けて元の位置に広がります。',added:'2026-10-10',poster:.28,source:`// 全部の文字が重なった山から、ばねで弾けて並ぶ。退場は山へ吸い込まれて消える
const {THREE,scene,createText,text,width,height,fontSize,duration,random}=api;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
const spring=x=>{x=clamp(x);return 1-(1-x)*Math.exp(-3.4*x)*Math.cos(6.6*x)};
const mix=(a,b,k)=>a+(b-a)*k;
const hash=(a,b)=>{const s=Math.sin(a*127.1+b*311.7)*43758.5453;return s-Math.floor(s)};
const W=Math.max(1,width),H=Math.max(1,height),em=Math.max(8,fontSize||H*.18),life=Math.max(.05,duration);
const intro=Math.min(1.05,life*.38),outro=Math.min(.6,life*.2),stag=Math.min(.2,life*.07);
const root=new THREE.Group();scene.add(root);
const lines=[[]];let off=0;
for(const ch of Array.from(String(text||''))){if(ch==='\\r')continue;if(ch==='\\n'){lines.push([]);off+=1;continue;}lines[lines.length-1].push({ch,start:off});off+=ch.length;}
const count=lines.reduce((s,l)=>s+l.length,0),group=Math.max(1,Math.ceil(count/64));
const L=[];
lines.forEach((line,r)=>{for(let k=0;k<line.length;k+=group){const part=line.slice(k,k+group),value=part.map(p=>p.ch).join('');
 const w=em*Math.max(.3,part.reduce((s,p)=>s+(/\\s/.test(p.ch)?.32:p.ch.codePointAt(0)<256?.6:1),0));
 if(!value.trim()){L.push({row:r,w,meshes:[],blank:true});continue;}
 const mesh=createText(value,{textStart:part[0].start,fontSize:em,anchorX:'center',anchorY:'middle',outlineWidth:'3%',outlineColor:'#101819'});
 mesh.fillOpacity=0;mesh.outlineOpacity=0;root.add(mesh);
 L.push({row:r,w,mesh,meshes:[mesh],value,start:part[0].start,info:null,r1:random(),r2:random(),r3:random(),r4:random(),x:0,y:0});}});
const vis=L.filter(l=>l.mesh);vis.forEach((l,j)=>{l.i=j;l.o=vis.length>1?j/(vis.length-1):.5;});
let fit=1,laid=false,dead=false;
function layout(){
 const gap=em*.06,limit=W*.86,rows=[];
 const hard=[];for(const l of L)(hard[l.row]=hard[l.row]||[]).push(l);
 for(const row of hard){if(!row)continue;let cur=[],x=0;
  for(const l of row){const b=l.mesh&&l.mesh.textRenderInfo&&l.mesh.textRenderInfo.blockBounds;
   if(b&&b.length===4&&b.every(Number.isFinite))l.w=Math.max(em*.2,b[2]-b[0]);
   if(cur.length&&x+gap+l.w>limit){rows.push(cur);cur=[];x=0;}
   x+=(cur.length?gap:0)+l.w;cur.push(l);}
  rows.push(cur);}
 const step=em*1.25;let maxW=1;
 rows.forEach((row,r)=>{let x=0;for(const l of row){l.x=x+l.w/2;x+=l.w+gap;}const tw=x-gap;maxW=Math.max(maxW,tw);for(const l of row){l.x-=tw/2;l.y=((rows.length-1)/2-r)*step;}});
 fit=Math.min(1,W*.84/maxW,H*.66/(rows.length*step));root.scale.setScalar(fit);
}
function place(l,x,y,rot,sx,sy,a){for(const m of l.meshes){m.position.set(x,y,0);m.rotation.z=rot;m.scale.set(sx,sy,1);m.fillOpacity=a;m.outlineOpacity=a;m.visible=a>.002;}}
function update(time){
 if(dead)return;const t=clamp(Number.isFinite(time)?time:0,0,life);
 let changed=!laid;for(const l of vis)if(l.mesh.textRenderInfo&&l.info!==l.mesh.textRenderInfo){l.info=l.mesh.textRenderInfo;changed=true;}
 if(changed){layout();laid=true;if(typeof onLaid==='function')onLaid();}
 for(const l of vis){const u=clamp((t-stag*l.o)/intro),v=clamp((life-t-stag*(1-l.o))/outro);pose(l,t,u,v);}
}
function dispose(){if(dead)return;dead=true;for(const l of L)for(const m of l.meshes){root.remove(m);m.dispose();}scene.remove(root);}
function pose(l,t,u,v){
 const e=spring(u),q=1-smooth(v),px=(l.r1-.5)*em*.9,py=(l.r2-.5)*em*.6;
 let x=mix(px,l.x,e),y=mix(py,l.y,e);x=mix(x,px,q);y=mix(y,py,q);
 const rot=(l.r3-.5)*2.8*(1-e)+(l.r3-.5)*3.2*q,s=.55+.45*e-.4*q;
 place(l,x,y,rot,s,s,smooth(u*4)*smooth(v*4));
}
update(0);
return {update,dispose};`},
 {key:'gucha-spiral',name:'ぐるぐる巻き込む',desc:'文字が渦を巻きながら外から中へ入ってきて、元の位置に収まります。',added:'2026-10-10',poster:.45,source:`// 渦を巻いて外側から元の位置へ入る。退場は逆向きに巻き上げられて消える
const {THREE,scene,createText,text,width,height,fontSize,duration,random}=api;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
const spring=x=>{x=clamp(x);return 1-(1-x)*Math.exp(-3.4*x)*Math.cos(6.6*x)};
const mix=(a,b,k)=>a+(b-a)*k;
const hash=(a,b)=>{const s=Math.sin(a*127.1+b*311.7)*43758.5453;return s-Math.floor(s)};
const W=Math.max(1,width),H=Math.max(1,height),em=Math.max(8,fontSize||H*.18),life=Math.max(.05,duration);
const intro=Math.min(1.05,life*.38),outro=Math.min(.6,life*.2),stag=Math.min(.2,life*.07);
const root=new THREE.Group();scene.add(root);
const lines=[[]];let off=0;
for(const ch of Array.from(String(text||''))){if(ch==='\\r')continue;if(ch==='\\n'){lines.push([]);off+=1;continue;}lines[lines.length-1].push({ch,start:off});off+=ch.length;}
const count=lines.reduce((s,l)=>s+l.length,0),group=Math.max(1,Math.ceil(count/64));
const L=[];
lines.forEach((line,r)=>{for(let k=0;k<line.length;k+=group){const part=line.slice(k,k+group),value=part.map(p=>p.ch).join('');
 const w=em*Math.max(.3,part.reduce((s,p)=>s+(/\\s/.test(p.ch)?.32:p.ch.codePointAt(0)<256?.6:1),0));
 if(!value.trim()){L.push({row:r,w,meshes:[],blank:true});continue;}
 const mesh=createText(value,{textStart:part[0].start,fontSize:em,anchorX:'center',anchorY:'middle',outlineWidth:'3%',outlineColor:'#101819'});
 mesh.fillOpacity=0;mesh.outlineOpacity=0;root.add(mesh);
 L.push({row:r,w,mesh,meshes:[mesh],value,start:part[0].start,info:null,r1:random(),r2:random(),r3:random(),r4:random(),x:0,y:0});}});
const vis=L.filter(l=>l.mesh);vis.forEach((l,j)=>{l.i=j;l.o=vis.length>1?j/(vis.length-1):.5;});
let fit=1,laid=false,dead=false;
function layout(){
 const gap=em*.06,limit=W*.86,rows=[];
 const hard=[];for(const l of L)(hard[l.row]=hard[l.row]||[]).push(l);
 for(const row of hard){if(!row)continue;let cur=[],x=0;
  for(const l of row){const b=l.mesh&&l.mesh.textRenderInfo&&l.mesh.textRenderInfo.blockBounds;
   if(b&&b.length===4&&b.every(Number.isFinite))l.w=Math.max(em*.2,b[2]-b[0]);
   if(cur.length&&x+gap+l.w>limit){rows.push(cur);cur=[];x=0;}
   x+=(cur.length?gap:0)+l.w;cur.push(l);}
  rows.push(cur);}
 const step=em*1.25;let maxW=1;
 rows.forEach((row,r)=>{let x=0;for(const l of row){l.x=x+l.w/2;x+=l.w+gap;}const tw=x-gap;maxW=Math.max(maxW,tw);for(const l of row){l.x-=tw/2;l.y=((rows.length-1)/2-r)*step;}});
 fit=Math.min(1,W*.84/maxW,H*.66/(rows.length*step));root.scale.setScalar(fit);
}
function place(l,x,y,rot,sx,sy,a){for(const m of l.meshes){m.position.set(x,y,0);m.rotation.z=rot;m.scale.set(sx,sy,1);m.fillOpacity=a;m.outlineOpacity=a;m.visible=a>.002;}}
function update(time){
 if(dead)return;const t=clamp(Number.isFinite(time)?time:0,0,life);
 let changed=!laid;for(const l of vis)if(l.mesh.textRenderInfo&&l.info!==l.mesh.textRenderInfo){l.info=l.mesh.textRenderInfo;changed=true;}
 if(changed){layout();laid=true;if(typeof onLaid==='function')onLaid();}
 for(const l of vis){const u=clamp((t-stag*l.o)/intro),v=clamp((life-t-stag*(1-l.o))/outro);pose(l,t,u,v);}
}
function dispose(){if(dead)return;dead=true;for(const l of L)for(const m of l.meshes){root.remove(m);m.dispose();}scene.remove(root);}
function pose(l,t,u,v){
 const k=1-smooth(u),q=1-smooth(v),m=k+q,a=l.r2*6.283+m*6.283*1.5*(l.r4>.5?1:-1),R=m*W*.4/fit*(.4+.6*l.r1);
 place(l,l.x+Math.cos(a)*R,l.y+Math.sin(a)*R*.7,a*.6,1-.45*Math.min(1,m),1-.45*Math.min(1,m),smooth(u*2.2)*smooth(v*2.2));
}
update(0);
return {update,dispose};`},
 {key:'gucha-tangle',name:'絡まってほどける',desc:'糸くずのように絡まって揺れていた文字が、ほどけて一列に整います。',added:'2026-10-10',poster:.45,source:`// リサジュー曲線で絡まった状態から、振れ幅を減らしてほどける。退場は再び絡まって消える
const {THREE,scene,createText,text,width,height,fontSize,duration,random}=api;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
const spring=x=>{x=clamp(x);return 1-(1-x)*Math.exp(-3.4*x)*Math.cos(6.6*x)};
const mix=(a,b,k)=>a+(b-a)*k;
const hash=(a,b)=>{const s=Math.sin(a*127.1+b*311.7)*43758.5453;return s-Math.floor(s)};
const W=Math.max(1,width),H=Math.max(1,height),em=Math.max(8,fontSize||H*.18),life=Math.max(.05,duration);
const intro=Math.min(1.05,life*.38),outro=Math.min(.6,life*.2),stag=Math.min(.2,life*.07);
const root=new THREE.Group();scene.add(root);
const lines=[[]];let off=0;
for(const ch of Array.from(String(text||''))){if(ch==='\\r')continue;if(ch==='\\n'){lines.push([]);off+=1;continue;}lines[lines.length-1].push({ch,start:off});off+=ch.length;}
const count=lines.reduce((s,l)=>s+l.length,0),group=Math.max(1,Math.ceil(count/64));
const L=[];
lines.forEach((line,r)=>{for(let k=0;k<line.length;k+=group){const part=line.slice(k,k+group),value=part.map(p=>p.ch).join('');
 const w=em*Math.max(.3,part.reduce((s,p)=>s+(/\\s/.test(p.ch)?.32:p.ch.codePointAt(0)<256?.6:1),0));
 if(!value.trim()){L.push({row:r,w,meshes:[],blank:true});continue;}
 const mesh=createText(value,{textStart:part[0].start,fontSize:em,anchorX:'center',anchorY:'middle',outlineWidth:'3%',outlineColor:'#101819'});
 mesh.fillOpacity=0;mesh.outlineOpacity=0;root.add(mesh);
 L.push({row:r,w,mesh,meshes:[mesh],value,start:part[0].start,info:null,r1:random(),r2:random(),r3:random(),r4:random(),x:0,y:0});}});
const vis=L.filter(l=>l.mesh);vis.forEach((l,j)=>{l.i=j;l.o=vis.length>1?j/(vis.length-1):.5;});
let fit=1,laid=false,dead=false;
function layout(){
 const gap=em*.06,limit=W*.86,rows=[];
 const hard=[];for(const l of L)(hard[l.row]=hard[l.row]||[]).push(l);
 for(const row of hard){if(!row)continue;let cur=[],x=0;
  for(const l of row){const b=l.mesh&&l.mesh.textRenderInfo&&l.mesh.textRenderInfo.blockBounds;
   if(b&&b.length===4&&b.every(Number.isFinite))l.w=Math.max(em*.2,b[2]-b[0]);
   if(cur.length&&x+gap+l.w>limit){rows.push(cur);cur=[];x=0;}
   x+=(cur.length?gap:0)+l.w;cur.push(l);}
  rows.push(cur);}
 const step=em*1.25;let maxW=1;
 rows.forEach((row,r)=>{let x=0;for(const l of row){l.x=x+l.w/2;x+=l.w+gap;}const tw=x-gap;maxW=Math.max(maxW,tw);for(const l of row){l.x-=tw/2;l.y=((rows.length-1)/2-r)*step;}});
 fit=Math.min(1,W*.84/maxW,H*.66/(rows.length*step));root.scale.setScalar(fit);
}
function place(l,x,y,rot,sx,sy,a){for(const m of l.meshes){m.position.set(x,y,0);m.rotation.z=rot;m.scale.set(sx,sy,1);m.fillOpacity=a;m.outlineOpacity=a;m.visible=a>.002;}}
function update(time){
 if(dead)return;const t=clamp(Number.isFinite(time)?time:0,0,life);
 let changed=!laid;for(const l of vis)if(l.mesh.textRenderInfo&&l.info!==l.mesh.textRenderInfo){l.info=l.mesh.textRenderInfo;changed=true;}
 if(changed){layout();laid=true;if(typeof onLaid==='function')onLaid();}
 for(const l of vis){const u=clamp((t-stag*l.o)/intro),v=clamp((life-t-stag*(1-l.o))/outro);pose(l,t,u,v);}
}
function dispose(){if(dead)return;dead=true;for(const l of L)for(const m of l.meshes){root.remove(m);m.dispose();}scene.remove(root);}
function pose(l,t,u,v){
 const m=(1-smooth(u))+(1-smooth(v)),A=em*2.3*m*(.5+l.r1);
 place(l,l.x+Math.sin(t*(2.2+l.r2*2)+l.r3*6.283)*A,l.y+Math.cos(t*(1.8+l.r4*2.2)+l.r1*6.283)*A*.6,Math.sin(t*3+l.r2*6)*.9*Math.min(1,m),1+.25*Math.min(1,m)*Math.sin(t*4+l.r4*6),1,smooth(u*2.5)*smooth(v*2.5));
}
update(0);
return {update,dispose};`},
 {key:'gucha-tiles',name:'割れて組み上がる',desc:'文字が細かいかけらに割れていて、ひとつずつ飛んできて組み上がります。',added:'2026-10-10',poster:.6,source:`// 文字を2×3のかけらに割り、かけらごとに時間差で飛んできて組み上がる。退場は割れて落ちる
const {THREE,scene,createText,text,width,height,fontSize,duration,random}=api;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
const spring=x=>{x=clamp(x);return 1-(1-x)*Math.exp(-3.4*x)*Math.cos(6.6*x)};
const mix=(a,b,k)=>a+(b-a)*k;
const hash=(a,b)=>{const s=Math.sin(a*127.1+b*311.7)*43758.5453;return s-Math.floor(s)};
const W=Math.max(1,width),H=Math.max(1,height),em=Math.max(8,fontSize||H*.18),life=Math.max(.05,duration);
const intro=Math.min(1.05,life*.38),outro=Math.min(.6,life*.2),stag=Math.min(.2,life*.07);
const root=new THREE.Group();scene.add(root);
const lines=[[]];let off=0;
for(const ch of Array.from(String(text||''))){if(ch==='\\r')continue;if(ch==='\\n'){lines.push([]);off+=1;continue;}lines[lines.length-1].push({ch,start:off});off+=ch.length;}
const count=lines.reduce((s,l)=>s+l.length,0),group=Math.max(1,Math.ceil(count/64));
const L=[];
lines.forEach((line,r)=>{for(let k=0;k<line.length;k+=group){const part=line.slice(k,k+group),value=part.map(p=>p.ch).join('');
 const w=em*Math.max(.3,part.reduce((s,p)=>s+(/\\s/.test(p.ch)?.32:p.ch.codePointAt(0)<256?.6:1),0));
 if(!value.trim()){L.push({row:r,w,meshes:[],blank:true});continue;}
 const mesh=createText(value,{textStart:part[0].start,fontSize:em,anchorX:'center',anchorY:'middle',outlineWidth:'3%',outlineColor:'#101819'});
 mesh.fillOpacity=0;mesh.outlineOpacity=0;root.add(mesh);
 L.push({row:r,w,mesh,meshes:[mesh],value,start:part[0].start,info:null,r1:random(),r2:random(),r3:random(),r4:random(),x:0,y:0});}});
const vis=L.filter(l=>l.mesh);vis.forEach((l,j)=>{l.i=j;l.o=vis.length>1?j/(vis.length-1):.5;});
let fit=1,laid=false,dead=false;
function layout(){
 const gap=em*.06,limit=W*.86,rows=[];
 const hard=[];for(const l of L)(hard[l.row]=hard[l.row]||[]).push(l);
 for(const row of hard){if(!row)continue;let cur=[],x=0;
  for(const l of row){const b=l.mesh&&l.mesh.textRenderInfo&&l.mesh.textRenderInfo.blockBounds;
   if(b&&b.length===4&&b.every(Number.isFinite))l.w=Math.max(em*.2,b[2]-b[0]);
   if(cur.length&&x+gap+l.w>limit){rows.push(cur);cur=[];x=0;}
   x+=(cur.length?gap:0)+l.w;cur.push(l);}
  rows.push(cur);}
 const step=em*1.25;let maxW=1;
 rows.forEach((row,r)=>{let x=0;for(const l of row){l.x=x+l.w/2;x+=l.w+gap;}const tw=x-gap;maxW=Math.max(maxW,tw);for(const l of row){l.x-=tw/2;l.y=((rows.length-1)/2-r)*step;}});
 fit=Math.min(1,W*.84/maxW,H*.66/(rows.length*step));root.scale.setScalar(fit);
}
function place(l,x,y,rot,sx,sy,a){for(const m of l.meshes){m.position.set(x,y,0);m.rotation.z=rot;m.scale.set(sx,sy,1);m.fillOpacity=a;m.outlineOpacity=a;m.visible=a>.002;}}
function update(time){
 if(dead)return;const t=clamp(Number.isFinite(time)?time:0,0,life);
 let changed=!laid;for(const l of vis)if(l.mesh.textRenderInfo&&l.info!==l.mesh.textRenderInfo){l.info=l.mesh.textRenderInfo;changed=true;}
 if(changed){layout();laid=true;if(typeof onLaid==='function')onLaid();}
 for(const l of vis){const u=clamp((t-stag*l.o)/intro),v=clamp((life-t-stag*(1-l.o))/outro);pose(l,t,u,v);}
}
function dispose(){if(dead)return;dead=true;for(const l of L)for(const m of l.meshes){root.remove(m);m.dispose();}scene.remove(root);}
const budget=Math.floor(150/Math.max(1,vis.length)),rowsN=budget>=6?3:budget>=2?2:1,colsN=budget>=4?2:1,per=rowsN*colsN;
for(const l of vis){l.tiles=[l.mesh];
 for(let k=1;k<per;k++){const m=createText(l.value,{textStart:l.start,fontSize:em,anchorX:'center',anchorY:'middle',outlineWidth:'3%',outlineColor:'#101819'});m.fillOpacity=0;m.outlineOpacity=0;root.add(m);l.meshes.push(m);l.tiles.push(m);}
 l.tr=l.tiles.map((_,k)=>({a:hash(l.i,k*3+1),b:hash(l.i,k*3+2),c:hash(l.i,k*3+3)}));l.cell=l.tiles.map(()=>({x:0,y:0}));}
function onLaid(){
 for(const l of vis){const b=l.info&&l.info.blockBounds;if(!b||b.length!==4||!b.every(Number.isFinite))continue;
  const w=b[2]-b[0],h=b[3]-b[1],bx=(b[0]+b[2])/2,by=(b[1]+b[3])/2;
  l.tiles.forEach((m,k)=>{if(per===1){m.clipRect=null;return;}
   const cx=k%colsN,cy=Math.floor(k/colsN);
   m.clipRect=[b[0]+w*cx/colsN-1,b[3]-h*(cy+1)/rowsN-1,b[0]+w*(cx+1)/colsN+1,b[3]-h*cy/rowsN+1];
   l.cell[k]={x:b[0]+w*(cx+.5)/colsN-bx,y:b[3]-h*(cy+.5)/rowsN-by};});}
}
function pose(l,t,u,v){
 l.tiles.forEach((m,k)=>{const r=l.tr[k],c=l.cell[k];
  const e=spring(clamp((t-stag*l.o-r.c*.3)/(intro*.8))),q=1-smooth(clamp((life-t-stag*(1-l.o)-r.b*.15)/outro));
  const fx=(r.a-.5)*W*.55/fit*(1-e)+(r.a-.5)*em*3*q,fy=(r.b-.5)*H*.7/fit*(1-e)-q*q*em*(2+r.c*3);
  const rot=(r.b-.5)*3.4*(1-e)+(r.a-.5)*2.6*q,s=1-.35*(1-e)-.2*q,cs=Math.cos(rot),sn=Math.sin(rot);
  m.position.set(l.x+c.x-(c.x*cs-c.y*sn)*s+fx,l.y+c.y-(c.x*sn+c.y*cs)*s+fy,0);
  m.rotation.z=rot;m.scale.set(s,s,1);
  const a=smooth(e*3)*(1-smooth(q*1.2));m.fillOpacity=a;m.outlineOpacity=a;m.visible=a>.002;});
}
update(0);
return {update,dispose};`},
 {key:'gucha-burst',name:'弾けて降り注ぐ',desc:'文字が真ん中から弾け飛び、弧を描いて降りて、元の位置で小さく弾みます。',added:'2026-10-10',poster:.6,source:`// 中心から放物線で飛んで元の位置に着地し、小さく弾んで止まる。退場は重力で下へ落ちて消える
const {THREE,scene,createText,text,width,height,fontSize,duration,random}=api;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
const spring=x=>{x=clamp(x);return 1-(1-x)*Math.exp(-3.4*x)*Math.cos(6.6*x)};
const mix=(a,b,k)=>a+(b-a)*k;
const hash=(a,b)=>{const s=Math.sin(a*127.1+b*311.7)*43758.5453;return s-Math.floor(s)};
const W=Math.max(1,width),H=Math.max(1,height),em=Math.max(8,fontSize||H*.18),life=Math.max(.05,duration);
const intro=Math.min(1.05,life*.38),outro=Math.min(.6,life*.2),stag=Math.min(.2,life*.07);
const root=new THREE.Group();scene.add(root);
const lines=[[]];let off=0;
for(const ch of Array.from(String(text||''))){if(ch==='\\r')continue;if(ch==='\\n'){lines.push([]);off+=1;continue;}lines[lines.length-1].push({ch,start:off});off+=ch.length;}
const count=lines.reduce((s,l)=>s+l.length,0),group=Math.max(1,Math.ceil(count/64));
const L=[];
lines.forEach((line,r)=>{for(let k=0;k<line.length;k+=group){const part=line.slice(k,k+group),value=part.map(p=>p.ch).join('');
 const w=em*Math.max(.3,part.reduce((s,p)=>s+(/\\s/.test(p.ch)?.32:p.ch.codePointAt(0)<256?.6:1),0));
 if(!value.trim()){L.push({row:r,w,meshes:[],blank:true});continue;}
 const mesh=createText(value,{textStart:part[0].start,fontSize:em,anchorX:'center',anchorY:'middle',outlineWidth:'3%',outlineColor:'#101819'});
 mesh.fillOpacity=0;mesh.outlineOpacity=0;root.add(mesh);
 L.push({row:r,w,mesh,meshes:[mesh],value,start:part[0].start,info:null,r1:random(),r2:random(),r3:random(),r4:random(),x:0,y:0});}});
const vis=L.filter(l=>l.mesh);vis.forEach((l,j)=>{l.i=j;l.o=vis.length>1?j/(vis.length-1):.5;});
let fit=1,laid=false,dead=false;
function layout(){
 const gap=em*.06,limit=W*.86,rows=[];
 const hard=[];for(const l of L)(hard[l.row]=hard[l.row]||[]).push(l);
 for(const row of hard){if(!row)continue;let cur=[],x=0;
  for(const l of row){const b=l.mesh&&l.mesh.textRenderInfo&&l.mesh.textRenderInfo.blockBounds;
   if(b&&b.length===4&&b.every(Number.isFinite))l.w=Math.max(em*.2,b[2]-b[0]);
   if(cur.length&&x+gap+l.w>limit){rows.push(cur);cur=[];x=0;}
   x+=(cur.length?gap:0)+l.w;cur.push(l);}
  rows.push(cur);}
 const step=em*1.25;let maxW=1;
 rows.forEach((row,r)=>{let x=0;for(const l of row){l.x=x+l.w/2;x+=l.w+gap;}const tw=x-gap;maxW=Math.max(maxW,tw);for(const l of row){l.x-=tw/2;l.y=((rows.length-1)/2-r)*step;}});
 fit=Math.min(1,W*.84/maxW,H*.66/(rows.length*step));root.scale.setScalar(fit);
}
function place(l,x,y,rot,sx,sy,a){for(const m of l.meshes){m.position.set(x,y,0);m.rotation.z=rot;m.scale.set(sx,sy,1);m.fillOpacity=a;m.outlineOpacity=a;m.visible=a>.002;}}
function update(time){
 if(dead)return;const t=clamp(Number.isFinite(time)?time:0,0,life);
 let changed=!laid;for(const l of vis)if(l.mesh.textRenderInfo&&l.info!==l.mesh.textRenderInfo){l.info=l.mesh.textRenderInfo;changed=true;}
 if(changed){layout();laid=true;if(typeof onLaid==='function')onLaid();}
 for(const l of vis){const u=clamp((t-stag*l.o)/intro),v=clamp((life-t-stag*(1-l.o))/outro);pose(l,t,u,v);}
}
function dispose(){if(dead)return;dead=true;for(const l of L)for(const m of l.meshes){root.remove(m);m.dispose();}scene.remove(root);}
function pose(l,t,u,v){
 const tau=clamp((t-stag*l.o)/intro),land=stag*l.o+intro,bt=Math.max(0,t-land),q=1-smooth(v);
 const apex=em*(1.6+3.2*l.r1),side=(l.r2-.5)*em*4;
 let x=mix((l.r3-.5)*em,l.x,smooth(tau)),y=mix((l.r4-.5)*em*.5,l.y,tau)+4*apex*tau*(1-tau);
 y+=Math.abs(Math.sin(bt*Math.PI*3.2))*em*.3*Math.exp(-5*bt)*(tau>=1?1:0);
 x+=Math.sin(Math.PI*tau)*side;
 const rot=(l.r3-.5)*7*(1-tau)+(l.r1-.5)*5*q*q,fall=q*q*H*.9/fit;
 place(l,x+(l.r2-.5)*em*2*q,y-fall,rot,1,1,smooth(u*5)*(1-smooth(q*1.1)));
}
update(0);
return {update,dispose};`},
 {key:'gucha-wobble',name:'ぐにゃぐにゃ波打つ',desc:'文字がぐにゃぐにゃと波打つように揺れながら現れて、ぴたりと止まります。',added:'2026-10-10',poster:.3,source:`// 左から右へ波が走り、文字が縦横に伸び縮みして傾く。波の大きさは登場で最大になり、だんだん静まる
const {THREE,scene,createText,text,width,height,fontSize,duration,random}=api;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
const spring=x=>{x=clamp(x);return 1-(1-x)*Math.exp(-3.4*x)*Math.cos(6.6*x)};
const mix=(a,b,k)=>a+(b-a)*k;
const hash=(a,b)=>{const s=Math.sin(a*127.1+b*311.7)*43758.5453;return s-Math.floor(s)};
const W=Math.max(1,width),H=Math.max(1,height),em=Math.max(8,fontSize||H*.18),life=Math.max(.05,duration);
const intro=Math.min(1.05,life*.38),outro=Math.min(.6,life*.2),stag=Math.min(.2,life*.07);
const root=new THREE.Group();scene.add(root);
const lines=[[]];let off=0;
for(const ch of Array.from(String(text||''))){if(ch==='\\r')continue;if(ch==='\\n'){lines.push([]);off+=1;continue;}lines[lines.length-1].push({ch,start:off});off+=ch.length;}
const count=lines.reduce((s,l)=>s+l.length,0),group=Math.max(1,Math.ceil(count/64));
const L=[];
lines.forEach((line,r)=>{for(let k=0;k<line.length;k+=group){const part=line.slice(k,k+group),value=part.map(p=>p.ch).join('');
 const w=em*Math.max(.3,part.reduce((s,p)=>s+(/\\s/.test(p.ch)?.32:p.ch.codePointAt(0)<256?.6:1),0));
 if(!value.trim()){L.push({row:r,w,meshes:[],blank:true});continue;}
 const mesh=createText(value,{textStart:part[0].start,fontSize:em,anchorX:'center',anchorY:'middle',outlineWidth:'3%',outlineColor:'#101819'});
 mesh.fillOpacity=0;mesh.outlineOpacity=0;root.add(mesh);
 L.push({row:r,w,mesh,meshes:[mesh],value,start:part[0].start,info:null,r1:random(),r2:random(),r3:random(),r4:random(),x:0,y:0});}});
const vis=L.filter(l=>l.mesh);vis.forEach((l,j)=>{l.i=j;l.o=vis.length>1?j/(vis.length-1):.5;});
let fit=1,laid=false,dead=false;
function layout(){
 const gap=em*.06,limit=W*.86,rows=[];
 const hard=[];for(const l of L)(hard[l.row]=hard[l.row]||[]).push(l);
 for(const row of hard){if(!row)continue;let cur=[],x=0;
  for(const l of row){const b=l.mesh&&l.mesh.textRenderInfo&&l.mesh.textRenderInfo.blockBounds;
   if(b&&b.length===4&&b.every(Number.isFinite))l.w=Math.max(em*.2,b[2]-b[0]);
   if(cur.length&&x+gap+l.w>limit){rows.push(cur);cur=[];x=0;}
   x+=(cur.length?gap:0)+l.w;cur.push(l);}
  rows.push(cur);}
 const step=em*1.25;let maxW=1;
 rows.forEach((row,r)=>{let x=0;for(const l of row){l.x=x+l.w/2;x+=l.w+gap;}const tw=x-gap;maxW=Math.max(maxW,tw);for(const l of row){l.x-=tw/2;l.y=((rows.length-1)/2-r)*step;}});
 fit=Math.min(1,W*.84/maxW,H*.66/(rows.length*step));root.scale.setScalar(fit);
}
function place(l,x,y,rot,sx,sy,a){for(const m of l.meshes){m.position.set(x,y,0);m.rotation.z=rot;m.scale.set(sx,sy,1);m.fillOpacity=a;m.outlineOpacity=a;m.visible=a>.002;}}
function update(time){
 if(dead)return;const t=clamp(Number.isFinite(time)?time:0,0,life);
 let changed=!laid;for(const l of vis)if(l.mesh.textRenderInfo&&l.info!==l.mesh.textRenderInfo){l.info=l.mesh.textRenderInfo;changed=true;}
 if(changed){layout();laid=true;if(typeof onLaid==='function')onLaid();}
 for(const l of vis){const u=clamp((t-stag*l.o)/intro),v=clamp((life-t-stag*(1-l.o))/outro);pose(l,t,u,v);}
}
function dispose(){if(dead)return;dead=true;for(const l of L)for(const m of l.meshes){root.remove(m);m.dispose();}scene.remove(root);}
function pose(l,t,u,v){
 const A=(1-smooth(u))*1.9+(1-smooth(v))*1.7+.16,ph=l.i*.75-t*9.5;
 place(l,l.x+Math.sin(ph*.7+1)*em*.12*A,l.y+Math.sin(ph)*em*.38*A,Math.sin(ph+.6)*.5*A,1+Math.sin(ph+1.4)*.4*A,1+Math.cos(ph)*.45*A,smooth(u*3)*smooth(v*3));
}
update(0);
return {update,dispose};`}
];
