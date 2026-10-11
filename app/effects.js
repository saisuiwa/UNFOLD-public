import * as THREE from './vendor/three.module.min.js';
import {smooth} from './motion.js?v=27';
// Timeline of the single-image mode's effects. The "look" effects (scanlines, grain, vignette) stay on the whole time;
// the motion effects fade in with the break-up and out again before the picture returns.
export function effectsAt(t,duration,{blur=0,push=0,shake=0,chroma=0,glitch=0,bloom=0,neon=0,glass=0,scan=0,grain=0,vignette=0,bokeh=0}={}){
 const clamp=x=>Math.max(0,Math.min(1,Number(x)||0));
 const active=smooth(.08,.30,t)*(1-smooth(.76,.94,t));
 const move=clamp(shake)*active,seconds=t*duration;
 return {blur:clamp(blur)*active,chroma:clamp(chroma)*active,glitch:clamp(glitch)*active,seconds,
 bloom:clamp(bloom)*active,neon:clamp(neon)*active,glass:clamp(glass)*active,bokeh:clamp(bokeh)*active,
 scan:clamp(scan),grain:clamp(grain),vignette:clamp(vignette),
 zoom:1+clamp(push)*1.1*smooth(.20,.68,t)*(1-smooth(.72,.94,t)),
 x:move*.065*(Math.sin(seconds*53)+.45*Math.sin(seconds*91)),
 y:move*.05*(Math.sin(seconds*67+.8)+.4*Math.sin(seconds*113)),
 roll:move*.009*Math.sin(seconds*47)};
}

const QUAD_VS='varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
const NOISE='float noise(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}';
const GAUSS=`uniform sampler2D uImage;uniform vec2 uStep;varying vec2 vUv;
 void main(){
  vec4 c=texture2D(uImage,vUv)*.227027;
  c+=(texture2D(uImage,vUv+uStep*1.384615)+texture2D(uImage,vUv-uStep*1.384615))*.316216;
  c+=(texture2D(uImage,vUv+uStep*3.230769)+texture2D(uImage,vUv-uStep*3.230769))*.0702705;
  gl_FragColor=c;
 }`;
// depth of field: gather along a golden-angle spiral; a neighbour counts if its own blur reaches this pixel
const DOF=`uniform sampler2D uImage,uDepth;uniform vec2 uTexel;uniform float uNear,uFar,uPersp,uFocus,uAmount;varying vec2 vUv;
 float viewZ(float d){return uPersp>.5?(uNear*uFar)/((uFar-uNear)*d-uFar):d*(uNear-uFar)-uNear;}
 float coc(vec2 p){float d=texture2D(uDepth,p).x;if(d>.9999)return 0.;return min(24.,abs(viewZ(d)-uFocus)*uAmount);}
 void main(){
  float c0=coc(vUv);vec4 acc=texture2D(uImage,vUv);float w=1.;
  // a random twist per pixel turns the spiral's pattern into fine noise instead of petal shapes
  float twist=fract(sin(dot(vUv,vec2(12.9898,78.233)))*43758.5453)*6.2832;
  for(int i=1;i<64;i++){
   float r=sqrt(float(i)/64.)*24.,a=float(i)*2.39996+twist;
   vec2 p=vUv+vec2(cos(a),sin(a))*r*uTexel;
   float cs=coc(p);
   float k=cs>=r-.5?1.:0.;   // gather only what actually spreads this far, so a blurred piece stays solid inside
   acc+=texture2D(uImage,p)*k;w+=k;
  }
  gl_FragColor=acc/w;
 }`;
// what glows: bright parts (bloom) and the picture's outlines (neon)
const BRIGHT=`uniform sampler2D uImage;uniform vec2 uTexel;uniform float uBloom,uNeon,uUseColor;uniform vec3 uNeonColor;varying vec2 vUv;
 float lum(vec3 c){return dot(c,vec3(.299,.587,.114));}
 void main(){
  vec3 c=texture2D(uImage,vUv).rgb;
  vec3 glow=max(c-vec3(.55),0.)*2.2*uBloom;
  if(uNeon>0.){
   float tl=lum(texture2D(uImage,vUv+uTexel*vec2(-1.,1.)).rgb),t=lum(texture2D(uImage,vUv+uTexel*vec2(0.,1.)).rgb),tr=lum(texture2D(uImage,vUv+uTexel).rgb);
   float l=lum(texture2D(uImage,vUv-uTexel*vec2(1.,0.)).rgb),r=lum(texture2D(uImage,vUv+uTexel*vec2(1.,0.)).rgb);
   float bl=lum(texture2D(uImage,vUv-uTexel).rgb),b=lum(texture2D(uImage,vUv-uTexel*vec2(0.,1.)).rgb),br=lum(texture2D(uImage,vUv+uTexel*vec2(1.,-1.)).rgb);
   float e=smoothstep(.08,.3,length(vec2(tr+2.*r+br-tl-2.*l-bl,tl+2.*t+tr-bl-2.*b-br)));
   vec3 hue=c/max(.08,max(c.r,max(c.g,c.b)));
   glow+=e*mix(hue,uNeonColor,uUseColor)*uNeon*1.6;
  }
  gl_FragColor=vec4(glow,1.);
 }`;
