// Kept as a function so the editor receives a standalone, readable body.
export function burnThrough(api) {
// 画像JavaScript用。工房・本体とも「立体化なし」で使用してください。
// 焦げ穴 → 赤熱する縁・炎・火の粉 → 画像へ戻る。外部素材は不要です。
const {THREE, createImagePlane, root, size, random} = api;
const CENTER = new THREE.Vector2(0.5, 0.4); // 着火位置。0〜1、yは下から上。
const FIRE = 1.0; // 炎の強さ。0なら焦げ穴だけ。
const paper = createImagePlane();
const material = paper.material;
Object.assign(material.uniforms, {
  burnRadius: {value: -0.14}, burnTime: {value: 0},
  burnCenter: {value: CENTER}, burnAspect: {value: size.width / size.height},
  burnActive: {value: 0}, fireStrength: {value: FIRE}
});
material.depthWrite = false;
material.fragmentShader = `
uniform sampler2D a, b;
uniform float mixImage, burnRadius, burnTime, burnAspect, burnActive, fireStrength;
uniform vec2 burnCenter;
varying vec2 vUv;
float hash21(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise2(vec2 p) {
  vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash21(i),hash21(i+vec2(1.,0.)),f.x),
             mix(hash21(i+vec2(0.,1.)),hash21(i+vec2(1.,1.)),f.x),f.y);
}
float fbm(vec2 p) {
  float v=0., w=.53;
  for(int i=0;i<4;i++){v+=w*noise2(p);p=p*2.03+vec2(7.1,3.7);w*=.48;}
  return v;
}
float paperDistance(vec2 q) {
  return length(q)+(fbm(q*8.)-.5)*.12+(noise2(q*43.)-.5)*.025;
}
void main() {
  vec2 q=(vUv-burnCenter)*vec2(burnAspect,1.);
  float edge=paperDistance(q)-burnRadius;
  vec4 tex=mix(texture2D(a,vUv),texture2D(b,vUv),mixImage);
  float paperAlpha=smoothstep(-.003,.004,edge)*tex.a;
  float charcoal=(1.-smoothstep(.012,.075,edge))*burnActive;
  float grain=noise2(q*220.);
  vec3 paperRGB=mix(tex.rgb,vec3(.009,.004,.001)*(0.65+grain),charcoal);
  float flicker=.65+.35*noise2(vec2(q.x*57.+burnTime*3.,q.y*37.-burnTime*5.));
  float core=exp(-abs(edge-.002)*190.)*flicker;
  float height=.025+.055*fbm(vec2(q.x*36.,burnTime*2.));
  vec2 rising=q-vec2(.009*sin(q.y*35.+burnTime*4.),height);
  float flame=exp(-abs(paperDistance(rising)-burnRadius)*70.);
  flame*=pow(noise2(vec2(q.x*65.,q.y*22.-burnTime*3.)),1.25);
  flame*=1.-smoothstep(.08,.18,abs(edge));
  float fireAlpha=clamp((core+flame*.85)*fireStrength*burnActive,0.,1.);
  vec3 fireRGB=mix(vec3(1.,.045,.002),vec3(1.,.48,.055),clamp(core,0.,1.));
  float smoke=(1.-paperAlpha)*exp(-abs(edge+.09)*17.);
  smoke*=fbm(q*13.-vec2(0.,burnTime*.7))*.16*burnActive;
  float alpha=paperAlpha+(1.-paperAlpha)*smoke;
  vec3 rgb=paperRGB*paperAlpha+vec3(.045)*smoke*(1.-paperAlpha);
  rgb=rgb*(1.-fireAlpha)+fireRGB*fireAlpha;
  alpha=alpha+(1.-alpha)*fireAlpha;
  if(alpha<.002)discard;
  gl_FragColor=vec4(rgb/max(alpha,.001),alpha);
  #include <colorspace_fragment>
}`;
material.needsUpdate = true;

// 火の粉は絶対時刻から配置し、巻き戻しでも同じ結果にします。
const COUNT = 64, positions = new Float32Array(COUNT*3);
const opacity = new Float32Array(COUNT), scales = new Float32Array(COUNT);
const seeds = Array.from({length:COUNT},()=>({angle:random()*Math.PI*2,phase:random(),drift:(random()-.5)*.4,speed:.45+random()*.7}));
for(let i=0;i<COUNT;i++)scales[i]=1.2+random()*2.3;
const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
geometry.setAttribute('life',new THREE.BufferAttribute(opacity,1));
geometry.setAttribute('sparkSize',new THREE.BufferAttribute(scales,1));
const sparkMaterial = new THREE.ShaderMaterial({
  transparent:true, depthWrite:false, depthTest:false, blending:THREE.AdditiveBlending,
  uniforms:{resolutionScale:{value:1}},
  vertexShader:`attribute float life,sparkSize;uniform float resolutionScale;varying float vLife;
    void main(){vLife=life;gl_PointSize=sparkSize*resolutionScale;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`varying float vLife;void main(){float d=length(gl_PointCoord-.5)*2.;
    gl_FragColor=vec4(1.,.32,.015,pow(max(0.,1.-d),1.5)*vLife);
    #include <colorspace_fragment>
  }`
});
const sparks = new THREE.Points(geometry,sparkMaterial);
sparks.frustumCulled=false; sparks.renderOrder=2; root.add(sparks);
const smooth=(a,b,x)=>{x=THREE.MathUtils.clamp((x-a)/(b-a),0,1);return x*x*(3-2*x)};
const farthest=Math.hypot(Math.max(CENTER.x,1-CENTER.x)*size.width/size.height,Math.max(CENTER.y,1-CENTER.y));
return {
  physicsTime:()=>0,
  update(frame) {
    const p=frame.progress,t=frame.clipTime;
    const burn=smooth(.055,.62,p)*(1-smooth(.70,.98,p))*Math.min(1,frame.amount/.8);
    const radius=-.14+burn*(farthest+.24),active=smooth(.01,.08,burn);
    material.uniforms.burnRadius.value=radius;
    material.uniforms.burnTime.value=t;
    material.uniforms.burnActive.value=active;
    sparks.visible=active>0&&FIRE>0;
    sparkMaterial.uniforms.resolutionScale.value=frame.height/450;
    for(let i=0;i<COUNT;i++){
      const s=seeds[i],age=(t*s.speed+s.phase)%1;
      const r=Math.max(0,radius)*size.height;
      positions[i*3]=(CENTER.x-.5)*size.width+Math.cos(s.angle)*r+s.drift*age;
      positions[i*3+1]=(CENTER.y-.5)*size.height+Math.sin(s.angle)*r+age*age*.8;
      positions[i*3+2]=.03;
      opacity[i]=Math.sin(age*Math.PI)*active*.8*FIRE;
    }
    geometry.attributes.position.needsUpdate=true;
    geometry.attributes.life.needsUpdate=true;
  }
};

}
