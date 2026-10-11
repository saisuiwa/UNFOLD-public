// 縁取り (outline) and 中抜き (hollow) on chosen words, through the real code-motion worker: a mesh that mixes plain and decorated words is split
// per glyph; plain words are untouched; a fully decorated mesh is styled directly.
import assert from 'node:assert/strict';import {withStudioPage} from './browser-helper.mjs';
await withStudioPage(async page=>{
 const r=await page.evaluate(async()=>{
  const {createCodeMotionRuntime}=await import('/code-motion-runtime.js');
  const source=`const {createText,text,fontSize}=api;createText(text,{fontSize});return {update(){}};`;
  const W=900,H=300;
  async function frame(text,runs,{src=source,fontSize=170}={}){
   const rt=createCodeMotionRuntime();
   try{await rt.prepare({source:src,text,width:W,height:H,fontSize,color:'#ffffff',accent:'#ffcc00',runs,duration:1,bpm:120,seed:1});
    const bitmap=await rt.render(.5);const c=new OffscreenCanvas(W,H),x=c.getContext('2d');x.drawImage(bitmap,0,0);bitmap.close?.();
    const d=x.getImageData(0,0,W,H).data;return {data:d};
   }finally{rt.dispose();}
  }
  // statistics of one third of the picture (one character each): painted pixels, pixels with the glyph's own colour (white), dark pixels (the outline colour)
  const third=(f,k)=>{const x0=Math.round(W/2-W*.3)+k*Math.round(W*.2),x1=x0+Math.round(W*.2);let painted=0,white=0,dark=0;
   for(let y=0;y<H;y++)for(let x=x0;x<x1;x++){const i=(y*W+x)*4,a=f.data[i+3];if(a>128){painted++;const l=(f.data[i]+f.data[i+1]+f.data[i+2])/3;if(l>200)white++;if(l<60)dark++;}}
   return {painted,white,dark};};
  const text='あいう';
  const plainRuns=[{text,emphasis:false}];
  const mixed=[{text:'あ'},{text:'い',hollow:true},{text:'う',outline:true}];
  const plain=await frame(text,plainRuns),deco=await frame(text,mixed);
  const allHollow=await frame(text,[{text,hollow:true}]),allOutline=await frame(text,[{text,outline:true}]);
  const colourful=await frame(text,[{text:'あ',color:'#ff4d4d'},{text:'い',hollow:true,color:'#4dd2ff'},{text:'う'}]);
  // a chosen outline colour (red): red pixels around the third character, no dark edge
  const thin=await frame(text,[{text:'あい'},{text:'う',outline:true,outlineWidth:2}]),thick=await frame(text,[{text:'あい'},{text:'う',outline:true,outlineWidth:14}]);
  const darkOf=(f,k)=>third(f,k).dark;
  const red=await frame(text,[{text:'あい'},{text:'う',outline:true,outlineColor:'#ff0000'}]);
  const redPixels=(f,k)=>{const x0=Math.round(W/2-W*.3)+k*Math.round(W*.2),x1=x0+Math.round(W*.2);let r=0,dark=0;for(let y=0;y<H;y++)for(let x=x0;x<x1;x++){const i=(y*W+x)*4;if(f.data[i+3]>128){if(f.data[i]>180&&f.data[i+1]<80&&f.data[i+2]<80)r++;if((f.data[i]+f.data[i+1]+f.data[i+2])/3<60)dark++;}}return {r,dark};};
  return {thinDark:darkOf(thin,2),thickDark:darkOf(thick,2),defaultDark:darkOf(await frame(text,[{text:'あい'},{text:'う',outline:true}]),2),red:redPixels(red,2),redElsewhere:redPixels(red,0),plain:[0,1,2].map(k=>third(plain,k)),deco:[0,1,2].map(k=>third(deco,k)),allHollow:[0,1,2].map(k=>third(allHollow,k)),allOutline:[0,1,2].map(k=>third(allOutline,k)),colourful:[0,1,2].map(k=>third(colourful,k))};
 });
 const [p0,p1,p2]=r.plain,[d0,d1,d2]=r.deco;
 assert.ok(p0.painted>2000&&p1.painted>2000&&p2.painted>2000,'plain text is drawn: '+JSON.stringify(r.plain));
 // the plain word is exactly as before (nothing moved, nothing hidden)
 assert.ok(Math.abs(d0.painted-p0.painted)<p0.painted*.03,'plain word untouched: '+d0.painted+' vs '+p0.painted);
 // hollow: the glyph is still there (its edge), but far fewer filled pixels than the plain glyph
 assert.ok(d1.painted>p1.painted*.15,'the hollow word is still drawn: '+d1.painted);
 assert.ok(d1.painted<p1.painted*.75,'and it is hollow: '+d1.painted+' vs '+p1.painted);
 assert.ok(d1.white<p1.white*.6,'less white fill: '+d1.white+' vs '+p1.white);
 // outline: the glyph has a dark edge around it, so there are dark pixels and more painted pixels than the plain glyph
 assert.ok(d2.dark>50&&p2.dark<10,'the outlined word has a dark edge: '+d2.dark+' vs '+p2.dark);
 assert.ok(d2.painted>p2.painted*1.1,'and is wider: '+d2.painted+' vs '+p2.painted);
 // a mesh decorated alike all over is styled directly
 for(const k of [0,1,2]){assert.ok(r.allHollow[k].painted<r.plain[k].painted*.75,'all hollow '+k);assert.ok(r.allOutline[k].dark>50,'all outline '+k);}
 // colours stay per word, with the decoration on top
 const [c0,c1]=r.colourful;
 assert.ok(c0.painted>2000&&c1.painted>d1.painted*.5&&c1.painted<p1.painted*.75,'coloured word, coloured hollow word: '+JSON.stringify(r.colourful));
 assert.ok(r.red.r>300&&r.red.dark<30,'the outline is the chosen red, not the automatic dark: '+JSON.stringify(r.red));assert.equal(r.redElsewhere.r,0,'no red on plain words');
 assert.ok(r.thinDark<r.defaultDark&&r.defaultDark<r.thickDark,'the outline width is honoured: '+[r.thinDark,r.defaultDark,r.thickDark].join(' < '));
 console.log('PASS word decoration: hollow and outline on chosen words, plain words untouched',JSON.stringify({plain:p1.painted,hollow:d1.painted,outlineDark:d2.dark}));
});

