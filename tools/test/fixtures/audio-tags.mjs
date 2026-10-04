export const utf=s=>new TextEncoder().encode(s);export const cat=(...a)=>Uint8Array.from(a.flatMap(x=>[...x]));
export const be=(n,len=4)=>Uint8Array.from(Array.from({length:len},(_,i)=>(n/2**(8*(len-1-i)))&255));export const sync=n=>Uint8Array.from([n>>21&127,n>>14&127,n>>7&127,n&127]);
export function tag(frames,v=3){const body=cat(...frames.map(([id,data])=>cat(utf(id),v===2?be(data.length,3):v===4?sync(data.length):be(data.length),v===2?[]:[0,0],data)));return cat(utf('ID3'),[v,0,0],sync(body.length),body)}
export const uslt=(s,lang='jpn',enc=3)=>cat([enc],utf(lang),[0],utf(s));
export const sylt=(s,ms,unit=2)=>cat([3],utf('jpn'),[unit,1,0],utf(s),[0],be(ms));
export const box=(type,body)=>cat(be(body.length+8),Uint8Array.from([...type].map(c=>c.charCodeAt(0))),body);
export const mp4=s=>box('moov',box('udta',box('meta',cat([0,0,0,0],box('ilst',box('©lyr',box('data',cat([0,0,0,1,0,0,0,0],utf(s)))))))));
