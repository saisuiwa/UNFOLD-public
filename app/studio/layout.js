import {newLayout,StudioError} from './model.js';
export function defaultLayout(viewId,kind){return {...newLayout(),fontScale:.06,y:kind==='lyric'?.78:.5};}
export function resolveLayout(p,viewId,id,seen=new Set()){
 if(seen.has(id))throw new StudioError('ANCHOR_CYCLE');seen.add(id);const l=structuredClone(p.views[viewId]?.layout[id]);if(!l)throw new StudioError('MISSING_LAYOUT');
 if(l.anchor!=='canvas'){const parent=resolveLayout(p,viewId,l.anchor.clipId,seen);l.x=parent.x+(l.x-.5)*parent.scale;l.y=parent.y+(l.y-.5)*parent.scale;l.scale*=parent.scale;l.rotation+=parent.rotation;}return l;
}
export function fitRect(sourceSize,targetSize,l){
 const sw=sourceSize.width,sh=sourceSize.height,tw=targetSize.width,th=targetSize.height,scale=l.scale??1;
 let source={x:0,y:0,width:sw,height:sh},dw,dh;
 if(l.fit==='cover'){const ratio=Math.max(tw/sw,th/sh);source.width=tw/ratio;source.height=th/ratio;source.x=(sw-source.width)*Math.max(0,Math.min(1,l.focus?.x??.5));source.y=(sh-source.height)*Math.max(0,Math.min(1,l.focus?.y??.5));dw=tw*scale;dh=th*scale;}
 else {const ratio=Math.min(tw/sw,th/sh)*scale;dw=sw*ratio;dh=sh*ratio;}
 return {source,dest:{x:tw*l.x-dw/2,y:th*l.y-dh/2,width:dw,height:dh}};
}
export function drawFitted(ctx,image,l){
 const w=ctx.canvas.width,h=ctx.canvas.height,size={width:image.displayWidth||image.width,height:image.displayHeight||image.height};
 if(l.backdrop==='blur'){ctx.save();ctx.filter=`blur(${Math.max(w,h)*.025}px)`;const r=fitRect(size,{width:w,height:h},{...l,x:.5,y:.5,fit:'cover',scale:1.12});ctx.drawImage(image,r.source.x,r.source.y,r.source.width,r.source.height,r.dest.x,r.dest.y,r.dest.width,r.dest.height);ctx.restore();}
 const r=fitRect(size,{width:w,height:h},l);ctx.save();ctx.translate(w*l.x,h*l.y);ctx.rotate(l.rotation*Math.PI/180);ctx.translate(-w*l.x,-h*l.y);ctx.drawImage(image,r.source.x,r.source.y,r.source.width,r.source.height,r.dest.x,r.dest.y,r.dest.width,r.dest.height);ctx.restore();
}