// the 2D painter (lyrics without a code motion) honours the same flags
await withStudioPage(async page=>{
 const r=await page.evaluate(async()=>{
  const {createLyricPainter}=await import('/lyric-painter.js'),{cleanMotion}=await import('/lyric-motion.js');
  const W=1200,H=400;
  const draw=runs=>{
   const c=document.createElement('canvas');c.width=W;c.height=H;const ctx=c.getContext('2d'),painter=createLyricPainter({fontCSS:(_,size)=>`${size}px sans-serif`});
   const motion=cleanMotion({preset:'reveal',color:'#ffffff',font:'gothic',size:150,position:'center'});
   painter.draw(ctx,{id:'e',text:runs.map(x=>x.text).join(''),runs,motion,start:0,end:4},3,{width:W,height:H});
   return ctx.getImageData(0,0,W,H).data;
  };
  const stats=d=>{let painted=0,white=0,dark=0;for(let i=0;i<d.length;i+=4){if(d[i+3]>128){painted++;const l=(d[i]+d[i+1]+d[i+2])/3;if(l>200)white++;if(l<60)dark++;}}return {painted,white,dark};};
  const redStats=d=>{let red=0,dark=0;for(let i=0;i<d.length;i+=4){if(d[i+3]>128){if(d[i]>180&&d[i+1]<80&&d[i+2]<80)red++;if((d[i]+d[i+1]+d[i+2])/3<60)dark++;}}return {red,dark};};
  const widths=[2,8,16].map(w=>stats(draw([{text:'あいう',outline:true,outlineWidth:w}])).dark);
  return {widths,plain:stats(draw([{text:'あいう'}])),hollow:stats(draw([{text:'あいう',hollow:true}])),outline:stats(draw([{text:'あいう',outline:true}])),red:redStats(draw([{text:'あいう',outline:true,outlineColor:'#ff0000'}]))};
 });
 assert.ok(r.plain.painted>3000,'drawn: '+JSON.stringify(r.plain));
 assert.ok(r.hollow.painted<r.plain.painted*.7&&r.hollow.dark===0,'hollow is only the contour, with no dark edge: '+JSON.stringify(r));
 assert.ok(r.outline.dark>r.plain.dark*2&&r.outline.painted>r.plain.painted*1.4,'outlined text has a thick dark edge: '+JSON.stringify(r));
 assert.ok(r.red.red>1000,'the painter uses the chosen outline colour: '+JSON.stringify(r.red));
 assert.ok(r.widths[0]<r.widths[1]&&r.widths[1]<r.widths[2],'the painter honours the width: '+r.widths.join(' < '));
 console.log('PASS word decoration in the 2D painter',JSON.stringify(r));
});
