import {createCodeMotionLayer} from './code-motion-layer.js';
import {isCodeMotionApproved} from './code-motion-format.js';
import {getCodeMotionFont} from './lyric-fonts.js';
import {createLyricPainter} from './lyric-painter.js?v=4';
import * as THREE from './vendor/three.module.min.js';
import {lyricFontCSS,prepareLyricFont} from './lyric-fonts.js';
import {activeLyric} from './lyric-timing.js?v=2';
import {cleanMotion,layoutText,motionAt} from './lyric-motion.js?v=26';
export function createLyricOverlay(renderer,callbacks={}){
  const codeLayer=createCodeMotionLayer(callbacks);
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d'),painter=createLyricPainter();
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=THREE.LinearFilter;texture.generateMipmaps=false;
  const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false,toneMapped:false});
  const geometry=new THREE.PlaneGeometry(2,2),scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,0,2);camera.position.z=1;scene.add(new THREE.Mesh(geometry,material));
  const fontString=lyricFontCSS;
  return {
    async prepare(doc){codeLayer.reset();for(const e of doc?.events||[]){if(e.motion?.code){if(!isCodeMotionApproved(e.motion.code.source))throw Error('未確認のコードモーションです。「コードを編集」からプレビューして有効にしてください。');await getCodeMotionFont(e.motion.font)}}const fonts=new Map();for(const e of doc?.events||[]){if(e.kind!=='line')continue;const m=cleanMotion(e.motion||{}),f=m.font;fonts.set(f,(fonts.get(f)||'')+e.text)}await Promise.all([...fonts].map(([f,text])=>prepareLyricFont(f,text)));painter.clear();},
    async prepareFrame(doc,time,{duration=12,...options}={}){const e=activeLyric(doc,time,duration);if(e?.motion?.code)await codeLayer.prepareFrame(e,time,options)},
    render(doc,time,{duration=12,bpm=120,width=renderer.domElement.width,height=renderer.domElement.height}={}){
      if(!doc)return;const e=activeLyric(doc,time,duration);if(!e)return;const v=motionAt(e,time,bpm);if(!e.motion?.code&&!v.opacity)return;
      width=Math.max(1,Math.round(width));height=Math.max(1,Math.round(height));if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;texture.dispose()}ctx.clearRect(0,0,width,height);
      if(e.motion?.code){codeLayer.draw(ctx,e,time,{width,height,bpm});}else if(e.motion?.recipe?.version===1){painter.draw(ctx,e,time,{width,height,bpm});}else{
      const m=cleanMotion(e.motion||{}),font=m.font;
      const measure=(s,size)=>{ctx.font=fontString(font,size);return ctx.measureText(s).width};
      const layout=layoutText(e.runs,{width:width*.84,height:height*.85,font:m.font,size:m.size*height/1080,measure});
      const size=layout.size,lineH=size*1.3,textHeight=layout.lines.length*lineH;
      const y=m.position==='center'?height*.5:Math.min(height*.83,height*.92-textHeight/2);
      ctx.save();ctx.beginPath();ctx.rect(width*.05,height*.05,width*.9,height*.9);ctx.clip();ctx.globalAlpha=v.opacity;ctx.translate(width/2+v.x*size,y+v.y*size);ctx.scale(v.scale,v.scale);ctx.font=fontString(font,size);ctx.textBaseline='middle';ctx.lineJoin='round';ctx.lineWidth=Math.max(1,size*.09);ctx.strokeStyle='rgba(0,0,0,.75)';
      const count=layout.lines.reduce((n,l)=>n+l.runs.length,0),visible=Math.ceil(count*v.reveal);let index=0;
      layout.lines.forEach((line,li)=>{let x=-line.width/2;const yy=(li-(layout.lines.length-1)/2)*lineH;for(const run of line.runs){const w=measure(run.text,size);if(index++<visible){ctx.save();ctx.translate(x+w/2,yy);if(run.emphasis)ctx.scale(v.emphasis,v.emphasis);ctx.fillStyle=run.color||(run.emphasis?m.emphasisColor:m.color);ctx.strokeText(run.text,-w/2,0);ctx.fillText(run.text,-w/2,0);ctx.restore()}x+=w}});ctx.restore();}
      texture.needsUpdate=true;
      const auto=renderer.autoClear,target=renderer.getRenderTarget(),viewport=renderer.getViewport(new THREE.Vector4()),scissor=renderer.getScissor(new THREE.Vector4()),scissorTest=renderer.getScissorTest();
      try{renderer.autoClear=false;renderer.render(scene,camera)}finally{renderer.autoClear=auto;renderer.setRenderTarget(target);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest)}
    },
    dispose(){codeLayer.dispose();painter.clear();texture.dispose();material.dispose();geometry.dispose()}
  };
}
