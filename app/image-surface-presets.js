// Image-surface shaders use the existing image worker; no external textures or physics steps.
import {IMAGE_RUNTIME} from './image-method-format.js';
import {burnThrough} from './image-surface-burn.js';
const noise=`
float hash21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float n=0.,a=.53;for(int i=0;i<4;i++){n+=a*noise2(p);p=p*2.03+vec2(7.1,3.7);a*=.48;}return n;}
vec4 photo(vec2 uv){uv=clamp(uv,vec2(.001),vec2(.999));return mix(texture2D(a,uv),texture2D(b,uv),mixImage);}
`;
const looks={
 ink:`
  // Three capillary fronts meet. The fine fringe stays attached to the paper grain.
  vec2 q=vUv*vec2(aspect,1.);
  float d=min(length(q-vec2(aspect*.24,.64)),min(length(q-vec2(aspect*.65,.35))*.95,length(q-vec2(aspect*.78,.8))*1.2));
  float grain=fbm(q*19.+seed),edge=d+(grain-.5)*.15-fx*.82;
  float wet=1.-smoothstep(-.012,.025,edge),fringe=exp(-abs(edge)*100.);
  vec3 dye=mix(vec3(.008,.026,.12),vec3(.015,.3,.34),fbm(q*3.+seed));
  vec3 stained=tex.rgb*mix(vec3(.1,.2,.34),vec3(.24,.48,.51),grain)+dye*.38;
  rgb=mix(tex.rgb,stained,wet*surfaceActive);
  rgb=mix(rgb,dye,fringe*.5*surfaceActive);
  float fibers=pow(noise2(q*vec2(260.,110.)),6.);
  rgb+=vec3(.1,.17,.19)*fibers*wet*surfaceActive;
 `,
 watercolor:`
  // Pigment separates into a moving watery wash; its edge collects darker pigment.
  vec2 q=vUv*vec2(aspect,1.);
  vec2 flow=vec2(fbm(q*4.+vec2(t*.13,seed)),fbm(q*4.+vec2(seed,-t*.16)))-.5;
  float d=length((vUv-vec2(.47,.53))*vec2(aspect,.85));
  float edge=d+(fbm(q*6.+flow)-.5)*.34-fx*1.25;
  float wet=1.-smoothstep(-.09,.2,edge);
  vec2 uv=vUv+flow*wet*fx*.22;
  vec3 pigment=(photo(uv).rgb*2.+photo(uv+vec2(.018,.005)*wet).rgb+photo(uv-vec2(.01,.023)*wet).rgb)*.25;
  float paper=noise2(q*280.);
  rgb=mix(tex.rgb,pigment*.78+vec3(.12,.16,.18),wet*surfaceActive);
  float pool=exp(-abs(edge-.025)*35.);
  rgb*=1.-pool*.45*surfaceActive;
  rgb+=vec3(.13,.19,.21)*exp(-abs(edge-.11)*65.)*surfaceActive;
  alpha*=mix(1.,smoothstep(-.14,.035,edge),surfaceActive);
  rgb+=paper*.025*wet*surfaceActive;
 `,
 frost:`
  // Voronoi facets form a frosted pane, with small six-pointed ice crystals.
  vec2 q=vUv*vec2(aspect,1.);
  float edge=length((vUv-vec2(.15,.13))*vec2(aspect,.8))+(fbm(q*11.+seed)-.5)*.16-fx*2.;
  float frozen=(1.-smoothstep(-.05,.05,edge))*surfaceActive;
  vec2 cell=q*18.,id=floor(cell),f=fract(cell);float d1=9.,d2=9.;vec2 near=vec2(0.);
  for(int y=-1;y<=1;y++){for(int x=-1;x<=1;x++){vec2 g=vec2(float(x),float(y));vec2 r=g+vec2(hash21(id+g+seed),hash21(id+g+12.+seed))-f;float d=dot(r,r);if(d<d1){d2=d1;d1=d;near=r;}else{d2=min(d2,d);}}}
  float cracks=1.-smoothstep(.015,.065,d2-d1);
  float theta=atan(near.y,near.x),radius=length(near);
  float star=pow(max(0.,cos(theta*6.)),22.)*(1.-smoothstep(.05,.42,radius));
  vec2 bend=near*.009*frozen;
  vec3 ice=photo(vUv+bend).rgb*vec3(.32,.68,.88)+vec3(.12,.25,.33);
  ice+=vec3(.25,.4,.46)*(cracks*.65+star*.85);
  ice+=pow(noise2(q*260.+seed),14.)*.22;
  rgb=mix(tex.rgb,ice,frozen);
  rgb+=vec3(.25,.5,.6)*exp(-abs(edge)*85.)*surfaceActive;
 `,
 electric:`
  // A jagged travelling arc consumes scanline fragments, with a forked discharge.
  float scan=floor(vUv.y*72.);
  float jitter=(hash21(vec2(scan,floor(t*18.)+seed))-.5)*.035;
  float path=(noise2(vec2(vUv.y*26.,t*3.+seed))-.5)*.07+sin(vUv.y*75.+t*9.)*.009;
  float front=-.18+fx*1.42,edge=vUv.x-front-path;
  float band=1.-smoothstep(.02,.16,abs(edge));
  vec2 uv=vUv+vec2(jitter*band*surfaceActive,0.);
  vec3 split=vec3(photo(uv+vec2(.006,0.)*band).r,photo(uv).g,photo(uv-vec2(.006,0.)*band).b);
  float fork=exp(-abs(edge-.025-abs(sin(vUv.y*9.+2.))*.08)*240.);
  float core=exp(-abs(edge)*440.),halo=exp(-abs(edge)*48.);
  float live=smoothstep(-.003,.007,edge);
  rgb=mix(tex.rgb,split,surfaceActive)*mix(1.,.88+.12*cos(vUv.y*900.),surfaceActive);
  rgb+=vec3(.24,.42,1.)*(halo*1.1+fork*.7)*surfaceActive+vec3(.7,.94,1.)*core*surfaceActive;
  alpha*=mix(1.,max(live,clamp((halo*.5+fork)*surfaceActive,0.,1.)),surfaceActive);
 `,
 acid:`
  // Separate reaction pits coalesce. Their rims fizz with tiny cell-sized bubbles.
  vec2 q=vUv*vec2(aspect,1.),cell=q*6.,id=floor(cell),f=fract(cell);float edge=9.;
  for(int y=-1;y<=1;y++){for(int x=-1;x<=1;x++){vec2 g=vec2(float(x),float(y)),c=id+g;vec2 pos=g+vec2(hash21(c+seed),hash21(c+37.+seed))*.7+.15;
    float delay=hash21(c+80.+seed)*.3;float radius=max(0.,fx-delay)*1.75;
    edge=min(edge,length(f-pos)-radius);
  }}
  edge+=(noise2(q*95.+vec2(t*.5,seed))-.5)*.05;
  float paper=smoothstep(-.018,.016,edge),rim=exp(-abs(edge-.05)*14.);
  float bubble=pow(.5+.5*sin(edge*85.-t*7.+noise2(q*30.)*6.),7.);
  vec3 corroded=mix(tex.rgb,vec3(.025,.065,.008),rim*.85*surfaceActive);
  rgb=corroded+vec3(.42,.75,.015)*rim*(.5+bubble*.5)*surfaceActive;
  rgb+=vec3(.55,.8,.12)*exp(-abs(edge)*90.)*surfaceActive;
  alpha*=mix(1.,max(paper,rim*.38*surfaceActive),surfaceActive);
 `,
 drip:`
  // Continuous rounded fingers pull the image down, preserving streaks from the source.
  float wave=.5+.5*sin(vUv.x*41.+sin(vUv.x*19.)*2.);
  float lanes=.13+.75*pow(wave,2.);
  float front=1.14-fx*1.5+lanes*fx*.62;
  float tip=front-vUv.y;
  float wet=1.-smoothstep(.04,.35,abs(tip));
  vec2 uv=vec2(vUv.x+(noise2(vec2(vUv.x*35.,vUv.y*3.)+seed)-.5)*fx*.012,vUv.y+fx*(.23+lanes*.38));
  vec3 paint=photo(uv).rgb;
  float lip=exp(-abs(tip-.013)*90.);
  rgb=mix(tex.rgb,paint,surfaceActive);
  rgb*=1.-wet*.18*surfaceActive;
  rgb+=vec3(.25,.22,.18)*lip*surfaceActive;
  alpha*=mix(1.,smoothstep(-.003,.01,tip),surfaceActive);
 `,
 weather:`
  // Fine fibers erode from the left. Separate image-colored grains travel with the wind.
  vec2 q=vUv*vec2(aspect,1.);
  float edge=vUv.x+(fbm(q*7.+seed)-.5)*.18-fx*1.35+.12;
  float dust=noise2(q*vec2(280.,190.)+seed);
  float boundary=smoothstep(-.018,.06,edge+(dust-.5)*.07);
  float brittle=(1.-smoothstep(.02,.19,edge))*surfaceActive;
  vec3 dry=vec3(dot(tex.rgb,vec3(.28,.53,.19)))*vec3(1.12,.96,.72);
  rgb=mix(tex.rgb,dry,brittle*.75);
  rgb*=1.-brittle*.22*(1.-dust);
  alpha*=mix(1.,boundary,surfaceActive);
 `
};
const windSetup=`
// Detached grains retain the image color. They use absolute time, so seeking is reproducible.
const COUNT=360, positions=new Float32Array(COUNT*3), life=new Float32Array(COUNT);
const uv=new Float32Array(COUNT*2), grainSize=new Float32Array(COUNT);
const grains=Array.from({length:COUNT},(_,i)=>{
 const x=random(),y=random();uv[i*2]=x;uv[i*2+1]=y;grainSize[i]=1.1+random()*2.2;
 return {x,y,speed:.35+random()*.65,phase:random(),lift:random()*.35};
});
const geometry=new THREE.BufferGeometry();
geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
geometry.setAttribute('life',new THREE.BufferAttribute(life,1));
geometry.setAttribute('photoUv',new THREE.BufferAttribute(uv,2));
geometry.setAttribute('grainSize',new THREE.BufferAttribute(grainSize,1));
const dustMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:false,
 uniforms:{a:material.uniforms.a,b:material.uniforms.b,mixImage:material.uniforms.mixImage,resolution:{value:1}},
 vertexShader:\`attribute float life,grainSize;attribute vec2 photoUv;varying vec2 vPhoto;varying float vLife;uniform float resolution;
 void main(){vPhoto=photoUv;vLife=life;gl_PointSize=grainSize*resolution;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}\`,
 fragmentShader:\`uniform sampler2D a,b;uniform float mixImage;varying vec2 vPhoto;varying float vLife;
 void main(){float d=length(gl_PointCoord-.5)*2.;vec4 c=mix(texture2D(a,vPhoto),texture2D(b,vPhoto),mixImage);gl_FragColor=vec4(c.rgb*1.3,max(0.,1.-d)*vLife*c.a);
 #include <colorspace_fragment>
 }\`});
const dust=new THREE.Points(geometry,dustMaterial);dust.frustumCulled=false;dust.renderOrder=2;root.add(dust);
`;
const windUpdate=`
    dust.visible=surfaceActive>0;dustMaterial.uniforms.resolution.value=frame.height/450;
    for(let i=0;i<COUNT;i++){
      const g=grains[i],age=(t*g.speed+g.phase)%1;
      const swept=smooth(g.x-.05,g.x+.08,fx*1.35-.12);
      positions[i*3]=(g.x-.5)*size.width+age*age*1.4;
      positions[i*3+1]=(g.y-.5)*size.height+Math.sin(age*4.+g.phase*6.)*.13+age*g.lift;
      positions[i*3+2]=.04;
      life[i]=Math.sin(age*Math.PI)*swept*surfaceActive*.95;
    }
    geometry.attributes.position.needsUpdate=true;geometry.attributes.life.needsUpdate=true;
`;
function surfaceSource(mode){
 const fragment=`uniform sampler2D a,b;uniform float mixImage,fx,t,aspect,surfaceActive,seed;varying vec2 vUv;
${noise}
void main(){vec4 tex=photo(vUv);vec3 rgb=tex.rgb;float alpha=tex.a;
${looks[mode]}
 gl_FragColor=vec4(rgb,alpha);
 #include <colorspace_fragment>
}`;
 return `// 工房・作品とも「立体化なし」で使用。下のSTRENGTHと色・数式を自由に編集できます。
const {THREE,createImagePlane,root,size,random,params}=api;
const STRENGTH=1; // 効果の強さ（0〜1）
const paper=createImagePlane(),material=paper.material;
Object.assign(material.uniforms,{fx:{value:0},t:{value:0},aspect:{value:size.width/size.height},surfaceActive:{value:0},seed:{value:params.seed*.17}});
material.depthWrite=false;
material.fragmentShader=\`${fragment}\`;
material.needsUpdate=true;
${mode==='weather'?windSetup:''}
const smooth=(a,b,x)=>{x=THREE.MathUtils.clamp((x-a)/(b-a),0,1);return x*x*(3-2*x)};
return {physicsTime:()=>0,update(frame){
 const p=frame.progress,t=frame.clipTime;
 const fx=smooth(.035,.64,p)*(1-smooth(.72,.98,p))*Math.min(1,frame.amount/.8)*THREE.MathUtils.clamp(STRENGTH,0,1);
 const surfaceActive=smooth(0,.06,fx);
 material.uniforms.fx.value=fx;material.uniforms.t.value=t;material.uniforms.surfaceActive.value=surfaceActive;
 ${mode==='weather'?windUpdate:''}
}};`;
}
const body=fn=>fn.toString().slice(fn.toString().indexOf('{')+1,fn.toString().lastIndexOf('}')).trim();
export const SURFACE_METHOD_PRESETS=[
 ['焦げ穴と炎','burn','🔥'],['インクのにじみ','ink','◉'],['水彩の溶け出し','watercolor','◌'],['凍結と霜','frost','❄'],
 ['電撃で消失','electric','ϟ'],['酸の侵食','acid','◍'],['絵の具が垂れる','drip','▥'],['紙が風化する','weather','⁙']
].map(([name,key,symbol])=>({name,symbol,key:'surface-'+key,thumbnail:'./assets/surface-previews/surface-'+key+'.jpg',previewShape:'none',code:{version:1,runtime:IMAGE_RUNTIME,
 source:key==='burn'?body(burnThrough):surfaceSource(key),params:{columns:12,gravity:0,bounce:.5,seed:7,returnMode:'reverse',label:'UNFOLD',font:'gothic'}}}));
