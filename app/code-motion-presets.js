export const CODE_MOTION_PRESETS=[
 {name:'浮遊するタイプ',source:`const {createText,gsap,text,width,height,duration}=api;
const label=createText(text,{maxWidth:width*.82,textAlign:'center',lineHeight:1.25,outlineWidth:'3%',outlineColor:'#101819'});
const timeline=gsap.timeline({paused:true});
const enter=Math.min(.8,duration*.22),exit=Math.min(.5,duration*.2);
timeline.fromTo(label.scale,{x:.65,y:.65},{x:1,y:1,duration:enter,ease:'back.out(1.5)'},0);
timeline.fromTo(label.position,{y:-height*.12},{y:0,duration:enter,ease:'power3.out'},0);
timeline.fromTo(label,{fillOpacity:0,outlineOpacity:0},{fillOpacity:1,outlineOpacity:1,duration:enter*.6},0);
timeline.to(label,{fillOpacity:0,outlineOpacity:0,duration:exit},Math.max(enter,duration-exit));
return {timeline,update(t){label.rotation.z=Math.sin(t*1.8)*.018;label.position.x=Math.sin(t*1.3)*width*.012;}};`},
 {name:'ネオングリッチ',source:`const {createText,text,width,duration,color,accent}=api;
const opts={maxWidth:width*.8,textAlign:'center',outlineWidth:'1.5%'};
const shadow=createText(text,{...opts,color:accent,colorRanges:null,outlineColor:accent});
const label=createText(text,{...opts,color,outlineColor:'#101819'});
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
return {update(t){
 const fade=smooth(t/.35)*smooth((duration-t)/.3);
 const burst=Math.sin(Math.floor(t*12)*17.1)>.75;
 const dx=burst?Math.sin(t*151)*width*.012:0;
 label.position.x=dx;label.fillOpacity=fade*(burst?.65:1);label.outlineOpacity=fade;
 shadow.position.x=dx+(burst?width*.017:width*.003);shadow.position.y=burst?7:0;
 shadow.fillOpacity=fade*(burst?.65:.18);shadow.outlineOpacity=0;
 label.scale.y=1+Math.sin(t*2)*.015;
}};`},
 {name:'リボンの波',source:`const {createText,gsap,text,width,height,fontSize,color,accent,duration,runs}=api;
const chars=Array.from(text.replace(/\\n/g,' '));
if(chars.length>80){const label=createText(text,{maxWidth:width*.8,textAlign:'center'});return {update(t){const b=label.textRenderInfo?.blockBounds;label.scale.setScalar(b?Math.min(1,height*.7/(b[3]-b[1])):1);label.position.y=Math.sin(t*2)*height*.01;label.fillOpacity=Math.min(1,t/.3,Math.max(0,(duration-t)/.3));}};}
const group=new api.THREE.Group();api.scene.add(group);
const step=Math.min(fontSize*.92,width*.8/Math.max(1,chars.length));
let offset=0;const colors=[];for(const run of runs)for(const c of Array.from(run.text)){colors.push(run.color||(run.emphasis?accent:color));}
const labels=chars.map((c,i)=>{const label=createText(c,{fontSize:step*.96,color:colors[i]||color,outlineWidth:'2%',outlineColor:'#101819'});group.add(label);label.position.x=(i-(chars.length-1)/2)*step;return label});
const timeline=gsap.timeline({paused:true});
timeline.fromTo(group.rotation,{z:-.1},{z:0,duration:Math.min(1,duration*.25),ease:'power3.out'},0);
return {timeline,update(t){labels.forEach((label,i)=>{
 const delay=i/Math.max(1,chars.length)*Math.min(.5,duration*.15);
 const enter=Math.max(0,Math.min(1,(t-delay)/.45));
 const exit=Math.max(0,Math.min(1,(duration-t)/.3));
 label.position.y=(1-enter)**3*-height*.2+Math.sin(t*2.5-i*.45)*step*.12;
 label.rotation.z=Math.sin(t*2-i*.3)*.05;
 label.fillOpacity=enter*exit;label.outlineOpacity=enter*exit;
})}};`}
];
export function codeMotionPrompt(){return `UNFOLD用のJavaScriptテキストモーションを作ってください。外部のHTMLやimportではなく、apiを引数に受け取る関数の本体のみ返してください。最大32000文字。利用可能: api.THREE (0.180.0), api.Text (Troika 0.52.4), api.gsap (3.13.0), scene, camera, text（改行・強調は処理済み）, runs（text/emphasis/color）, width,height,fontSize,color,accent,fontURL,createText(text,options),random(),duration,bpm。文字はcreateTextを使うと選択中の書体・色が引き継がれます。座標は画面中心が原点、x右/y上、単位px。return {timeline,update(t),dispose()} のtimelineまたはupdateが必須。GSAP timelineはpaused:true。tは歌詞開始からの秒、durationは終了秒。毎フレーム必ず同じ時刻なら同じ結果にし、前のフレームに依存する加算・実時間・Math.random・自動再生は禁止。DOM、ストレージ、ネットワークは利用不可。日本語と長い歌詞も画面に収め、登場・持続・退場を含めてください。文字/geometry/material等は生成時に作りupdateで使い回してください。\n参考:\n${CODE_MOTION_PRESETS[0].source}\n希望する演出：`}