const FINAL=`uniform sampler2D uImage,uGlow;uniform vec2 uTexel,uRes;
 uniform float uChroma,uGlitch,uTime,uGlowAmt,uNeon,uScan,uGrain,uVignette,uUseColor;uniform vec3 uNeonColor;varying vec2 vUv;
 ${NOISE}
 float lum(vec3 c){return dot(c,vec3(.299,.587,.114));}
 void main(){
  vec2 cc=vUv-.5;
  vec2 uv=.5+cc*(1.+uScan*.06*dot(cc,cc)*4.);   // a hint of CRT curvature together with the scanlines
  float tick=floor(uTime*13.),band=floor(uv.y*38.);
  float burst=step(.72,noise(vec2(tick,19.)))*step(.72,noise(vec2(band,tick)));
  float shift=uGlitch*((noise(vec2(band,4.))-.5)*.014+burst*(noise(vec2(band,tick+31.))-.5)*.085);
  vec2 p=clamp(uv+vec2(shift,0.),0.,1.);
  vec4 c=texture2D(uImage,p);
  float split=uChroma*.008+uGlitch*(.0015+burst*.014);
  if(split>.00001){c.r=texture2D(uImage,clamp(p+vec2(split,0.),0.,1.)).r;c.b=texture2D(uImage,clamp(p-vec2(split,0.),0.,1.)).b;}
  // neon: the picture dims so its lit outlines carry it; the sharp line here, the soft glow from uGlow
  if(uNeon>0.){
   float tl=lum(texture2D(uImage,p+uTexel*vec2(-1.,1.)).rgb),t=lum(texture2D(uImage,p+uTexel*vec2(0.,1.)).rgb),tr=lum(texture2D(uImage,p+uTexel).rgb);
   float l=lum(texture2D(uImage,p-uTexel*vec2(1.,0.)).rgb),r=lum(texture2D(uImage,p+uTexel*vec2(1.,0.)).rgb);
   float bl=lum(texture2D(uImage,p-uTexel).rgb),b=lum(texture2D(uImage,p-uTexel*vec2(0.,1.)).rgb),br=lum(texture2D(uImage,p+uTexel*vec2(1.,-1.)).rgb);
   float e=smoothstep(.1,.32,length(vec2(tr+2.*r+br-tl-2.*l-bl,tl+2.*t+tr-bl-2.*b-br)));
   vec3 hue=c.rgb/max(.08,max(c.r,max(c.g,c.b)));
   c.rgb=c.rgb*(1.-.72*uNeon)+e*mix(hue,uNeonColor,uUseColor)*uNeon*1.1;
  }
  c.rgb+=texture2D(uGlow,p).rgb*uGlowAmt;
  if(uScan>0.){
   float line=.5+.5*sin(uv.y*uRes.y*3.14159/1.6);
   c.rgb*=1.-uScan*.38*line;
   c.rgb*=1.-uScan*.05*noise(vec2(tick,3.));
   c.rgb*=mix(vec3(1.),vec3(1.06,.97,1.02),uScan*step(.5,fract(uv.x*uRes.x/3.)));
   if(uv.x<0.||uv.x>1.||uv.y<0.||uv.y>1.)c.rgb=vec3(0.);
  }
  if(uGrain>0.)c.rgb+=(noise(uv*uRes+fract(uTime*7.31)*97.)-.5)*uGrain*.16;
  float v=max(uVignette,uScan*.5);
  if(v>0.)c.rgb*=1.-v*.85*smoothstep(.25,.85,length(cc*vec2(1.,.8))*1.25);
  gl_FragColor=c;
  #include <colorspace_fragment>
 }`;

