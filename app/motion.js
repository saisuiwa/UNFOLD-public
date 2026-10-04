import { renderLookFragment } from './render-look.js?v=2';
export const smooth = (a,b,x) => {const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)};
export function motionAt(t){
  t=Math.max(0,Math.min(1,t));
  const restore=1-smooth(.70,.94,t);
  return {distort:smooth(.08,.30,t)*restore,form:smooth(.32,.53,t)*restore,turn:smooth(.48,.70,t)*Math.PI*1.7*restore,phase:t<.08?0:t<.32?1:t<.70?2:3};
}
export function exportRange(mode,customStart,duration){
 const starts={all:0,chaos:.30,solid:.56};
 const from=mode==='custom'?Math.min(.95,Math.max(0,Number(customStart)||0)):(starts[mode]??0);
 return {from,to:1,seconds:Math.max(0,Number(duration)||0)*(1-from)};
}
export const vertexShader = `
uniform float uDistort,uForm,uStrength,uDepth,uSeed,uMethod,uMethod2,uMethodMix,uShape,uPreset,uConceal,uProject,uTime,uThrough;
uniform vec2 uSize;
attribute vec2 cell;
attribute vec3 tcell;   // xy: centre of the tile this face moves with, z: how many tiles across (0 / missing = the 16x16 cell)
attribute vec3 targetPosition;
attribute vec4 part;   // xy: centre of this small quad in image uv, zw: this corner inside it (0/1) — one "particle"
varying vec2 vUv;
varying vec3 vPosition;
varying float vForm;
varying float vLookSeed,vLookAmount;
varying vec2 vPUv;
varying float vPMix,vPKind,vPAlt,vPAlpha,vPGlow;
// particle look chosen by the method: kind 0 none, 1 star/heart, 2 soft dot, 3 bubble, 4 sparkle, 5 halftone, 6 streak, 7 RGB glitch, 8 petal, 9 line drawing
float gKind,gAlpha,gGlow,gLocal;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7))+uSeed*2.17)*43758.5453);}
mat2 rot(float a){return mat2(cos(a),-sin(a),sin(a),cos(a));}
vec2 partC(){return (part.xy-.5)*uSize;}
vec2 unfoldTileC(){return tcell.z>.5?tcell.xy:cell;}
float unfoldTileN(){return tcell.z>.5?tcell.z:16.;}
float ph(float k){return hash(part.xy*113.+k);}
//@CUSTOM_FUNCTIONS
vec3 breakAt(float m,vec2 p,float amount){
  //@CUSTOM_DISPATCH
  vec2 q=p;
  float qz=0.;
  float n=hash(unfoldTileC());
  if(m<.5){
    q.x+=sin(p.y*5.+sin(p.x*3.+uSeed))*0.52*amount;
    q.y+=sin(p.x*5.7+cos(p.y*4.+uSeed))*0.48*amount;
    q*=1.-amount*.18;
  }else if(m<1.5){
    vec2 center=(unfoldTileC()-.5)*uSize;
    q=center+rot((n-.5)*6.28*amount)*(p-center)*(1.-amount*.2);
    q+=vec2(n-.5,hash(unfoldTileC()+5.)-.5)*2.0*amount;
  }else if(m<2.5){
    q=rot((length(p)*1.8+sin(p.y*3.+uSeed)*.6)*amount)*p;
    q*=1.-amount*.18;
  }else if(m<3.5){
    q.x+=sin(p.y*6.+uSeed)*amount*.6;
    q.y+=sin(p.x*5.+uSeed)*amount*.48;
  }else if(m<4.5){
    // shatter: tiles burst outward and tumble toward the camera
    vec2 center=(unfoldTileC()-.5)*uSize;
    vec2 l=rot((n-.5)*7.*amount)*(p-center)*(1.-amount*.25);
    float tilt=(hash(unfoldTileC()+3.)-.5)*5.*amount;
    q=center+vec2(l.x,l.y*cos(tilt));
    qz=l.y*sin(tilt)+(hash(unfoldTileC()+9.)-.3)*2.2*amount;
    q+=normalize(center+vec2(.001))*amount*(.4+n*.9)*(.5+length(center)*.45);
  }else if(m<5.5){
    // peel: the page rolls up from one corner like a sticker
    vec2 ax=normalize(vec2(1.,.42)),pe=vec2(-ax.y,ax.x);
    float s=dot(p,ax),t=dot(p,pe),edge=length(uSize)*.5;
    float x0=edge-amount*edge*1.9,R=.26+.14*amount;
    if(s>x0){
      float d=s-x0,ang=d/R;
      if(ang<3.14159){s=x0+R*sin(ang);qz=R*(1.-cos(ang));}
      else{s=x0-(d-3.14159*R);qz=2.*R;}
    }
    q=ax*s+pe*t;
  }else if(m<6.5){
    // melt: columns sag and drip at their own speed
    float col=floor(unfoldTileC().x*unfoldTileN());
    float sp=hash(vec2(col,3.));
    float fromTop=p.y/uSize.y+.5;
    q.y-=amount*(.35+sp*2.1)*(.3+.7*fromTop);
    q.x+=sin(p.y*4.+col+uSeed)*.07*amount;
    q.x*=1.-amount*.08;
  }else if(m<7.5){
    // fold: accordion pleats, like a paper fan closing
    float w=uSize.x/8.,ang=amount*1.2;
    float tri=abs(mod(p.x/w+8.,2.)-1.);
    float fx=p.x*cos(ang),fz=(tri-.5)*w*sin(ang)*1.4;
    // swing the pleated sheet sideways so the zigzag reads in an orthographic view
    float yaw=amount*.75;
    q.x=fx*cos(yaw)+fz*sin(yaw);
    q.y=p.y*(1.-amount*.08)+fz*.35*amount;
    qz=-fx*sin(yaw)+fz*cos(yaw);
  }else if(m<8.5){
    // shred: vertical strips slide apart and twist
    float col=floor(unfoldTileC().x*unfoldTileN());
    float sp=hash(vec2(col,7.));
    float stripC=(unfoldTileC().x-.5)*uSize.x,lx=p.x-stripC,ang=(sp-.5)*2.6*amount;
    q.x=stripC*(1.+.3*amount)+lx*cos(ang);
    q.y+=(mod(col,2.)<.5?1.:-1.)*amount*(.3+sp*1.1);
    qz=lx*sin(ang)+sin(p.y*2.5+col)*.2*amount;
  }else if(m<9.5){
    // mosaic: tiles shrink into blocks and pop forward at random depths
    vec2 center=(unfoldTileC()-.5)*uSize;
    q=center*(1.+amount*.12)+(p-center)*(1.-amount*.5);
    qz=n*n*2.4*amount;
  }else if(m<10.5){
    // vortex: everything is sucked into a spinning hole
    float r=length(p);
    q=rot(amount*3.4/(r+.35))*p*(1.-amount*.6*exp(-r*.5));
    qz=-amount*.9*exp(-r*r*.7);
  }else if(m<11.5){
    // confetti: each tile keeps its picture color while becoming a flying cutout
    vec2 center=(unfoldTileC()-.5)*uSize;
    float spin=(n-.5)*8.*amount;
    q=center+rot(spin)*(p-center)*(1.-amount*.12);
    q+=vec2(n-.5,hash(unfoldTileC()+5.)-.5)*2.8*amount;
    q.y-=amount*amount*(.25+hash(unfoldTileC()+vec2(3.,7.))*.85);
    qz=(hash(unfoldTileC()+9.)-.5)*1.8*amount;
    gKind=1.;
  }else if(m<12.5){
    // dust: grains blow off starting at the right edge, drifting up and thinning out
    vec2 c=partC(),l=p-c;
    float d=(.5-c.x/uSize.x)*.55+ph(1.)*.25;
    float e=smoothstep(d,d+.4,uDistort);
    q=c+l*(1.+e*.15)+vec2(.8+ph(2.)*1.6,.35+ph(3.)*.9)*e*uStrength*1.5;
    q.y+=sin(e*5.+ph(4.)*6.2832)*.12*e;
    qz=(ph(5.)-.5)*e*1.2;
    gKind=2.;gAlpha=1.-e*.3;gLocal=1.;
  }else if(m<13.5){
    // sparkle: the picture breaks into twinkling points of light
    vec2 c=partC(),l=p-c;
    q=c+l*(1.+amount*.6)+vec2(ph(1.)-.5,ph(2.)-.5)*.25*amount;
    qz=(ph(3.)-.5)*.6*amount;
    gKind=4.;gGlow=amount*(.35+.65*sin(uTime*(3.+ph(4.)*5.)+ph(5.)*6.2832))*.9;gLocal=1.;
  }else if(m<14.5){
    // burst: an explosion, fast then slowing, pieces flying at the camera
    vec2 c=partC(),l=p-c;
    float e=1.-pow(1.-uDistort,3.);
    vec2 dir=normalize(c+vec2(ph(1.)-.5,ph(2.)-.5)*.3+1e-4);
    q=c+rot((ph(3.)-.5)*9.*e)*l*(1.-e*.4)+dir*e*uStrength*(.8+ph(4.)*3.2);
    qz=ph(5.)*e*uStrength*3.;
    gLocal=1.;
  }else if(m<15.5){
    // swarm: particles circle the centre like a flock
    vec2 c=partC(),l=p-c;
    float r=length(c)+.001;
    float ang=atan(c.y,c.x)+amount*(1.2+ph(1.)*2.4)/(.4+r*.5)+uTime*(.6+ph(2.))*amount;
    float rr=r*(1.-.4*amount)+sin(uTime*1.7+ph(3.)*6.2832)*.25*amount;
    q=vec2(cos(ang),sin(ang)*(1.-.25*amount))*rr+l*(1.-amount*.2);
    qz=sin(ang)*rr*.6*amount;
    gKind=2.;gLocal=1.;
  }else if(m<16.5){
    // rain: pieces stretch into streaks and pour down
    vec2 c=partC(),l=p-c;
    float e=smoothstep(ph(1.)*.5,ph(1.)*.5+.5,uDistort);
    float fall=e*e*uStrength*(1.2+ph(2.)*2.4);
    q=c+vec2(l.x*(1.-.65*e),l.y*(1.+1.8*e))+vec2(-fall*.18,-fall);
    qz=(ph(3.)-.5)*.4*e;
    gKind=6.;gAlpha=1.-e*.35;gLocal=1.;
  }else if(m<17.5){
    // snow: soft flakes drifting down and swaying
    vec2 c=partC(),l=p-c;
    q=c+l*(1.+.2*amount)+vec2(sin(uTime*1.3+ph(1.)*6.2832+c.y*2.)*.18,-(.4+ph(2.)*1.1))*amount;
    qz=(ph(3.)-.5)*.8*amount;
    gKind=2.;gGlow=.22*amount;gLocal=1.;
  }else if(m<18.5){
    // bubbles: round bubbles wobble upward
    vec2 c=partC(),l=p-c;
    float e=smoothstep(ph(1.)*.4,ph(1.)*.4+.6,uDistort);
    q=c+l*(1.+e*(ph(2.)*.9-.1))+vec2(sin(uTime*2.+ph(3.)*6.2832+c.y*3.)*.14*e,e*uStrength*(.8+ph(4.)*1.8));
    qz=(ph(5.)-.3)*e;
    gKind=3.;gLocal=1.;
  }else if(m<19.5){
    // halftone: the picture turns into printed dots, darker = bigger
    vec2 c=partC(),l=p-c;
    q=c*(1.+amount*.05)+l;
    qz=(ph(1.)-.5)*.35*amount;
    gKind=5.;gLocal=1.;
  }else if(m<20.5){
    // ripple: rings spread from the centre like a drop in water
    float r=length(p);
    float w=sin(r*8.-uDistort*12.-uTime*2.*amount)*amount*exp(-r*.25);
    q=p*(1.+w*.06);
    qz=w*.45;
  }else if(m<21.5){
    // galaxy: particles gather into rotating spiral arms
    vec2 c=partC(),l=p-c;
    float t=pow(ph(2.),.7);
    float ang=floor(ph(1.)*3.)*2.0944+t*4.2+uTime*.35+(ph(3.)-.5)*.5;
    float rad=.15+t*2.3;
    vec2 g=vec2(cos(ang),sin(ang)*.5)*rad+vec2(ph(4.)-.5,ph(5.)-.5)*.18*(1.-t*.5);
    float e=smoothstep(0.,1.,uDistort);
    q=mix(c,g,e*min(1.,uStrength*1.25))+l*(1.-e*.3);
    qz=sin(ang)*rad*.55*e+(ph(6.)-.5)*.1*e;
    gKind=2.;gGlow=e*.35*(1.-t);gLocal=1.;
  }else if(m<22.5){
    // tornado: everything is lifted into a spinning funnel
    vec2 c=partC(),l=p-c;
    float h=(ph(1.)-.5)*uSize.y*.95;
    float ang=ph(2.)*6.2832+h*2.2+uTime*2.6;
    float rad=.18+(h/uSize.y+.5)*1.35;
    float e=smoothstep(0.,1.,uDistort)*min(1.,uStrength*1.25);
    q=mix(c,vec2(cos(ang)*rad,h),e)+l*(1.-.3*uDistort);
    qz=sin(ang)*rad*e;
    gLocal=1.;
  }else if(m<23.5){
    // wind: a gust sweeps from the left and blows the pieces away
    vec2 c=partC(),l=p-c;
    float d=(c.x/uSize.x+.5)*.5+ph(1.)*.2;
    float e=smoothstep(d,d+.35,uDistort);
    q=c+rot((ph(2.)-.5)*6.*e)*l*(1.-.45*e)+vec2(e*uStrength*(2.+ph(3.)*3.),sin(e*4.+ph(4.)*6.2832)*.45*e+(ph(5.)-.5)*.6*e);
    qz=(ph(6.)-.5)*1.5*e;
    gAlpha=1.-e*.4;gLocal=1.;
  }else if(m<24.5){
    // blinds: horizontal slats turn one after another
    float row=floor(unfoldTileC().y*unfoldTileN()),rc=(row+.5)/unfoldTileN()-.5;
    float y0=rc*uSize.y,ly=p.y-y0;
    float e=smoothstep((rc+.5)*.45,(rc+.5)*.45+.55,uDistort);
    float ang=e*1.45*min(1.,uStrength*1.25);
    q=vec2(p.x,y0+ly*cos(ang));
    qz=ly*sin(ang);
  }else if(m<25.5){
    // flip: tiles turn over like cards in a diagonal wave
    vec2 c0=(unfoldTileC()-.5)*uSize;
    float lx=p.x-c0.x,dN=(unfoldTileC().x+1.-unfoldTileC().y)*.5;
    float e=smoothstep(dN*.5,dN*.5+.5,uDistort);
    float ang=e*3.14159*min(1.,uStrength*1.25);
    q=vec2(c0.x+lx*cos(ang)*.94,c0.y+(p.y-c0.y)*.94);
    qz=lx*sin(ang)+sin(ang)*.25;
  }else if(m<26.5){
    // glitch: rows jump sideways in digital bursts with split colour
    float row=floor(unfoldTileC().y*unfoldTileN()),col=floor(unfoldTileC().x*unfoldTileN()),tk=floor(uTime*9.);
    float jump=step(.55,hash(vec2(row,tk)));
    q=p+vec2((hash(vec2(row,tk+3.))-.5)*1.6*jump+(hash(vec2(row,7.))-.5)*.5,0.)*amount;
    q+=step(.8,hash(vec2(col+row*unfoldTileN(),tk)))*vec2(hash(vec2(col,tk))-.5,hash(vec2(row,tk+9.))-.5)*.6*amount;
    gKind=7.;
  }else if(m<27.5){
    // petals: pieces become petals that flutter away on the breeze, tumbling as they fall
    vec2 c=partC(),l=p-c;
    float d=(c.x/uSize.x+.5)*.35+ph(1.)*.3;
    float e=smoothstep(d,d+.45,uDistort);
    float spin=e*(4.+ph(2.)*6.)+uTime*(1.+ph(3.)*2.)*e;
    vec2 ll=rot(spin)*(l*mix(vec2(1.),vec2(2.4,3.2),e));
    ll.x*=mix(1.,cos(spin*1.7+ph(4.)*6.2832),e);
    q=c+ll+vec2(e*uStrength*(1.4+ph(5.)*2.2),-e*e*uStrength*(.6+ph(6.)*1.4)+sin(e*6.+ph(7.)*6.2832+uTime*1.5)*.25*e);
    qz=(ph(8.)-.5)*1.4*e+sin(spin)*.2*e;
    gKind=8.;gLocal=1.;
  }else{
    // line: the picture is reduced to its outlines, which are erased — and drawn back in on the way out
    gKind=9.;
  }
  return vec3(q,qz);
}
void main(){
  float tile=floor(cell.y*16.)*16.+floor(cell.x*16.);
  float mixed=mod(tile*151.+floor(uSeed),256.);
  vec2 tileOrigin=vec2(mod(mixed,16.),floor(mixed/16.))/16.;
  vec2 shuffled=tileOrigin+(uv-(cell-vec2(.03125)));
  float lineA=step(27.5,uMethod)*step(uMethod,28.5),lineB=step(27.5,uMethod2)*step(uMethod2,28.5);
  vUv=mix(uv,shuffled,uConceal*(1.-mix(lineA,lineB,uMethodMix)));
  // flat solids (text, silhouettes) end up showing the picture straight through them, like a stencil
  vUv=mix(vUv,targetPosition.xy/uSize+.5,uProject*smoothstep(.5,.95,uForm));
  // the newer methods fold paper in depth, so they are shaded while they break too
  float shade=mix(step(3.5,uMethod),step(3.5,uMethod2),uMethodMix);
  vForm=max(uForm,uDistort*.9*shade);
  vec2 p=position.xy;
  float amount=uDistort*uStrength;
  // a second method can take over halfway (uMethodMix), e.g. shatter in, melt out
  gKind=0.;gAlpha=1.;gGlow=0.;gLocal=0.;
  vec3 broken=breakAt(uMethod,p,amount);
  float kind=gKind,alpha=gAlpha,glow=gGlow,local=gLocal,on1=step(.5,gKind),on2=0.;
  if(uMethodMix>.001){
    gKind=0.;gAlpha=1.;gGlow=0.;gLocal=0.;
    broken=mix(broken,breakAt(uMethod2,p,amount),uMethodMix);
    on2=step(.5,gKind);
    if(uMethodMix>.5){kind=gKind;local=gLocal;}
    alpha=mix(alpha,gAlpha,uMethodMix);glow=mix(glow,gGlow,uMethodMix);
  }
  // "pass through": the next picture arrives from the mirrored side instead of retracing the same path
  if(uThrough>.5)broken=vec3(2.*p-broken.xy,-broken.z);
  vec2 q=broken.xy;float qz=broken.z;
  // particle looks fade away as the picture becomes a solid
  vPMix=uDistort*(1.-uForm)*mix(on1,on2,uMethodMix);
  vPKind=kind;
  vLookAmount=max(uForm,uDistort);
  vLookSeed=hash((local>.5?part.xy:cell)*vec2(113.,157.));
  vPAlt=mod(floor(cell.x*16.)+floor(cell.y*16.),2.);
  vPUv=local>.5?part.zw:(uv-unfoldTileC())*unfoldTileN()+.5;
  vPAlpha=mix(1.,alpha,1.-uForm);
  vPGlow=glow*(1.-uForm);
  float a=(uv.x-.5)*6.2831853;
  float b=(uv.y-.5)*3.1415926;
  vec3 target;
  if(uShape<.5){
    target=vec3(sin(a)*cos(b),sin(b),cos(a)*cos(b))*1.55;
  }else if(uShape<1.5){
    float c=uv.y*6.2831853;
    target=vec3((1.30+.47*cos(c))*sin(a),.47*sin(c),(1.30+.47*cos(c))*cos(a));
  }else if(uShape<2.5){
    float c=uv.y*12.5663706;
    float r=.75+uv.x*.55;
    target=vec3(cos(c)*r,(uv.y-.5)*3.3,sin(c)*r);
  }else if(uShape<3.5){
    float r=1.18+.25*sin(a*3.+b*5.+uSeed)+.2*cos(a*7.-b*4.);
    target=vec3(sin(a)*cos(b),sin(b),cos(a)*cos(b))*r;
  }else if(uShape<4.5){
    vec3 d=vec3(sin(a)*cos(b),sin(b),cos(a)*cos(b));
    target=d/max(max(abs(d.x),abs(d.y)),abs(d.z))*1.12;
  }else if(uShape<5.5){
    // heart pillow
    vec2 h=vec2(16.*pow(sin(a),3.),13.*cos(a)-5.*cos(2.*a)-2.*cos(3.*a)-cos(4.*a))/17.;
    float s=cos(b);
    target=vec3(h.x*s,h.y*s+.12,sin(b)*.34)*1.75;
  }else if(uShape<6.5){
    // five-point star pillow
    float f=abs(fract(a/6.2831853*5.+.5)-.5)*2.;
    float r=mix(1.62,.66,f),s=cos(b);
    target=vec3(sin(a)*r*s,cos(a)*r*s,sin(b)*.42);
  }else if(uShape<7.5){
    // saturn: planet + tilted ring
    vec3 r3;
    if(uv.y<.62){float bb=(uv.y/.62-.5)*3.1415926;r3=vec3(sin(a)*cos(bb),sin(bb),cos(a)*cos(bb))*1.02;}
    else{float rr=1.42+(uv.y-.62)/.38*.9;r3=vec3(sin(a)*rr,0.,cos(a)*rr);}
    float tl=.42,tz=.3;
    r3=vec3(r3.x,r3.y*cos(tl)-r3.z*sin(tl),r3.y*sin(tl)+r3.z*cos(tl));
    target=vec3(r3.x*cos(tz)-r3.y*sin(tz),r3.x*sin(tz)+r3.y*cos(tz),r3.z);
  }else if(uShape<8.5){
    // mobius strip
    float u=uv.x*6.2831853,v=(uv.y-.5)*1.1;
    vec3 m=vec3((1.3+v*cos(u*.5))*cos(u),v*sin(u*.5),(1.3+v*cos(u*.5))*sin(u));
    float tl=.95;
    target=vec3(m.x,m.y*cos(tl)-m.z*sin(tl),m.y*sin(tl)+m.z*cos(tl));
  }else if(uShape<9.5){
    // diamond (stretched octahedron)
    vec3 d=vec3(sin(a)*cos(b),sin(b),cos(a)*cos(b));
    d/=abs(d.x)+abs(d.y)+abs(d.z);
    target=vec3(d.x,d.y*1.3,d.z)*1.75;
  }else{
    // six-petal flower pillow
    float r=.5+1.05*pow(abs(cos(a*3.)),.7),s=cos(b);
    target=vec3(sin(a)*r*s,cos(a)*r*s,sin(b)*.4+(1.-s)*.15);
  }
  // Keep the destination independent of deformation strength and method.
  // The timeline blends the scrambled plane into this clean surface.
  target=mix(target,targetPosition,uPreset);
  target.z*=uDepth;
  vec3 finalPosition=mix(vec3(q,qz),target,uForm);
  vec4 mv=modelViewMatrix*vec4(finalPosition,1.);
  vPosition=mv.xyz;
  gl_Position=projectionMatrix*mv;
}`;
// Shared by every fragment shader. The including shader defines vec4 texAt(vec2) before this block.
export const particleFragment = `
${renderLookFragment}
uniform float uDraw;   // line drawing: 1 = every stroke shown; falls while breaking, rises again as the next picture is drawn
uniform float uFade;   // brief dip that hides the hand-over in pass-through changes (1 = fully visible)
uniform float uGlass;  // glass look for tilted pieces and solids: refraction, cool tint, rim light and a sharp highlight
vec4 glassLook(vec4 c,vec3 n){
  if(uGlass<=0.)return c;
  n*=sign(n.z+1e-4);
  float fres=pow(1.-abs(n.z),2.);
  vec3 refr=texAt(vUv+n.xy*.035*uGlass).rgb;
  vec3 h=normalize(normalize(vec3(-.4,.65,1.))+vec3(0.,0.,1.));
  float spec=pow(max(0.,dot(n,h)),60.);
  vec3 g=mix(c.rgb,refr,.6)*vec3(.9,.97,1.05)+fres*vec3(.55,.75,.9)+spec*1.2;
  c.rgb=mix(c.rgb,g,uGlass);
  c.a*=mix(1.,.8+.2*fres,uGlass);
  return c;
}
varying vec2 vPUv;
varying float vPMix,vPKind,vPAlt,vPAlpha,vPGlow;
float confettiMask(vec2 uv,float kind){
  vec2 p=(uv-.5)*2.30;
  if(kind<.5){
    float angle=atan(p.y,p.x)+1.5707963;
    float spoke=abs(fract(angle*5./6.2831853)-.5)*2.;
    float radius=mix(.32,.92,spoke);
    return 1.-smoothstep(-.035,.035,length(p)-radius);
  }
  p=(uv-.5)*3.;p.y+=.12;
  float h=pow(p.x*p.x+p.y*p.y-1.,3.)-p.x*p.x*p.y*p.y*p.y;
  return 1.-smoothstep(-.06,.06,h);
}
float particleMask(vec2 uv,float kind,float alt,vec4 c){
  vec2 p=uv-.5;float r=length(p);
  if(kind<1.5)return confettiMask(uv,alt);
  if(kind<2.5)return 1.-smoothstep(.28,.5,r);
  if(kind<3.5)return min(1.,(1.-smoothstep(.44,.5,r))*(.3+.7*smoothstep(.3,.46,r)+.8*(1.-smoothstep(0.,.09,length(p-vec2(-.16,.16))))));
  if(kind<4.5){vec2 a=abs(p)*2.;float v=min(a.x,a.y)*2.2+max(a.x,a.y)*.4;return 1.-smoothstep(.3,.46,v);}
  if(kind<5.5){float lum=dot(c.rgb,vec3(.299,.587,.114));float rad=.06+.44*sqrt(max(0.,1.-lum));return 1.-smoothstep(rad-.05,rad+.05,r);}
  if(kind<6.5)return 1.-smoothstep(.2,.48,abs(p.x));
  if(kind<8.5){   // petal: a pointed oval with a small notch at the tip
    vec2 q=p*2.;float w=.62*sqrt(max(0.,1.-q.y*q.y))*(1.-.2*q.y);
    float body=1.-smoothstep(w-.08,w+.02,abs(q.x));
    return body*smoothstep(.16,.24,length(q-vec2(0.,1.02)));
  }
  return 1.;
}
float vnoise(vec2 p){
  vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  float a=fract(sin(dot(i,vec2(127.1,311.7)))*43758.5453),b=fract(sin(dot(i+vec2(1.,0.),vec2(127.1,311.7)))*43758.5453);
  float c=fract(sin(dot(i+vec2(0.,1.),vec2(127.1,311.7)))*43758.5453),d=fract(sin(dot(i+vec2(1.,1.),vec2(127.1,311.7)))*43758.5453);
  return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
}
float lum(vec4 c){return dot(c.rgb,vec3(.299,.587,.114));}
vec2 gD;
// luminance softened over a few pixels so paper grain and noise do not turn into lines
float lumB(vec2 uv){return .25*(lum(texAt(uv+gD*vec2(.5,.5)))+lum(texAt(uv+gD*vec2(-.5,.5)))+lum(texAt(uv+gD*vec2(.5,-.5)))+lum(texAt(uv-gD*.5)));}
vec4 lineDrawing(vec4 c,float k){
  // Sobel outlines of the picture, revealed along a wandering left-to-right order like a pen at work
  vec2 d=max(abs(dFdx(vUv)),abs(dFdy(vUv)))*1.8;gD=d*1.5;
  float tl=lumB(vUv+vec2(-d.x,d.y)),t=lumB(vUv+vec2(0.,d.y)),tr=lumB(vUv+d);
  float l=lumB(vUv-vec2(d.x,0.)),r=lumB(vUv+vec2(d.x,0.));
  float bl=lumB(vUv-d),b=lumB(vUv-vec2(0.,d.y)),br=lumB(vUv+vec2(d.x,-d.y));
  float gx=tr+2.*r+br-tl-2.*l-bl,gy=tl+2.*t+tr-bl-2.*b-br;
  float line=smoothstep(.16,.38,length(vec2(gx,gy)));
  float order=vnoise(vUv*vec2(5.,3.))*.45+vUv.x*.55;
  float drawn=uDraw;
  float shown=step(order,drawn*1.02);
  float pen=(1.-smoothstep(0.,.018,abs(order-drawn)))*step(.02,drawn)*step(drawn,.98);
  float fill=1.-smoothstep(0.,.3,k);
  vec3 ink=mix(c.rgb,vec3(1.),.35);
  vec3 col=mix(ink,c.rgb,fill)+pen*line*.8;
  float a=max(fill,line*shown);
  return vec4(col,c.a*a);
}
vec4 particleLook(vec4 c){
  float k=smoothstep(.02,.55,vPMix);
  if(vPKind>.5&&k>0.){
    if(vPKind>8.5)c=lineDrawing(c,vPMix);
    else if(vPKind>7.5){c.a*=mix(1.,particleMask(vPUv,vPKind,vPAlt,c),k);c.rgb=mix(c.rgb,c.rgb*vec3(1.,.8,.88)+vec3(.2,.06,.1),.45*k);}
    else if(vPKind>6.5){float s=.012*k;c.r=texAt(vUv+vec2(s,0.)).r;c.b=texAt(vUv-vec2(s,0.)).b;}
    else c.a*=mix(1.,particleMask(vPUv,vPKind,vPAlt,c),k);
  }
  c.a*=vPAlpha*uFade;
  c.rgb+=(vec3(1.)-c.rgb)*vPGlow;
  return c;
}`;
export const fragmentShader=`
uniform sampler2D uImage;
varying vec2 vUv;
varying vec3 vPosition;
varying float vForm;
vec4 texAt(vec2 uv){return texture2D(uImage,uv);}
${particleFragment}
void main(){
  vec4 c=particleLook(texAt(vUv));
  if(c.a<0.01)discard;
  vec3 normal=normalize(cross(dFdx(vPosition),dFdy(vPosition)));
  c=glassLook(c,normal);
  float light=surfaceLight(normal);
  c.rgb*=mix(1.,light,vForm);
  gl_FragColor=surfaceAlpha(c);
  #include <colorspace_fragment>
}`;
