const bundleURL=new URL('./vendor/code-motion-worker.js',import.meta.url);
const fallbackURL=new URL('./vendor/motion-fonts/gothic.ttf',import.meta.url);
export const CODE_MOTION_STARTER=`const {createText,gsap,text,accent}=api;
const label=createText(text);
const timeline=gsap.timeline({paused:true});
timeline.fromTo(label.position,{y:-40},{y:0,duration:1,ease:'power2.out'},0);
timeline.fromTo(label.material,{opacity:0},{opacity:1,duration:0.6},0);
return {timeline};`;
export function codeMotionExample(){return CODE_MOTION_STARTER;}
const bridge=`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob:; worker-src blob:; connect-src blob: data:; img-src blob: data:"><script>
let worker,port,url;
addEventListener('message',e=>{if(e.source!==parent||port||!e.ports[0]||typeof e.data?.bundle!=='string')return;port=e.ports[0];url=URL.createObjectURL(new Blob([e.data.bundle],{type:'text/javascript'}));worker=new Worker(url);worker.onmessage=e=>{const m=e.data;port.postMessage(m,m.bitmap?[m.bitmap]:[]);};worker.onerror=e=>port.postMessage({fatal:e.message||'Worker error'});port.onmessage=e=>{if(e.data.type==='terminate'){worker.terminate();URL.revokeObjectURL(url);port.close();return;}worker.postMessage(e.data);};port.start();port.postMessage({ready:true});});
<\/script>`;
export function createCodeMotionRuntime({initializationTimeout=15000,frameTimeout=5000}={}){
 let frame,port,ready,prepared=false,dead=false,sequence=0;const pending=new Map();
 function stop(reason='Runtime disposed'){
  if(dead)return;dead=true;port?.postMessage({type:'terminate'});port?.close();frame?.remove();
  for(const p of pending.values()){clearTimeout(p.timer);p.reject(new Error(reason));}pending.clear();
 }
 function request(message,timeout){return new Promise((resolve,reject)=>{if(dead)return reject(new Error('Runtime disposed'));const id=++sequence;const timer=setTimeout(()=>stop('Code motion timed out; worker terminated.'),timeout);pending.set(id,{resolve,reject,timer,type:message.type});port.postMessage({...message,id});});}
 async function connect(bundle){
  frame=document.createElement('iframe');frame.sandbox='allow-scripts';frame.setAttribute('aria-hidden','true');frame.style.display='none';frame.srcdoc=bridge;
  ready=new Promise((resolve,reject)=>{const channel=new MessageChannel();port=channel.port1;const timer=setTimeout(()=>{reject(new Error('Sandbox initialization timed out'));stop();},initializationTimeout);
   port.onmessage=({data:m})=>{if(m.ready){clearTimeout(timer);resolve();return;}if(m.fatal){stop(m.fatal);return;}const p=pending.get(m.id);if(!p){m.bitmap?.close();return;}pending.delete(m.id);clearTimeout(p.timer);if(m.error)p.reject(new Error(m.error));else if(p.type==='render'&&!(m.bitmap instanceof ImageBitmap))p.reject(new Error('Invalid worker bitmap'));else p.resolve(m.bitmap);};port.start();
   frame.onload=()=>frame.contentWindow.postMessage({bundle},'*',[channel.port2]);document.body.append(frame);
  });await ready;
 }
 return {
  async prepare(p){
   if(dead)throw new Error('Runtime disposed');if(frame)throw new Error('Runtime already prepared; create a new instance.');
   if(typeof p.source!=='string'||!p.source.trim()||p.source.length>32000)throw new Error('Source must contain 1–32000 characters.');
   for(const key of ['width','height'])if(!Number.isInteger(p[key])||p[key]<1||p[key]>8192)throw new Error('Invalid render dimensions.');
   if(!Number.isFinite(p.fontSize)||p.fontSize<=0)throw new Error('Invalid font size.');
   const [bundle,fontBytes]=await Promise.all([fetch(bundleURL).then(r=>{if(!r.ok)throw new Error('Worker bundle unavailable');return r.text();}),p.fontBytes?Promise.resolve(p.fontBytes):fetch(fallbackURL).then(r=>{if(!r.ok)throw new Error('Fallback font unavailable');return r.arrayBuffer();})]);
   if(dead)throw new Error('Runtime disposed');await connect(bundle);
   try{await request({type:'prepare',payload:{source:p.source,text:String(p.text??''),width:p.width,height:p.height,fontSize:p.fontSize,color:p.color??'#ffffff',accent:p.accent??'#77ccff',fontBytes,runs:Array.isArray(p.runs)?p.runs:[],duration:p.duration??1,bpm:p.bpm??120,seed:p.seed??1}},initializationTimeout);prepared=true;}catch(e){stop(e.message);throw e;}
  },
  async render(time){if(!port||dead||!prepared)throw new Error('Runtime is not prepared');if(!Number.isFinite(time)||time<0)throw new Error('Invalid frame time');await ready;return request({type:'render',time},frameTimeout);},
  dispose(){stop();}
 };
}