// Post-processing shared by both modes: blur, depth of field, glow/neon, glitch & colour split, scanlines, grain, vignette.
export class SceneBlur{
 constructor(renderer){
  this.renderer=renderer;this.size=new THREE.Vector2();this.rt=null;
  this.scene=new THREE.Scene();this.camera=new THREE.Camera();
  const mat=(fs,uniforms)=>new THREE.ShaderMaterial({depthTest:false,depthWrite:false,uniforms,vertexShader:QUAD_VS,fragmentShader:fs});
  this.gauss=mat(GAUSS,{uImage:{value:null},uStep:{value:new THREE.Vector2()}});
  this.dof=mat(DOF,{uImage:{value:null},uDepth:{value:null},uTexel:{value:new THREE.Vector2()},uNear:{value:.1},uFar:{value:100},uPersp:{value:0},uFocus:{value:-10},uAmount:{value:0}});
  this.bright=mat(BRIGHT,{uImage:{value:null},uTexel:{value:new THREE.Vector2()},uBloom:{value:0},uNeon:{value:0},uUseColor:{value:0},uNeonColor:{value:new THREE.Color()}});
  this.final=mat(FINAL,{uImage:{value:null},uGlow:{value:null},uTexel:{value:new THREE.Vector2()},uRes:{value:new THREE.Vector2()},uChroma:{value:0},uGlitch:{value:0},uTime:{value:0},
   uGlowAmt:{value:0},uNeon:{value:0},uScan:{value:0},uGrain:{value:0},uVignette:{value:0},uUseColor:{value:0},uNeonColor:{value:new THREE.Color()}});
  this.quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.gauss);this.quad.frustumCulled=false;this.scene.add(this.quad);
 }
 pass(material,target){this.quad.material=material;this.renderer.setRenderTarget(target);this.renderer.render(this.scene,this.camera)}
 targets(w,h){
  if(this.rt&&this.rt.w===w&&this.rt.h===h)return this.rt;
  if(this.rt)for(const k of ['scene','a','b','g1','g2'])this.rt[k].dispose();
  const make=(a,b,depth)=>new THREE.WebGLRenderTarget(a,b,depth?{depthBuffer:true,depthTexture:new THREE.DepthTexture(a,b),type:THREE.HalfFloatType}:{depthBuffer:false,type:THREE.HalfFloatType});
  const hw=Math.max(1,w>>1),hh=Math.max(1,h>>1);
  this.rt={w,h,scene:make(w,h,true),a:make(w,h),b:make(w,h),g1:make(hw,hh),g2:make(hw,hh)};
  return this.rt;
 }
 // o: {bloom, neon, neonColor:'#rrggbb' or '' for the picture's own colours, scan, grain, vignette, bokeh}
 render(scene,camera,amount,glitch=0,chroma=0,time=0,o={}){
  const r=this.renderer,bloom=o.bloom||0,neon=o.neon||0,scan=o.scan||0,grain=o.grain||0,vig=o.vignette||0,bokeh=o.bokeh||0;
  if(amount<=0&&glitch<=0&&chroma<=0&&bloom<=0&&neon<=0&&scan<=0&&grain<=0&&vig<=0&&bokeh<=0){r.setRenderTarget(null);r.render(scene,camera);return}
  r.getDrawingBufferSize(this.size);const {x:w,y:h}=this.size,T=this.targets(w,h),px=Math.max(1,h/1080);
  r.setRenderTarget(T.scene);r.render(scene,camera);
  let src=T.scene;
  if(bokeh>0){
   const u=this.dof.uniforms;
   u.uImage.value=src.texture;u.uDepth.value=T.scene.depthTexture;u.uTexel.value.set(px/w,px/h);
   u.uNear.value=camera.near;u.uFar.value=camera.far;u.uPersp.value=camera.isPerspectiveCamera?1:0;
   u.uFocus.value=-camera.position.z;u.uAmount.value=bokeh*11;
   this.pass(this.dof,T.a);src=T.a;
  }
  if(amount>0){
   const g=this.gauss.uniforms,radius=amount*h*.0045,out=src===T.a?T.scene:T.a;
   g.uImage.value=src.texture;g.uStep.value.set(radius/w,0);this.pass(this.gauss,T.b);
   g.uImage.value=T.b.texture;g.uStep.value.set(0,radius/h);this.pass(this.gauss,out);src=out;
  }
  const useColor=o.neonColor?1:0,col=new THREE.Color(o.neonColor||'#ffffff').convertSRGBToLinear();
  const glowAmt=bloom+neon;
  if(glowAmt>0){
   const b=this.bright.uniforms;
   b.uImage.value=src.texture;b.uTexel.value.set(px/w,px/h);b.uBloom.value=bloom;b.uNeon.value=neon;b.uUseColor.value=useColor;b.uNeonColor.value.copy(col);
   this.pass(this.bright,T.g1);
   const g=this.gauss.uniforms;
   for(const s of [1.5,3.5]){
    g.uImage.value=T.g1.texture;g.uStep.value.set(s/T.g1.width,0);this.pass(this.gauss,T.g2);
    g.uImage.value=T.g2.texture;g.uStep.value.set(0,s/T.g1.height);this.pass(this.gauss,T.g1);
   }
  }
  const f=this.final.uniforms;
  f.uImage.value=src.texture;f.uGlow.value=T.g1.texture;f.uTexel.value.set(px/w,px/h);f.uRes.value.set(w,h);
  f.uChroma.value=chroma;f.uGlitch.value=glitch;f.uTime.value=time;f.uGlowAmt.value=glowAmt>0?1.3:0;f.uNeon.value=neon;
  f.uScan.value=scan;f.uGrain.value=grain;f.uVignette.value=vig;f.uUseColor.value=useColor;f.uNeonColor.value.copy(col);
  this.pass(this.final,null);
 }
 dispose(){if(this.rt)for(const k of ['scene','a','b','g1','g2'])this.rt[k].dispose();this.quad.geometry.dispose();[this.gauss,this.dof,this.bright,this.final].forEach(m=>m.dispose())}
}
