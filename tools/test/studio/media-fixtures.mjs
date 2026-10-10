/** Self-made timecode and tones only. No user media leaves this browser. */
export async function makeMediaFixtures(page){
 return page.evaluate(async()=>{
 const m=await import('/vendor/studio-media.js');
 if(!await m.canEncodeVideo('avc',{width:320,height:180})||!await m.canEncodeAudio('aac',{numberOfChannels:2,sampleRate:48000}))throw Error('BLOCKED: required H.264/AAC encoder unavailable');
 const create=async({fps=30,audio=true,rotation=0,vfr=false}={})=>{
 const canvas=new OffscreenCanvas(320,180),ctx=canvas.getContext('2d'),target=new m.BufferTarget(),output=new m.Output({format:new m.Mp4OutputFormat(),target}),video=new m.CanvasSource(canvas,{codec:'avc',bitrate:500000});output.addVideoTrack(video,{rotation});
 let audioSource;if(audio){audioSource=new m.AudioBufferSource({codec:'aac',bitrate:128000},{startTimestamp:.25});output.addAudioTrack(audioSource);}
 await output.start();const videoTask=(async()=>{let t=0,i=0;while(t<4-1e-8){const dt=vfr?(i%2?1/24:1/60):1/fps;ctx.fillStyle=i%2?'#234567':'#567823';ctx.fillRect(0,0,320,180);ctx.fillStyle='white';ctx.font='24px sans-serif';ctx.fillText(t.toFixed(3),12,50);ctx.fillRect(0,0,8,8);await video.add(t,Math.min(dt,4-t));t+=dt;i++;}})();
 const audioTask=audio?(async()=>{const b=new AudioBuffer({numberOfChannels:2,length:180000,sampleRate:48000});for(let c=0;c<2;c++){const data=b.getChannelData(c);for(let i=0;i<data.length;i++)data[i]=.2*Math.sin(2*Math.PI*440*i/48000);}await audioSource.add(b);})():Promise.resolve();await Promise.all([videoTask,audioTask]);await output.finalize();return new Blob([target.buffer],{type:'video/mp4'});
 };
 const av=await create(),silent=await create({audio:false}),portrait=await create({rotation:90}),vfr=await create({vfr:true}),fps24=await create({fps:24,audio:false}),fps60=await create({fps:60,audio:false});
 const bytes=new Uint8Array(await av.arrayBuffer());let changed=0;for(const name of ['mp4a','esds']){const pattern=[...name].map(c=>c.charCodeAt(0));for(let i=0;i<bytes.length-4;i++)if(pattern.every((b,j)=>bytes[i+j]===b)){bytes.set([122,122,122,122],i);changed++;break;}}if(changed!==2)throw Error('AAC sample entry/descriptor fixture not found');
 window.mediaFixtures=new Map([['av',av],['silent',silent],['portrait',portrait],['vfr',vfr],['fps24',fps24],['fps60',fps60],['unsupported',new Blob([bytes],{type:'video/mp4'})]]);return [...mediaFixtures].map(([id,b])=>({id,bytes:b.size}));
 });
}
