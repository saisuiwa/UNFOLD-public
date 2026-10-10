import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {withStudioPage} from './browser-helper.mjs';
/**
 * Compressed audio (AAC/MP3) is decoded by STUDIO in one-second chunks. Every chunk must equal the same
 * second of one continuous decode; a decoder that is started cold at each second damages its first ~25 ms.
 * Self-made synthetic signal only. The MP3 leg needs ffmpeg (libmp3lame) because Chrome cannot encode MP3.
 */
const SECONDS=6;
const signal=(i,rate)=>{const t=i/rate;let s=.18*Math.sin(2*Math.PI*220*t)+.12*Math.sin(2*Math.PI*1375*t+3*Math.sin(2*Math.PI*.7*t))+.08*Math.sin(2*Math.PI*5230*t);s+=.05*((Math.imul(i,2654435761)>>>0)/4294967295-.5);return s*(.6+.4*Math.sin(2*Math.PI*.37*t));};
const raw=new Float32Array(48000*SECONDS*2);for(let i=0;i<48000*SECONDS;i++){raw[2*i]=signal(i,48000);raw[2*i+1]=signal(i+37,48000);}
function makeMp3(){
 let dir;try{execFileSync('ffmpeg',['-version'],{stdio:'ignore'});}catch{return null;}
 try{dir=mkdtempSync(join(tmpdir(),'unfold-mp3-'));
  writeFileSync(join(dir,'in.f32'),Buffer.from(raw.buffer));
  execFileSync('ffmpeg',['-v','error','-y','-f','f32le','-ar','48000','-ac','2','-i',join(dir,'in.f32'),'-c:a','libmp3lame','-b:a','128k',join(dir,'out.mp3')]);
  return readFileSync(join(dir,'out.mp3')).toString('base64');
 }catch(e){console.log('SKIP mp3 leg: ffmpeg could not make the fixture:',e.message);return null;}finally{if(dir)rmSync(dir,{recursive:true,force:true});}
}
const mp3=makeMp3();if(!mp3)console.log('NOTE mp3 leg skipped (ffmpeg with libmp3lame not available); AAC leg still runs');
await withStudioPage(async page=>{
 const result=await page.evaluate(async({pcm,mp3,seconds})=>{
  const m=await import('/vendor/studio-media.js'),{createMediaReader}=await import('/studio/media.js'),bytes=Uint8Array.from(atob(pcm),c=>c.charCodeAt(0)),samples=new Float32Array(bytes.buffer);
  if(!await m.canEncodeAudio('aac',{numberOfChannels:2,sampleRate:48000}))throw Error('BLOCKED: AAC encoder unavailable');
  const target=new m.BufferTarget(),output=new m.Output({format:new m.Mp4OutputFormat(),target}),source=new m.AudioBufferSource({codec:'aac',bitrate:128000});output.addAudioTrack(source);await output.start();
  const buffer=new AudioBuffer({numberOfChannels:2,length:48000*seconds,sampleRate:48000});for(let i=0;i<buffer.length;i++){buffer.getChannelData(0)[i]=samples[2*i];buffer.getChannelData(1)[i]=samples[2*i+1];}
  await source.add(buffer);await output.finalize();
  const blobs=new Map([['aac',new Blob([target.buffer],{type:'audio/mp4'})]]);
  if(mp3)blobs.set('mp3',new Blob([Uint8Array.from(atob(mp3),c=>c.charCodeAt(0))],{type:'audio/mpeg'}));
  const report={};
  for(const [id,blob] of blobs){
   // Reference: ONE continuous decode of the whole file, placed by its own timestamps.
   const input=new m.Input({source:new m.BlobSource(blob),formats:m.ALL_FORMATS}),track=(await input.getAudioTracks())[0],ref=new Float32Array(48000*(seconds+1));
   for await(const s of new m.AudioSampleSink(track).samples()){const b=s.toAudioBuffer(),at=Math.round(s.timestamp*48000),d=b.getChannelData(0);for(let k=0;k<d.length;k++){const j=at+k;if(j>=0&&j<ref.length)ref[j]=d[k];}s.close();}
   input.dispose();
   // Under test: STUDIO's own chunked reader.
   const reader=createMediaReader({get:async()=>blob}),probe=await reader.probe(id),count=48000*(seconds-1),got=await reader.audioBlock(id,probe.audioTracks[0].id,0,count);reader.dispose();
   let energy=0;for(let i=0;i<count;i++)energy+=ref[i]*ref[i];
   const perSecond=[];for(let n=1;n<seconds-1;n++){let worst=0;for(let i=n*48000;i<(n+1)*48000;i++)worst=Math.max(worst,Math.abs(got.channels[0][i]-ref[i]));perSecond.push(+worst.toFixed(5));}
   report[id]={rms:Math.sqrt(energy/count),perSecond};
  }
  return report;
 },{pcm:Buffer.from(raw.buffer).toString('base64'),mp3,seconds:SECONDS});
 for(const [id,r] of Object.entries(result)){
  assert.ok(r.rms>.05,`${id}: reference decode is silent (rms ${r.rms}); fixture invalid`);
  for(const [i,worst] of r.perSecond.entries())assert.ok(worst<1e-3,`${id}: second ${i+1} differs from the continuous decode by up to ${worst} (cold decoder at the chunk start); all seconds: ${JSON.stringify(r.perSecond)}`);
 }
 console.log('PASS audio chunks: every second of '+Object.keys(result).join(' + ')+' equals the continuous decode');
});
