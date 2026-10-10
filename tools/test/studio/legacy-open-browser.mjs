import assert from 'node:assert/strict';
import {withStudioPage} from './browser-helper.mjs';
/**
 * Opening an old UNFOLD project (.unfold) in STUDIO creates a NEW project, so the song and the timed lyrics
 * must come with it. A song that cannot be read must not block the rest of the import.
 */
await withStudioPage(async page=>{
 const result=await page.evaluate(async()=>{
  const {openStudioStore}=await import('/studio/store.js'),{createController}=await import('/studio/controller.js');
  const canvas=new OffscreenCanvas(64,36),ctx=canvas.getContext('2d');ctx.fillStyle='#456';ctx.fillRect(0,0,64,36);
  const png=new Uint8Array(await (await canvas.convertToBlob({type:'image/png'})).arrayBuffer());
  const wav=(()=>{const n=96000,bytes=new ArrayBuffer(44+n*2),v=new DataView(bytes),t=(i,s)=>{for(let j=0;j<s.length;j++)v.setUint8(i+j,s.charCodeAt(j));};t(0,'RIFF');v.setUint32(4,36+n*2,true);t(8,'WAVE');t(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,48000,true);v.setUint32(28,96000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);t(36,'data');v.setUint32(40,n*2,true);for(let i=0;i<n;i++)v.setInt16(44+2*i,Math.round(8000*Math.sin(2*Math.PI*440*i/48000)),true);return new Uint8Array(bytes);})();
  const legacyFile=(song,type)=>{const json={version:4,settings:{bpm:60,holdBeats:2,offset:0},slides:[{img:'pic',hold:2}],transitions:[],
    assets:{pic:{offset:0,size:png.length,type:'image/png'},song:{offset:png.length,size:song.length,type}},audio:{asset:'song'},
    lyricDocument:{version:1,enabled:true,events:[{id:'L1',kind:'line',raw:'光をつなぐ',text:'光をつなぐ',decision:'lyric',s:.5,e:1.5,runs:[{text:'光をつなぐ',emphasis:false}],timingSource:'file'}]}};
   const body=new TextEncoder().encode(JSON.stringify(json)),n=new Uint8Array(4);new DataView(n.buffer).setUint32(0,body.length,true);return new File(['UNFOLD-PROJECT-1\n',n,body,png,song],'旧作品.unfold');};
  const open=async(db,file)=>{localStorage.removeItem('unfold-studio-current');const store=await openStudioStore({dbName:db}),c=createController({store});await c.ready;await c.openFile(file);
   const p=c.get().project,out={music:p.audio.filter(a=>a.role==='music').map(a=>({asset:!!p.assets[a.assetId],type:p.assets[a.assetId]?.type,startUs:a.startUs,endUs:a.endUs})),lyrics:p.lyrics.map(l=>({text:l.text,startUs:l.startUs,endUs:l.endUs})),clips:p.clips.length,durationUs:p.durationUs,message:c.get().message,saved:c.get().saveStatus};
   await c.dispose();return out;};
  return {withSong:await open('unfold-studio-legacy-open-song',legacyFile(wav,'audio/wav')),unreadable:await open('unfold-studio-legacy-open-bad',legacyFile(new TextEncoder().encode('not audio at all'),'audio/mpeg'))};
 });
 const a=result.withSong;
 assert.equal(a.music.length,1,'the song of the old project must come along');
 assert.deepEqual(a.music[0],{asset:true,type:'audio/wav',startUs:0,endUs:2e6});
 assert.deepEqual(a.lyrics,[{text:'光をつなぐ',startUs:5e5,endUs:15e5}],'timed lyrics must come along unchanged');
 assert.equal(a.clips,1);assert.equal(a.durationUs,2e6);assert.equal(a.saved,'保存済み');

 const b=result.unreadable;
 assert.equal(b.music.length,0);assert.equal(b.lyrics.length,1,'an unreadable song must not block images and lyrics');
 assert.match(b.message,/曲/,'the user is told why the song is missing');assert.equal(b.saved,'保存済み');
 console.log('PASS opening an old UNFOLD project brings its song and lyrics; an unreadable song only produces a notice');
});
