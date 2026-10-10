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
return {update,dispose};`},
 {key:'shader-nebula',name:'うねる色の霧',desc:'色が溶けあうフルシェーダーの霧が、文字の後ろでうねりながら現れます。',added:'2026-10-10',poster:1.1,source:`// フルのフラグメントシェーダー（#define / uniform / main）で、色の溶けあう霧を文字の後ろにうねらせる
const {THREE,scene,createText,text,width,height,fontSize,duration,accent}=api;
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
const enter=Math.min(.9,duration*.32),exit=Math.min(.55,duration*.2);
// 画面いっぱいの板に貼る頂点シェーダー（vUv は 0〜1 の画面位置）
const VERT=\`varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}\`;
// ここからが「フルシェーダー」。GLSLをそのまま書ける
const FRAG=\`precision highp float;
#define TAU 6.28318530718
#define ROT(a) mat2(cos(a),-sin(a),sin(a),cos(a))
uniform float u_time;       // 行が始まってからの秒
uniform float u_fade;       // 登場・退場で 0→1→0
uniform vec2 u_resolution;
uniform vec3 u_accent;      // 歌詞の強調色
varying vec2 vUv;
float hash21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){
  vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x),f.y);
}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*noise(p);p=ROT(.5)*p*2.03+7.1;a*=.5;}return s;}
void main(){
  float aspect=u_resolution.x/u_resolution.y;
  vec2 p=(vUv-.5)*vec2(aspect,1.);
  float t=u_time*.3;
  vec2 q=vec2(fbm(p*2.2+t),fbm(p*2.2+vec2(5.2,1.3)-t));
  vec2 r=vec2(fbm(p*2.2+3.*q+vec2(1.7,9.2)+.4*t),fbm(p*2.2+3.*q+vec2(8.3,2.8)-.3*t));
  float f=fbm(p*2.2+3.*r);
  float hue=f*3.2+q.x*.8+t*.2;                        // 濃さに応じて色相を大きく振る
  vec3 col=.62+.38*cos(TAU*(hue+vec3(0.,.33,.67)));
  col=mix(col,u_accent,smoothstep(.5,.9,length(q))*.6);
  float cloud=smoothstep(.26,.52,f);
  float oval=1.-smoothstep(.55,1.,length(p/vec2(.62,.34)));
  gl_FragColor=vec4(col,cloud*oval*u_fade);
}\`;
const material=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,vertexShader:VERT,fragmentShader:FRAG,
  uniforms:{u_time:{value:0},u_fade:{value:0},u_resolution:{value:new THREE.Vector2(width,height)},u_accent:{value:new THREE.Color(accent)}}});
const quad=new THREE.Mesh(new THREE.PlaneGeometry(width,height),material);
quad.position.z=-10;quad.renderOrder=-1;scene.add(quad);      // 文字より後ろ
const label=createText(text,{maxWidth:width*.78,textAlign:'center',lineHeight:1.25,anchorX:'center',anchorY:'middle',outlineWidth:'4%',outlineColor:'#0b0f14'});
let fitted=false;
function update(t){
  if(!fitted&&label.textRenderInfo){const b=label.textRenderInfo.blockBounds;label.scale.setScalar(Math.min(1,height*.62/Math.max(1,b[3]-b[1])));fitted=true;}
  const a=smooth(t/enter),b=smooth((duration-t)/exit);
  material.uniforms.u_time.value=t;material.uniforms.u_fade.value=a*b;
  const f=smooth(t/(enter*.7))*b;label.fillOpacity=f;label.outlineOpacity=f;
}
function dispose(){quad.geometry.dispose();material.dispose();}
update(0);
return {update,dispose};`},
 {key:'shader-dots',name:'波打つドットの海',desc:'ドットの大きさが波のように変わる網点が、文字の後ろに帯になって流れます。',added:'2026-10-10',poster:1.1,source:`// ドットの大きさが波のように変わる網点を、横長の帯にして文字の後ろに流す（フルシェーダー）
const {THREE,scene,createText,text,width,height,fontSize,duration,accent}=api;
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
const enter=Math.min(.9,duration*.32),exit=Math.min(.55,duration*.2);
const VERT=\`varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}\`;
const FRAG=\`precision highp float;
#define TAU 6.28318530718
#define CELLS 30.0          // 縦に並べる網点の数
uniform float u_time;
uniform float u_fade;
uniform vec2 u_resolution;
uniform vec3 u_accent;
varying vec2 vUv;
void main(){
  float aspect=u_resolution.x/u_resolution.y;
  vec2 p=(vUv-.5)*vec2(aspect,1.);
  vec2 g=p*CELLS,id=floor(g),f=fract(g)-.5;
  // 3つの波を足して、マスごとの大きさにする
  float wave=sin(id.x*.33+u_time*2.2)+sin(id.y*.5-u_time*1.7)+sin((id.x+id.y)*.21+u_time*1.1);
  float radius=.14+.3*(.5+.5*wave/3.);
  float disc=1.-smoothstep(radius-.07,radius,length(f));
  vec3 col=.55+.45*cos(TAU*(vec3(0.,.33,.67)+id.x*.011+id.y*.02+u_time*.08));
  col=mix(col,u_accent,.22);
  float band=1.-smoothstep(.2,.3,abs(p.y));
  float side=1.-smoothstep(.55,.75,abs(p.x));
  gl_FragColor=vec4(col,disc*band*side*u_fade*.9);
}\`;
const material=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,vertexShader:VERT,fragmentShader:FRAG,
  uniforms:{u_time:{value:0},u_fade:{value:0},u_resolution:{value:new THREE.Vector2(width,height)},u_accent:{value:new THREE.Color(accent)}}});
const quad=new THREE.Mesh(new THREE.PlaneGeometry(width,height),material);
quad.position.z=-10;quad.renderOrder=-1;scene.add(quad);
const label=createText(text,{maxWidth:width*.78,textAlign:'center',lineHeight:1.25,anchorX:'center',anchorY:'middle',outlineWidth:'4%',outlineColor:'#0b0f14'});
let fitted=false;
function update(t){
  if(!fitted&&label.textRenderInfo){const b=label.textRenderInfo.blockBounds;label.scale.setScalar(Math.min(1,height*.5/Math.max(1,b[3]-b[1])));fitted=true;}
  const a=smooth(t/enter),b=smooth((duration-t)/exit);
  material.uniforms.u_time.value=t;material.uniforms.u_fade.value=a*b;
  const f=smooth(t/(enter*.7))*b;label.fillOpacity=f;label.outlineOpacity=f;
}
function dispose(){quad.geometry.dispose();material.dispose();}
update(0);
return {update,dispose};`},
 {key:'shader-rings',name:'脈打つリング',desc:'赤・緑・青がずれた同心円のリングが、ゆがみながら脈打ちます。',added:'2026-10-10',poster:1.1,source:`// 赤・緑・青を少しずつずらした同心円のリングが、ゆがみながら脈打つ（フルシェーダー）
const {THREE,scene,createText,text,width,height,fontSize,duration,accent}=api;
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
const enter=Math.min(.9,duration*.32),exit=Math.min(.55,duration*.2);
const VERT=\`varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}\`;
const FRAG=\`precision highp float;
#define FREQ 30.0           // リングの細かさ
uniform float u_time;
uniform float u_fade;
uniform vec2 u_resolution;
uniform vec3 u_accent;
varying vec2 vUv;
void main(){
  float aspect=u_resolution.x/u_resolution.y;
  vec2 p=(vUv-.5)*vec2(aspect,1.);
  float r=length(p),a=atan(p.y,p.x);
  // 角度ごとに半径をゆがめる（輪郭が波打つ）
  float warp=.022*sin(a*5.+u_time*1.6)+.014*sin(a*9.-u_time*2.3);
  float pulse=.5+.5*sin(u_time*2.4);
  vec3 ring=vec3(0.);
  for(int i=0;i<3;i++){                       // R,G,B をずらして重ねる
    float shift=float(i)*.9;
    float ph=(r+warp)*FREQ-u_time*3.+shift;
    ring[i]=smoothstep(.5,.95,.5+.5*sin(ph));
  }
  float body=1.-smoothstep(.26+.04*pulse,.4,r);   // 外へ向かって消える
  float alpha=max(ring.r,max(ring.g,ring.b))*body*u_fade;
  vec3 col=mix(ring,u_accent,.15)+.1;
  gl_FragColor=vec4(col,alpha);
}\`;
const material=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,vertexShader:VERT,fragmentShader:FRAG,
  uniforms:{u_time:{value:0},u_fade:{value:0},u_resolution:{value:new THREE.Vector2(width,height)},u_accent:{value:new THREE.Color(accent)}}});
const quad=new THREE.Mesh(new THREE.PlaneGeometry(width,height),material);
quad.position.z=-10;quad.renderOrder=-1;scene.add(quad);
const label=createText(text,{maxWidth:width*.7,textAlign:'center',lineHeight:1.25,anchorX:'center',anchorY:'middle',outlineWidth:'4%',outlineColor:'#0b0f14'});
let fitted=false;
function update(t){
  if(!fitted&&label.textRenderInfo){const b=label.textRenderInfo.blockBounds;label.scale.setScalar(Math.min(1,height*.5/Math.max(1,b[3]-b[1])));fitted=true;}
  const a=smooth(t/enter),b=smooth((duration-t)/exit);
  material.uniforms.u_time.value=t;material.uniforms.u_fade.value=a*b;
  const f=smooth(t/(enter*.7))*b;label.fillOpacity=f;label.outlineOpacity=f;
}
function dispose(){quad.geometry.dispose();material.dispose();}
update(0);
return {update,dispose};`},
 {key:'shader-truchet',name:'動くトルシェタイル',desc:'弧のタイルがマスごとに向きを変えて、迷路のような模様が動きます。',added:'2026-10-10',poster:1.2,source:`// 弧のタイルがマスごとに向きを入れ替え、迷路のような模様が動く（フルシェーダー、時間だけで決まる）
const {THREE,scene,createText,text,width,height,fontSize,duration,accent}=api;
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
const enter=Math.min(.9,duration*.32),exit=Math.min(.55,duration*.2);
const VERT=\`varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}\`;
const FRAG=\`precision highp float;
#define TAU 6.28318530718
#define CELLS 8.0           // 縦に並べるマスの数
#define PERIOD 1.9          // 1マスが向きを入れ替える間隔（秒）
uniform float u_time;
uniform float u_fade;
uniform vec2 u_resolution;
uniform vec3 u_accent;
varying vec2 vUv;
float hash21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
// 四角い箱までの符号付き距離（角丸）
float roundBox(vec2 p,vec2 b,float r){vec2 q=abs(p)-b+r;return length(max(q,0.))+min(max(q.x,q.y),0.)-r;}
// 弧のタイルまでの距離。flip が true なら左右を反転
float arcs(vec2 f,bool flip){
  if(flip)f.x=1.-f.x;
  return min(abs(length(f)-.5),abs(length(f-vec2(1.))-.5));
}
void main(){
  float aspect=u_resolution.x/u_resolution.y;
  vec2 p=(vUv-.5)*vec2(aspect,1.);
  vec2 g=p*CELLS,id=floor(g),f=fract(g);
  float h=hash21(id);
  float ph=u_time/PERIOD+h*7.;
  float step0=floor(ph),k=smoothstep(0.,.3,fract(ph));      // 0.3周期かけて切り替わる
  bool a=hash21(id+step0)>.5,b=hash21(id+step0+1.)>.5;
  // いまの向きから次の向きへ、距離を混ぜて動かす
  float d=mix(arcs(f,a),arcs(f,b),k);
  float line=1.-smoothstep(.045,.085,d);
  vec3 col=.55+.45*cos(TAU*(vec3(0.,.33,.67)+h*.5+u_time*.05));
  col=mix(col,u_accent,.25);
  float panel=1.-smoothstep(-.05,0.,roundBox(p,vec2(.66,.31),.07));
  gl_FragColor=vec4(col,line*panel*u_fade*.92);
}\`;
const material=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,vertexShader:VERT,fragmentShader:FRAG,
  uniforms:{u_time:{value:0},u_fade:{value:0},u_resolution:{value:new THREE.Vector2(width,height)},u_accent:{value:new THREE.Color(accent)}}});
const quad=new THREE.Mesh(new THREE.PlaneGeometry(width,height),material);
quad.position.z=-10;quad.renderOrder=-1;scene.add(quad);
const label=createText(text,{maxWidth:width*.7,textAlign:'center',lineHeight:1.25,anchorX:'center',anchorY:'middle',outlineWidth:'5%',outlineColor:'#0b0f14'});
let fitted=false;
function update(t){
  if(!fitted&&label.textRenderInfo){const b=label.textRenderInfo.blockBounds;label.scale.setScalar(Math.min(1,height*.5/Math.max(1,b[3]-b[1])));fitted=true;}
  const a=smooth(t/enter),b=smooth((duration-t)/exit);
  material.uniforms.u_time.value=t;material.uniforms.u_fade.value=a*b;
  const f=smooth(t/(enter*.7))*b;label.fillOpacity=f;label.outlineOpacity=f;
}
function dispose(){quad.geometry.dispose();material.dispose();}
update(0);
return {update,dispose};`},
 {key:'shader-toy',name:'Shadertoyの枠',desc:'Shadertoyのコードをそのまま貼れる枠で、光の粒が輪を描いて回ります。',added:'2026-10-10',poster:1.1,source:`// Shadertoy形式（mainImage / iTime / iResolution）のコードをそのまま貼れる枠。黒い所は透けて、光だけが文字の後ろに残る
const {THREE,scene,createText,text,width,height,fontSize,duration,accent}=api;
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
const enter=Math.min(.9,duration*.32),exit=Math.min(.55,duration*.2);
// ↓ Shadertoy のコードはこの中身を差し替える（iChannel の画像は使えません）
const SHADERTOY=\`
#define N 28
#define TAU 6.28318530718
void mainImage(out vec4 fragColor,in vec2 fragCoord){
  vec2 uv=(fragCoord-.5*iResolution.xy)/iResolution.y;
  vec3 col=vec3(0.);
  for(int i=0;i<N;i++){
    float fi=float(i);
    float a=fi/float(N)*TAU+iTime*.5;
    float wob=1.+.18*sin(a*3.+iTime*1.4);             // 輪を波打たせる
    vec2 c=vec2(cos(a),sin(a))*vec2(.55,.26)*wob;
    float d=length(uv-c);
    vec3 tint=.5+.5*cos(TAU*(fi/float(N)+vec3(0.,.33,.67)));
    col+=tint*(.0011/(d*d+.0005));               // 小さな光の粒
  }
  fragColor=vec4(1.-exp(-col*.55),1.);
}\`;
const VERT=\`varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}\`;
const FRAG=\`precision highp float;
uniform float iTime;
uniform vec3 iResolution;
uniform float u_fade;
varying vec2 vUv;
\${SHADERTOY}
void main(){
  vec4 c=vec4(0.,0.,0.,1.);
  mainImage(c,vUv*iResolution.xy);
  float a=clamp(max(c.r,max(c.g,c.b)),0.,1.);       // 明るさをそのまま不透明度にする
  vec2 p=(vUv-.5)*vec2(iResolution.x/iResolution.y,1.);
  float oval=1.-smoothstep(.55,1.,length(p/vec2(.68,.36)));
  gl_FragColor=vec4(c.rgb/max(a,.0001),a*oval*u_fade);
}\`;
const material=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,vertexShader:VERT,fragmentShader:FRAG,
  uniforms:{iTime:{value:0},iResolution:{value:new THREE.Vector3(width,height,1)},u_fade:{value:0}}});
const quad=new THREE.Mesh(new THREE.PlaneGeometry(width,height),material);
quad.position.z=-10;quad.renderOrder=-1;scene.add(quad);
const label=createText(text,{maxWidth:width*.7,textAlign:'center',lineHeight:1.25,anchorX:'center',anchorY:'middle',outlineWidth:'5%',outlineColor:'#0b0f14'});
let fitted=false;
function update(t){
  if(!fitted&&label.textRenderInfo){const b=label.textRenderInfo.blockBounds;label.scale.setScalar(Math.min(1,height*.5/Math.max(1,b[3]-b[1])));fitted=true;}
  const a=smooth(t/enter),b=smooth((duration-t)/exit);
  material.uniforms.iTime.value=t;material.uniforms.u_fade.value=a*b;
  const f=smooth(t/(enter*.7))*b;label.fillOpacity=f;label.outlineOpacity=f;
}
function dispose(){quad.geometry.dispose();material.dispose();}
update(0);
return {update,dispose};`},
 {key:'gucha-ripple',name:'中心から波紋で弾む',desc:'中心から外へ波紋のように、文字がぽんぽんと時間差で弾んで現れます。',added:'2026-10-10',poster:.7,source:`// 中心に近い文字から順に、ばねで弾みながら四分の一回転して現れる。退場は中心から外へ順に縮んで消える
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
let dmax=1;
function onLaid(){dmax=Math.max(1,...vis.map(l=>Math.hypot(l.x,l.y*1.6)));}
function pose(l,t,u,v){
 const d=Math.hypot(l.x,l.y*1.6)/dmax,lag=Math.min(life*.3,.9),span=intro*.62;
 const e=clamp((t-d*lag)/span),q=clamp((life-t-(1-d)*Math.min(life*.18,.5))/outro);
 const k=spring(e),turn=(1-smooth(e))*(l.r1>.5?1:-1)*Math.PI*.5,s=Math.max(.01,k)*(.3+.7*smooth(q));
 place(l,l.x,l.y+(1-k)*em*.25,turn+(1-smooth(q))*(l.r2-.5)*1.2,s,s,smooth(e*4)*smooth(q*3));
}
update(0);
return {update,dispose};`},
 {key:'gucha-squash',name:'落ちてつぶれて立つ',desc:'上から落ちた文字がぺしゃりとつぶれて、弾みながら立ち上がります。',added:'2026-10-10',poster:.55,source:`// 文字が上から加速して落ち、着地でつぶれて何度か弾んで止まる。退場は伸びながら上へ吸い上げられて消える
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
 const tau=Math.max(0,t-stag*l.o),tl=intro*.5,bt=Math.max(0,tau-tl),q=1-smooth(v),h=H*.7/fit*(.7+.3*l.r1);
 let y,sx=1,sy=1;
 if(tau<tl){const k=tau/tl;y=l.y+h*(1-k*k);sy=1+.28*k*k;sx=1-.1*k*k;}
 else{const sq=Math.exp(-7.5*bt)*Math.cos(bt*34);y=l.y+Math.abs(Math.sin(bt*Math.PI*2.6))*em*.45*Math.exp(-4.2*bt);sy=1-.5*sq;sx=1+.34*sq;y+=(sy-1)*em*.5;}
 y+=q*q*H*.8/fit;sy*=1+q*1.2;sx*=1-.4*q;
 place(l,l.x,y,0,sx,sy,smooth(tau/(tl*.4))*smooth(v*4));
}
update(0);
return {update,dispose};`},
 {key:'gucha-ghost',name:'分身が重なって一つに',desc:'ぶれた分身が回りながら本体に重なって、くっきりと一つの文字になります。',added:'2026-10-10',poster:.4,source:`// 色違いの分身を文字のまわりで回し、半径を縮めて本体へ重ねる。退場では分身が再び広がって消える
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
const extra=Math.max(0,Math.min(3,Math.floor(150/Math.max(1,vis.length))-1));
for(const l of vis){l.ghosts=[];for(let k=0;k<extra;k++){const m=createText(l.value,{textStart:l.start,fontSize:em,anchorX:'center',anchorY:'middle',color:api.accent,colorRanges:null});m.fillOpacity=0;m.outlineOpacity=0;root.add(m);l.meshes.push(m);l.ghosts.push(m);}}
function put(m,x,y,rot,sx,sy,a,o){m.position.set(x,y,0);m.rotation.z=rot;m.scale.set(sx,sy,1);m.fillOpacity=a;m.outlineOpacity=o;m.visible=a>.002;}
function pose(l,t,u,v){
 const m=(1-smooth(u))+(1-smooth(v)),mm=Math.min(1,m),R=em*1.15*mm,a=smooth(u*3)*smooth(v*3);
 put(l.mesh,l.x+Math.sin(t*9+l.r1*6)*em*.035*mm,l.y+Math.cos(t*8+l.r2*6)*em*.035*mm,Math.sin(t*5+l.r3*6)*.06*mm,1,1,a,a);
 l.ghosts.forEach((g,k)=>{const ang=k/Math.max(1,l.ghosts.length)*6.283+t*(2.4+l.r3)+l.r4*6.283;
  put(g,l.x+Math.cos(ang)*R,l.y+Math.sin(ang)*R*.7,Math.sin(ang)*.25*mm,1+.1*mm,1+.1*mm,.45*smooth(mm*2)*a,0);});
}
update(0);
return {update,dispose};`},
 {key:'gucha-magnet',name:'磁石のように引き合う',desc:'外側に離れていた文字が磁石のように引き寄せられて、かちっと収まります。',added:'2026-10-10',poster:.8,source:`// 文字が中心と反対側の遠くから、だんだん加速して元の位置へ吸い付き、小さく震えて止まる。退場は弾かれて飛び去る
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
 const dx=l.x,dy=l.y*1.3,len=Math.hypot(dx,dy),ux=len>1?dx/len:Math.cos(l.r1*6.283),uy=len>1?dy/len:Math.sin(l.r1*6.283);
 const far=W*.42/fit*(.5+.5*l.r2),e=Math.pow(u,2.2),q=1-smooth(v),qq=q*q*q;
 const bt=Math.max(0,t-(stag*l.o+intro)),shake=u>=1?Math.sin(bt*70+l.r3*6)*Math.exp(-14*bt)*em*.09:0;
 const k=(1-e)*far+qq*far;
 place(l,l.x+ux*k+shake,l.y+uy*k*.8-shake*.5,(l.r4-.5)*2.2*(1-e)+(l.r1-.5)*2*qq,1,1,smooth(u*5)*smooth(v*3));
}
update(0);
return {update,dispose};`},
 {key:'gucha-lanes',name:'レーンを滑って揃う',desc:'文字が左右交互のレーンを滑ってきて、ぴたりと一列に揃います。',added:'2026-10-10',poster:.6,source:`// 文字を3段のレーンに分け、左右交互の方向から急加速・急減速で滑り込む。退場は別の向きへ滑り出る
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
const q5=x=>{x=clamp(x);return x<.5?16*x*x*x*x*x:1-Math.pow(-2*x+2,5)/2};
function pose(l,t,u,v){
 const e=q5(u),q=q5(1-v),side=l.i%2?1:-1,lane=(l.i%3)-1,far=W*.55/fit;
 place(l,l.x+side*far*(1-e)-side*far*q,l.y+lane*em*1.25*(1-e)-lane*em*1.25*q,0,1,1,smooth(u*4)*smooth(v*4));
}
update(0);
return {update,dispose};`},
 {key:'gucha-flip',name:'カードみたいにめくれる',desc:'文字がカードのようにくるりとめくれて、表向きにぴたっと止まります。',added:'2026-10-10',poster:.3,source:`// 文字をカードに見立てて縦軸で半回転させる。裏返しの間は鏡文字になり、行き過ぎてから止まる。退場はもう一度めくれて消える
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
 const bk=x=>{x=clamp(x);const c=1.5;return 1+(c+1)*Math.pow(x-1,3)+c*Math.pow(x-1,2)};
 const e=bk(u),q=1-smooth(v),dir=l.i%2?1:-1,ang=(1-e)*Math.PI+q*Math.PI*dir,c=Math.cos(ang);
 place(l,l.x,l.y+Math.sin(Math.abs(ang))*em*.35*dir,0,Math.abs(c)<.03?.03*(c<0?-1:1):c,1+.12*Math.sin(Math.abs(ang)),smooth(u*5)*smooth(v*5));
}
update(0);
return {update,dispose};`},
 {key:'gucha-bubble',name:'泡のように浮かび上がる',desc:'文字が泡のようにゆらゆら浮かび上がり、最後はぷくっとふくらんで消えます。',added:'2026-10-10',poster:.5,source:`// 下から横に揺れながら浮かんで元の位置へ。伸び縮みしながら小さく膨らむ。退場は上へ浮かびふくらんで消える
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
 const e=1-Math.pow(1-clamp(u),3),q=1-smooth(v),rise=(1-e)*H*.6/fit*(.6+.4*l.r1);
 const sway=Math.sin(t*3+l.r2*6.283)*em*.45*(1-e)+Math.sin(t*5+l.r3*6)*em*.05,w=Math.sin(t*9+l.r4*6.283)*.1*(1-e*.7);
 const sc=(.25+.75*e)*(1+.4*q*q);
 place(l,l.x+sway,l.y-rise+q*q*H*.35/fit,sway/em*.15,sc*(1+w),sc*(1-w),smooth(u*3)*(1-smooth(q*1.1)));
}
update(0);
return {update,dispose};`},
 {key:'gucha-rubber',name:'伸びてパチンと戻る',desc:'横に引き伸ばされた文字が、ゴムのようにパチンと戻って弾みます。',added:'2026-10-10',poster:.3,source:`// 左へ引っ張られて横に伸びた文字が、ばねで元の形に戻る（縮みすぎてから止まる）。退場は縦に引き伸ばされて消える
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
 const e=spring(u),q=1-smooth(v),s=(1-e)*2.4,sx0=Math.max(.2,1+s),qs=q*2.6;
 const sx=sx0/Math.sqrt(1+qs),sy=1/Math.sqrt(sx0)*(1+qs);
 place(l,l.x-s*em*.9,l.y+qs*em*.4,0,sx,sy,smooth(u*4)*smooth(v*4));
}
update(0);
return {update,dispose};`},
 {key:'gucha-strips',name:'横にずれて重なり合う',desc:'横に切れた文字の帯が左右にずれていて、すうっと重なって読める形に戻ります。',added:'2026-10-10',poster:.35,source:`// 文字を3本の横帯に切り、帯ごとに左右へ大きくずらしてから揃える。退場はまた帯がずれて消える
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
const budget=Math.floor(150/Math.max(1,vis.length)),rowsN=budget>=3?3:budget>=2?2:1,per=rowsN;
for(const l of vis){l.tiles=[l.mesh];
 for(let k=1;k<per;k++){const m=createText(l.value,{textStart:l.start,fontSize:em,anchorX:'center',anchorY:'middle',outlineWidth:'3%',outlineColor:'#101819'});m.fillOpacity=0;m.outlineOpacity=0;root.add(m);l.meshes.push(m);l.tiles.push(m);}
 l.tr=l.tiles.map((_,k)=>({a:hash(l.i,k*3+1),b:hash(l.i,k*3+2)}));}
function onLaid(){
 for(const l of vis){const b=l.info&&l.info.blockBounds;if(!b||b.length!==4||!b.every(Number.isFinite))continue;
  const h=b[3]-b[1];
  l.tiles.forEach((m,k)=>{if(per===1){m.clipRect=null;return;}m.clipRect=[b[0]-1,b[3]-h*(k+1)/rowsN-1,b[2]+1,b[3]-h*k/rowsN+1];});}
}
function pose(l,t,u,v){
 l.tiles.forEach((m,k)=>{const r=l.tr[k],dir=k%2?1:-1;
  const e=spring(clamp((t-stag*l.o-k*.06)/(intro*.85))),q=1-smooth(clamp((life-t-stag*(1-l.o)-k*.04)/outro));
  m.position.set(l.x+dir*(W*.4/fit*(.4+.6*r.a)*(1-e)+em*2.4*q*(.4+.6*r.b)),l.y,0);m.rotation.z=0;m.scale.set(1,1,1);
  const a=smooth(e*4)*(1-smooth(q*1.2));m.fillOpacity=a;m.outlineOpacity=a;m.visible=a>.002;});
}
update(0);
return {update,dispose};`},
 {key:'gucha-steps',name:'直角に歩いて収まる',desc:'文字がマス目の上を横へ、続けて縦へと直角に歩いて、元の位置へ収まります。',added:'2026-10-10',poster:.6,source:`// 文字を整数マスぶん離れた位置に置き、まず横、続いて縦へ急加速・急減速で動かす。退場は縦、続いて横へ歩いて消える
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
const q5=x=>{x=clamp(x);return x<.5?16*x*x*x*x*x:1-Math.pow(-2*x+2,5)/2};
function pose(l,t,u,v){
 const ox=Math.round((l.r1-.5)*8)*em,oy=Math.round((l.r2-.5)*5)*em*1.1,ex=Math.round((l.r3-.5)*8)*em,ey=Math.round((l.r4-.5)*5)*em*1.1;
 const a=q5(clamp(u*2)),b=q5(clamp(u*2-1)),r=1-v,c=q5(clamp(r*2)),d=q5(clamp(r*2-1));
 place(l,l.x+ox*(1-a)+ex*d,l.y+oy*(1-b)+ey*c,(1-a)*(l.r1>.5?1:-1)*Math.PI*.5+d*(l.r3>.5?1:-1)*Math.PI*.5,1,1,smooth(u*4)*smooth(v*4));
}
update(0);
return {update,dispose};`},
 {key:'shader-ribbons',name:'うねるリボン',desc:'色の違う細いリボンが重なりながら、波のようにうねって流れます。',added:'2026-10-10',poster:1.1,source:`// 細い帯を6本、位相の違う sin 波で重ねて流す（for は6回の定数ループ）。後から描いた帯が上に来る
const {THREE,scene,createText,text,width,height,fontSize,duration,accent}=api;
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
const enter=Math.min(.9,duration*.32),exit=Math.min(.55,duration*.2);
const VERT=\`varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}\`;
const FRAG=\`precision highp float;
#define TAU 6.28318530718
uniform float u_time;
uniform float u_fade;
uniform vec2 u_resolution;
uniform vec3 u_accent;
varying vec2 vUv;
vec3 pal(float k){return .55+.45*cos(TAU*(k+vec3(0.,.33,.67)));}
void main(){
  float aspect=u_resolution.x/u_resolution.y;
  vec2 p=(vUv-.5)*vec2(aspect,1.);
  vec3 col=vec3(0.);
  float cover=0.;
  for(int i=0;i<6;i++){
    float fi=float(i);
    float y=.11*sin(p.x*(3.+fi*.7)+u_time*(1.1+fi*.23)+fi*1.7)+.05*sin(p.x*(7.+fi)-u_time*1.7+fi)+(fi-2.5)*.065;
    float w=.026+.01*sin(fi+u_time);
    float a=1.-smoothstep(w*.4,w,abs(p.y-y));
    col=mix(col,pal(fi*.17+u_time*.05),a);      // 後の帯が上
    cover=max(cover,a);
  }
  float box=(1.-smoothstep(.5,.74,abs(p.x)))*(1.-smoothstep(.25,.33,abs(p.y)));
  gl_FragColor=vec4(col,cover*box*u_fade);
}\`;
const material=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,vertexShader:VERT,fragmentShader:FRAG,
  uniforms:{u_time:{value:0},u_fade:{value:0},u_resolution:{value:new THREE.Vector2(width,height)},u_accent:{value:new THREE.Color(accent)}}});
const quad=new THREE.Mesh(new THREE.PlaneGeometry(width,height),material);
quad.position.z=-10;quad.renderOrder=-1;scene.add(quad);
const label=createText(text,{maxWidth:width*.7,textAlign:'center',lineHeight:1.25,anchorX:'center',anchorY:'middle',outlineWidth:'4%',outlineColor:'#0b0f14'});
let fitted=false;
function update(t){
  if(!fitted&&label.textRenderInfo){const b=label.textRenderInfo.blockBounds;label.scale.setScalar(Math.min(1,height*.5/Math.max(1,b[3]-b[1])));fitted=true;}
  const a=smooth(t/enter),b=smooth((duration-t)/exit);
  material.uniforms.u_time.value=t;material.uniforms.u_fade.value=a*b;
  const f=smooth(t/(enter*.7))*b;label.fillOpacity=f;label.outlineOpacity=f;
}
function dispose(){quad.geometry.dispose();material.dispose();}
update(0);
return {update,dispose};`},
 {key:'shader-voronoi',name:'ひび割れの細胞',desc:'細胞のような区切りがゆっくり動いて、境目が光の線になって走ります。',added:'2026-10-10',poster:1.1,source:`// ボロノイ図（最近傍と2番目の距離の差）の境目だけを光らせる。点は sin でゆっくり漂う（3×3の定数ループ）
const {THREE,scene,createText,text,width,height,fontSize,duration,accent}=api;
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
const enter=Math.min(.9,duration*.32),exit=Math.min(.55,duration*.2);
const VERT=\`varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}\`;
const FRAG=\`precision highp float;
#define TAU 6.28318530718
uniform float u_time;
uniform float u_fade;
uniform vec2 u_resolution;
uniform vec3 u_accent;
varying vec2 vUv;
vec3 pal(float k){return .55+.45*cos(TAU*(k+vec3(0.,.33,.67)));}
vec2 h22(vec2 p){p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)));return fract(sin(p)*43758.5453);}
void main(){
  float aspect=u_resolution.x/u_resolution.y;
  vec2 p=(vUv-.5)*vec2(aspect,1.);
  vec2 g=p*5.5,id=floor(g),f=fract(g);
  float d1=9.,d2=9.;
  vec2 near=vec2(0.);
  for(int j=-1;j<=1;j++){
    for(int i=-1;i<=1;i++){
      vec2 o=vec2(float(i),float(j));
      vec2 r=.5+.42*sin(u_time*.8+TAU*h22(id+o));
      vec2 q=o+r-f;
      float d=dot(q,q);
      if(d<d1){d2=d1;d1=d;near=id+o;}else if(d<d2){d2=d;}
    }
  }
  float edge=sqrt(d2)-sqrt(d1);
  float line=1.-smoothstep(.0,.1,edge);
  float h=h22(near).x;
  vec3 col=pal(h+u_time*.05);
  float fill=.25*(1.-smoothstep(.0,.55,sqrt(d1)));
  float oval=1.-smoothstep(.55,1.,length(p/vec2(.66,.33)));
  gl_FragColor=vec4(mix(col,u_accent,.2),(line+fill)*oval*u_fade);
}\`;
const material=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,vertexShader:VERT,fragmentShader:FRAG,
  uniforms:{u_time:{value:0},u_fade:{value:0},u_resolution:{value:new THREE.Vector2(width,height)},u_accent:{value:new THREE.Color(accent)}}});
const quad=new THREE.Mesh(new THREE.PlaneGeometry(width,height),material);
quad.position.z=-10;quad.renderOrder=-1;scene.add(quad);
const label=createText(text,{maxWidth:width*.7,textAlign:'center',lineHeight:1.25,anchorX:'center',anchorY:'middle',outlineWidth:'4%',outlineColor:'#0b0f14'});
let fitted=false;
function update(t){
  if(!fitted&&label.textRenderInfo){const b=label.textRenderInfo.blockBounds;label.scale.setScalar(Math.min(1,height*.5/Math.max(1,b[3]-b[1])));fitted=true;}
  const a=smooth(t/enter),b=smooth((duration-t)/exit);
  material.uniforms.u_time.value=t;material.uniforms.u_fade.value=a*b;
  const f=smooth(t/(enter*.7))*b;label.fillOpacity=f;label.outlineOpacity=f;
}
function dispose(){quad.geometry.dispose();material.dispose();}
update(0);
return {update,dispose};`},
 {key:'shader-lissajous',name:'リサジュー糸',desc:'1本の光る糸が、リサジュー曲線を描きながらゆっくり形を変えます。',added:'2026-10-10',poster:1.1,source:`// 曲線を48本の線分にして、各画素から最短距離を求めて光らせる（for は48回の定数ループ）。曲線上の位置で色を変える
const {THREE,scene,createText,text,width,height,fontSize,duration,accent}=api;
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
const enter=Math.min(.9,duration*.32),exit=Math.min(.55,duration*.2);
const VERT=\`varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}\`;
const FRAG=\`precision highp float;
#define TAU 6.28318530718
uniform float u_time;
uniform float u_fade;
uniform vec2 u_resolution;
uniform vec3 u_accent;
varying vec2 vUv;
vec3 pal(float k){return .55+.45*cos(TAU*(k+vec3(0.,.33,.67)));}
#define SEG 48
vec2 curve(float s){
  float a=s*TAU;
  return vec2(.56*sin(3.*a+u_time*.7+1.2),.26*sin(2.*a+u_time*.5));
}
void main(){
  float aspect=u_resolution.x/u_resolution.y;
  vec2 p=(vUv-.5)*vec2(aspect,1.);
  float dmin=1.,ph=0.;
  vec2 prev=curve(0.);
  for(int i=1;i<=SEG;i++){
    float s=float(i)/float(SEG);
    vec2 cur=curve(s);
    vec2 pa=p-prev,ba=cur-prev;
    float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);
    float d=length(pa-ba*h);
    if(d<dmin){dmin=d;ph=(float(i-1)+h)/float(SEG);}
    prev=cur;
  }
  float line=1.-smoothstep(.007,.02,dmin);
  float glow=.5*.012/(dmin+.012);
  vec3 col=mix(pal(ph+u_time*.08),u_accent,.15);
  gl_FragColor=vec4(col,clamp(line+glow*.6,0.,1.)*u_fade);
}\`;
const material=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,vertexShader:VERT,fragmentShader:FRAG,
  uniforms:{u_time:{value:0},u_fade:{value:0},u_resolution:{value:new THREE.Vector2(width,height)},u_accent:{value:new THREE.Color(accent)}}});
const quad=new THREE.Mesh(new THREE.PlaneGeometry(width,height),material);
quad.position.z=-10;quad.renderOrder=-1;scene.add(quad);
const label=createText(text,{maxWidth:width*.62,textAlign:'center',lineHeight:1.25,anchorX:'center',anchorY:'middle',outlineWidth:'4%',outlineColor:'#0b0f14'});
let fitted=false;
function update(t){
  if(!fitted&&label.textRenderInfo){const b=label.textRenderInfo.blockBounds;label.scale.setScalar(Math.min(1,height*.5/Math.max(1,b[3]-b[1])));fitted=true;}
  const a=smooth(t/enter),b=smooth((duration-t)/exit);
  material.uniforms.u_time.value=t;material.uniforms.u_fade.value=a*b;
  const f=smooth(t/(enter*.7))*b;label.fillOpacity=f;label.outlineOpacity=f;
}
function dispose(){quad.geometry.dispose();material.dispose();}
update(0);
return {update,dispose};`},
 {key:'shader-kaleido',name:'万華鏡の花',desc:'丸い万華鏡の中で、対称な模様がゆっくり回りながら色を変えます。',added:'2026-10-10',poster:1.1,source:`// 角度を6分割して折り返し（abs と mod）、折り返した座標に波の模様を重ねる。円の外は透明
const {THREE,scene,createText,text,width,height,fontSize,duration,accent}=api;
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
const enter=Math.min(.9,duration*.32),exit=Math.min(.55,duration*.2);
const VERT=\`varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}\`;
const FRAG=\`precision highp float;
#define TAU 6.28318530718
uniform float u_time;
uniform float u_fade;
uniform vec2 u_resolution;
uniform vec3 u_accent;
varying vec2 vUv;
vec3 pal(float k){return .55+.45*cos(TAU*(k+vec3(0.,.33,.67)));}
void main(){
  float aspect=u_resolution.x/u_resolution.y;
  vec2 p=(vUv-.5)*vec2(aspect,1.);
  float r=length(p);
  float a=atan(p.y,p.x)+u_time*.15;
  float seg=TAU/6.;
  a=abs(mod(a,seg)-seg*.5);
  vec2 q=r*vec2(cos(a),sin(a));
  q+=.03*vec2(sin(q.y*18.+u_time),cos(q.x*14.-u_time*1.2));
  float f=.5+.5*sin(q.x*26.+sin(q.y*19.+u_time*1.3)*1.5-u_time*1.8);
  float g=.5+.5*cos(q.y*31.+q.x*7.-u_time);
  float pat=smoothstep(.2,.55,f*g*1.5+.12);
  vec3 col=pal(r*1.6+f*.5+u_time*.06);
  float disc=1.-smoothstep(.28,.35,r);
  gl_FragColor=vec4(mix(col,u_accent,.15),pat*disc*u_fade);
}\`;
const material=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,vertexShader:VERT,fragmentShader:FRAG,
  uniforms:{u_time:{value:0},u_fade:{value:0},u_resolution:{value:new THREE.Vector2(width,height)},u_accent:{value:new THREE.Color(accent)}}});
const quad=new THREE.Mesh(new THREE.PlaneGeometry(width,height),material);
quad.position.z=-10;quad.renderOrder=-1;scene.add(quad);
const label=createText(text,{maxWidth:width*.5,textAlign:'center',lineHeight:1.25,anchorX:'center',anchorY:'middle',outlineWidth:'4%',outlineColor:'#0b0f14'});
let fitted=false;
function update(t){
  if(!fitted&&label.textRenderInfo){const b=label.textRenderInfo.blockBounds;label.scale.setScalar(Math.min(1,height*.4/Math.max(1,b[3]-b[1])));fitted=true;}
  const a=smooth(t/enter),b=smooth((duration-t)/exit);
  material.uniforms.u_time.value=t;material.uniforms.u_fade.value=a*b;
  const f=smooth(t/(enter*.7))*b;label.fillOpacity=f;label.outlineOpacity=f;
}
function dispose(){quad.geometry.dispose();material.dispose();}
update(0);
return {update,dispose};`},
 {key:'shader-metaballs',name:'ぷるぷるメタボール',desc:'ゼリーのような玉がくっついたり離れたりしながら、ぷるぷる漂います。',added:'2026-10-10',poster:1.1,source:`// 7つの玉の場（r²/d²）を足して、しきい値で輪郭を出す。しきい値の少し手前を縁取りの光にする（for は7回）
const {THREE,scene,createText,text,width,height,fontSize,duration,accent}=api;
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
const enter=Math.min(.9,duration*.32),exit=Math.min(.55,duration*.2);
const VERT=\`varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}\`;
const FRAG=\`precision highp float;
#define TAU 6.28318530718
uniform float u_time;
uniform float u_fade;
uniform vec2 u_resolution;
uniform vec3 u_accent;
varying vec2 vUv;
vec3 pal(float k){return .55+.45*cos(TAU*(k+vec3(0.,.33,.67)));}
void main(){
  float aspect=u_resolution.x/u_resolution.y;
  vec2 p=(vUv-.5)*vec2(aspect,1.);
  float field=0.;
  for(int i=0;i<7;i++){
    float fi=float(i);
    vec2 c=vec2(.42*sin(u_time*(.6+.13*fi)+fi*2.1),.2*cos(u_time*(.5+.11*fi)+fi*1.3));
    float r=.075+.02*sin(fi*3.+u_time);
    float d=length(p-c);
    field+=r*r/(d*d+1e-4);
  }
  float body=smoothstep(.95,1.1,field);
  float rim=smoothstep(.75,.95,field)*(1.-smoothstep(1.0,1.3,field));
  vec3 col=mix(pal(.55+u_time*.04),u_accent,smoothstep(1.,3.,field));
  col+=rim*.35;
  gl_FragColor=vec4(col,max(body*.82,rim*.7)*u_fade);
}\`;
const material=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,vertexShader:VERT,fragmentShader:FRAG,
  uniforms:{u_time:{value:0},u_fade:{value:0},u_resolution:{value:new THREE.Vector2(width,height)},u_accent:{value:new THREE.Color(accent)}}});
const quad=new THREE.Mesh(new THREE.PlaneGeometry(width,height),material);
quad.position.z=-10;quad.renderOrder=-1;scene.add(quad);
const label=createText(text,{maxWidth:width*.7,textAlign:'center',lineHeight:1.25,anchorX:'center',anchorY:'middle',outlineWidth:'4%',outlineColor:'#0b0f14'});
let fitted=false;
function update(t){
  if(!fitted&&label.textRenderInfo){const b=label.textRenderInfo.blockBounds;label.scale.setScalar(Math.min(1,height*.5/Math.max(1,b[3]-b[1])));fitted=true;}
  const a=smooth(t/enter),b=smooth((duration-t)/exit);
  material.uniforms.u_time.value=t;material.uniforms.u_fade.value=a*b;
  const f=smooth(t/(enter*.7))*b;label.fillOpacity=f;label.outlineOpacity=f;
}
function dispose(){quad.geometry.dispose();material.dispose();}
update(0);
return {update,dispose};`},
 {key:'shader-lines',name:'波打つ線の山',desc:'何本もの細い線が重なって、山脈のように波打ち続けます。',added:'2026-10-10',poster:1.1,source:`// 14本の線を上から順に重ね、線の下を暗く塗って奥の線を隠す。線の高さは周波数の違う sin を足して作る（for は14回）
const {THREE,scene,createText,text,width,height,fontSize,duration,accent}=api;
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
const enter=Math.min(.9,duration*.32),exit=Math.min(.55,duration*.2);
const VERT=\`varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}\`;
const FRAG=\`precision highp float;
#define TAU 6.28318530718
uniform float u_time;
uniform float u_fade;
uniform vec2 u_resolution;
uniform vec3 u_accent;
varying vec2 vUv;
vec3 pal(float k){return .55+.45*cos(TAU*(k+vec3(0.,.33,.67)));}
#define LINES 14
void main(){
  float aspect=u_resolution.x/u_resolution.y;
  vec2 p=(vUv-.5)*vec2(aspect,1.);
  vec3 col=vec3(0.);
  float cover=0.;
  float env=1.-smoothstep(.0,.5,abs(p.x));
  for(int i=0;i<LINES;i++){
    float fi=float(i);
    float y0=.26-fi*(.5/float(LINES-1));
    float h=sin(p.x*9.+fi*1.7+u_time*1.3)*.5+sin(p.x*17.-fi*.9-u_time*.9)*.3+sin(p.x*31.+fi*2.3+u_time*1.7)*.2;
    float y=y0+h*.09*env;
    float under=step(p.y,y);                  // 線より下を暗くして、奥の線を隠す
    col=mix(col,vec3(.03,.05,.09),under*.9);
    cover=mix(cover,.78,under);
    float line=1.-smoothstep(.003,.009,abs(p.y-y));
    col=mix(col,mix(pal(fi*.05+u_time*.04),vec3(1.),.35),line);
    cover=mix(cover,1.,line);
  }
  float box=(1.-smoothstep(.46,.52,abs(p.x)))*(1.-smoothstep(.0,.05,p.y-.34))*smoothstep(-.33,-.28,p.y);
  gl_FragColor=vec4(col,cover*box*u_fade);
}\`;
const material=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,vertexShader:VERT,fragmentShader:FRAG,
  uniforms:{u_time:{value:0},u_fade:{value:0},u_resolution:{value:new THREE.Vector2(width,height)},u_accent:{value:new THREE.Color(accent)}}});
const quad=new THREE.Mesh(new THREE.PlaneGeometry(width,height),material);
quad.position.z=-10;quad.renderOrder=-1;scene.add(quad);
const label=createText(text,{maxWidth:width*.62,textAlign:'center',lineHeight:1.25,anchorX:'center',anchorY:'middle',outlineWidth:'4%',outlineColor:'#0b0f14'});
let fitted=false;
function update(t){
  if(!fitted&&label.textRenderInfo){const b=label.textRenderInfo.blockBounds;label.scale.setScalar(Math.min(1,height*.5/Math.max(1,b[3]-b[1])));fitted=true;}
  const a=smooth(t/enter),b=smooth((duration-t)/exit);
  material.uniforms.u_time.value=t;material.uniforms.u_fade.value=a*b;
  const f=smooth(t/(enter*.7))*b;label.fillOpacity=f;label.outlineOpacity=f;
}
function dispose(){quad.geometry.dispose();material.dispose();}
update(0);
return {update,dispose};`},
 {key:'shader-cascade',name:'中心から広がるマス目',desc:'マス目が中心から外へ順に、ふくらんで回りながら丸くなっていきます。',added:'2026-10-10',poster:1.2,source:`// マスごとの時刻を「中心からの距離」だけずらし、①ふくらむ ②四分の一回転して角が丸くなる、の2段階を smoothstep でつなぐ。色はマスごとのハッシュ
const {THREE,scene,createText,text,width,height,fontSize,duration,accent}=api;
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
const enter=Math.min(.9,duration*.32),exit=Math.min(.55,duration*.2);
const VERT=\`varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}\`;
const FRAG=\`precision highp float;
#define TAU 6.28318530718
uniform float u_time;
uniform float u_fade;
uniform vec2 u_resolution;
uniform vec3 u_accent;
varying vec2 vUv;
vec3 pal(float k){return .55+.45*cos(TAU*(k+vec3(0.,.33,.67)));}
#define CELLS 12.0
float hash21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float roundBox(vec2 p,vec2 b,float r){vec2 q=abs(p)-b+r;return length(max(q,0.))+min(max(q.x,q.y),0.)-r;}
void main(){
  float aspect=u_resolution.x/u_resolution.y;
  vec2 p=(vUv-.5)*vec2(aspect,1.);
  vec2 g=p*CELLS,id=floor(g),f=fract(g)-.5;
  vec2 cc=(id+.5)/CELLS;
  float k=clamp(u_time*1.2-length(cc)*2.4,0.,2.);       // 0..1 ふくらむ / 1..2 回って丸くなる
  float grow=smoothstep(0.,1.,k),turn=smoothstep(1.,2.,k);
  float size=.46*grow;
  float ang=turn*1.5707963;
  float c=cos(ang),s=sin(ang);
  vec2 q=mat2(c,-s,s,c)*f;
  float sd=roundBox(q,vec2(size),size*turn);
  float shape=1.-smoothstep(-.03,.03,sd);
  vec3 col=pal(hash21(id)*.6+u_time*.04);
  float panel=1.-smoothstep(.0,.05,roundBox(p,vec2(.64,.3),.05));
  gl_FragColor=vec4(mix(col,u_accent,.2),shape*panel*u_fade*.78);
}\`;
const material=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,vertexShader:VERT,fragmentShader:FRAG,
  uniforms:{u_time:{value:0},u_fade:{value:0},u_resolution:{value:new THREE.Vector2(width,height)},u_accent:{value:new THREE.Color(accent)}}});
const quad=new THREE.Mesh(new THREE.PlaneGeometry(width,height),material);
quad.position.z=-10;quad.renderOrder=-1;scene.add(quad);
const label=createText(text,{maxWidth:width*.62,textAlign:'center',lineHeight:1.25,anchorX:'center',anchorY:'middle',outlineWidth:'4%',outlineColor:'#0b0f14'});
let fitted=false;
function update(t){
  if(!fitted&&label.textRenderInfo){const b=label.textRenderInfo.blockBounds;label.scale.setScalar(Math.min(1,height*.5/Math.max(1,b[3]-b[1])));fitted=true;}
  const a=smooth(t/enter),b=smooth((duration-t)/exit);
  material.uniforms.u_time.value=t;material.uniforms.u_fade.value=a*b;
  const f=smooth(t/(enter*.7))*b;label.fillOpacity=f;label.outlineOpacity=f;
}
function dispose(){quad.geometry.dispose();material.dispose();}
update(0);
return {update,dispose};`},
 {key:'shader-aurora',name:'オーロラのカーテン',desc:'緑から紫へ色を変えるカーテンが、縦のすじをなびかせて揺れます。',added:'2026-10-10',poster:1.1,source:`// 一次元の値ノイズでカーテンの下端と高さを決め、縦すじ（高周波の sin）を掛ける。下ほど明るく、上へ向かって透けて消える
const {THREE,scene,createText,text,width,height,fontSize,duration,accent}=api;
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
const enter=Math.min(.9,duration*.32),exit=Math.min(.55,duration*.2);
const VERT=\`varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}\`;
const FRAG=\`precision highp float;
#define TAU 6.28318530718
uniform float u_time;
uniform float u_fade;
uniform vec2 u_resolution;
uniform vec3 u_accent;
varying vec2 vUv;
vec3 pal(float k){return .55+.45*cos(TAU*(k+vec3(0.,.33,.67)));}
float hash11(float x){return fract(sin(x*127.1)*43758.5453);}
float vnoise(float x){float i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(hash11(i),hash11(i+1.),f);}
void main(){
  float aspect=u_resolution.x/u_resolution.y;
  vec2 p=(vUv-.5)*vec2(aspect,1.);
  float x=p.x;
  float base=-.14+.12*vnoise(x*2.2+u_time*.35)+.04*sin(x*3.+u_time*.6);
  float h=.34+.16*vnoise(x*3.1-u_time*.25);
  float streak=.5+.5*sin(x*55.+vnoise(x*6.+u_time)*6.);
  float y=p.y-base;
  float body=smoothstep(0.,.03,y)*pow(1.-smoothstep(0.,h,y),.7);
  float inten=clamp(body*(.5+.9*streak)*1.35,0.,1.);
  vec3 col=mix(vec3(.2,1.,.55),vec3(.8,.3,.95),smoothstep(0.,h,y));
  float side=1.-smoothstep(.5,.78,abs(x));
  gl_FragColor=vec4(mix(col,u_accent,.12),inten*side*u_fade);
}\`;
const material=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,vertexShader:VERT,fragmentShader:FRAG,
  uniforms:{u_time:{value:0},u_fade:{value:0},u_resolution:{value:new THREE.Vector2(width,height)},u_accent:{value:new THREE.Color(accent)}}});
const quad=new THREE.Mesh(new THREE.PlaneGeometry(width,height),material);
quad.position.z=-10;quad.renderOrder=-1;scene.add(quad);
const label=createText(text,{maxWidth:width*.7,textAlign:'center',lineHeight:1.25,anchorX:'center',anchorY:'middle',outlineWidth:'4%',outlineColor:'#0b0f14'});
let fitted=false;
function update(t){
  if(!fitted&&label.textRenderInfo){const b=label.textRenderInfo.blockBounds;label.scale.setScalar(Math.min(1,height*.5/Math.max(1,b[3]-b[1])));fitted=true;}
  const a=smooth(t/enter),b=smooth((duration-t)/exit);
  material.uniforms.u_time.value=t;material.uniforms.u_fade.value=a*b;
  const f=smooth(t/(enter*.7))*b;label.fillOpacity=f;label.outlineOpacity=f;
}
function dispose(){quad.geometry.dispose();material.dispose();}
update(0);
return {update,dispose};`},
 {key:'shader-petals',name:'開く花びら',desc:'重なった花びらが逆向きに回りながら、息をするように開いたり閉じたりします。',added:'2026-10-10',poster:1.1,source:`// 極座標で半径を |cos(n/2·角度)| に比例させて花びらの輪郭を作る。花びらの数は5・7・9枚、回る向きは交互（for は3回）
const {THREE,scene,createText,text,width,height,fontSize,duration,accent}=api;
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
const enter=Math.min(.9,duration*.32),exit=Math.min(.55,duration*.2);
const VERT=\`varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}\`;
const FRAG=\`precision highp float;
#define TAU 6.28318530718
uniform float u_time;
uniform float u_fade;
uniform vec2 u_resolution;
uniform vec3 u_accent;
varying vec2 vUv;
vec3 pal(float k){return .55+.45*cos(TAU*(k+vec3(0.,.33,.67)));}
void main(){
  float aspect=u_resolution.x/u_resolution.y;
  vec2 p=(vUv-.5)*vec2(aspect,1.);
  float r=length(p),a=atan(p.y,p.x);
  vec3 col=vec3(0.);
  float cover=0.;
  for(int i=0;i<3;i++){
    float fi=float(i);
    float n=5.+fi*2.;
    float rot=u_time*(.25+.1*fi)*(mod(fi,2.)<.5?1.:-1.);
    float R=(.31-.07*fi)*(.85+.15*sin(u_time*1.6+fi));
    float shape=R*(.4+.6*abs(cos(n*.5*(a+rot))));
    float edge=r-shape;
    float line=1.-smoothstep(.0,.014,abs(edge));
    float fill=(1.-smoothstep(-.012,.0,edge))*.34;
    float al=max(line,fill);
    col=mix(col,pal(fi*.3+u_time*.06),al);
    cover=max(cover,al);
  }
  gl_FragColor=vec4(mix(col,u_accent,.12),cover*u_fade);
}\`;
const material=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,vertexShader:VERT,fragmentShader:FRAG,
  uniforms:{u_time:{value:0},u_fade:{value:0},u_resolution:{value:new THREE.Vector2(width,height)},u_accent:{value:new THREE.Color(accent)}}});
const quad=new THREE.Mesh(new THREE.PlaneGeometry(width,height),material);
quad.position.z=-10;quad.renderOrder=-1;scene.add(quad);
const label=createText(text,{maxWidth:width*.5,textAlign:'center',lineHeight:1.25,anchorX:'center',anchorY:'middle',outlineWidth:'4%',outlineColor:'#0b0f14'});
let fitted=false;
function update(t){
  if(!fitted&&label.textRenderInfo){const b=label.textRenderInfo.blockBounds;label.scale.setScalar(Math.min(1,height*.4/Math.max(1,b[3]-b[1])));fitted=true;}
  const a=smooth(t/enter),b=smooth((duration-t)/exit);
  material.uniforms.u_time.value=t;material.uniforms.u_fade.value=a*b;
  const f=smooth(t/(enter*.7))*b;label.fillOpacity=f;label.outlineOpacity=f;
}
function dispose(){quad.geometry.dispose();material.dispose();}
update(0);
return {update,dispose};`},
 {key:'shader-stars',name:'きらめく星屑',desc:'小さな星がそれぞれのタイミングで瞬いて、十字の光を放ちます。',added:'2026-10-10',poster:1.1,source:`// マスごとのハッシュで星の有無・位置・瞬きの位相を決め、周囲3×3マスぶんを足す。核（1/d²）と十字の筋を重ねる
const {THREE,scene,createText,text,width,height,fontSize,duration,accent}=api;
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
const enter=Math.min(.9,duration*.32),exit=Math.min(.55,duration*.2);
const VERT=\`varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}\`;
const FRAG=\`precision highp float;
#define TAU 6.28318530718
uniform float u_time;
uniform float u_fade;
uniform vec2 u_resolution;
uniform vec3 u_accent;
varying vec2 vUv;
vec3 pal(float k){return .55+.45*cos(TAU*(k+vec3(0.,.33,.67)));}
float hash12(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
void main(){
  float aspect=u_resolution.x/u_resolution.y;
  vec2 p=(vUv-.5)*vec2(aspect,1.);
  vec2 g=p*6.,id=floor(g),f=fract(g);
  float glow=0.;
  vec3 col=vec3(0.);
  for(int j=-1;j<=1;j++){
    for(int i=-1;i<=1;i++){
      vec2 o=vec2(float(i),float(j));
      float h=hash12(id+o);
      if(h<.45)continue;
      vec2 q=o+.5+.34*vec2(sin(h*40.+u_time*.5),cos(h*37.+u_time*.4))-f;
      float tw=.5+.5*sin(u_time*3.+h*60.);
      float d=length(q);
      float core=.02/(d*d+.003)*(.35+.65*tw);
      float cross=(1.-smoothstep(.0,.035,min(abs(q.x),abs(q.y))))*(1.-smoothstep(.0,.55,d))*tw;
      float s=core*.45+cross*1.1;
      col+=pal(h*3.+u_time*.04)*s;
      glow+=s;
    }
  }
  float oval=1.-smoothstep(.6,1.,length(p/vec2(.7,.34)));
  gl_FragColor=vec4(col/max(glow,.001),clamp(glow,0.,1.)*oval*u_fade);
}\`;
const material=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,vertexShader:VERT,fragmentShader:FRAG,
  uniforms:{u_time:{value:0},u_fade:{value:0},u_resolution:{value:new THREE.Vector2(width,height)},u_accent:{value:new THREE.Color(accent)}}});
const quad=new THREE.Mesh(new THREE.PlaneGeometry(width,height),material);
quad.position.z=-10;quad.renderOrder=-1;scene.add(quad);
const label=createText(text,{maxWidth:width*.7,textAlign:'center',lineHeight:1.25,anchorX:'center',anchorY:'middle',outlineWidth:'4%',outlineColor:'#0b0f14'});
let fitted=false;
function update(t){
  if(!fitted&&label.textRenderInfo){const b=label.textRenderInfo.blockBounds;label.scale.setScalar(Math.min(1,height*.5/Math.max(1,b[3]-b[1])));fitted=true;}
  const a=smooth(t/enter),b=smooth((duration-t)/exit);
  material.uniforms.u_time.value=t;material.uniforms.u_fade.value=a*b;
  const f=smooth(t/(enter*.7))*b;label.fillOpacity=f;label.outlineOpacity=f;
}
function dispose(){quad.geometry.dispose();material.dispose();}
update(0);
return {update,dispose};`}
];
