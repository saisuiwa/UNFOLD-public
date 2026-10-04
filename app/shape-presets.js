// Parametric surface patches, paired one-to-one with original image tiles.
// Every preset uses the same source plane topology, so restoration loses no UVs.
const sphere=(c,s,r=[0,0,0])=>({kind:'sphere',c,s,r});
function limb(a,b,width,depth=width){
 const d=b.map((v,i)=>v-a[i]);const length=Math.hypot(...d);
 const y=d.map(v=>v/length);const ref=Math.abs(y[2])<.9?[0,0,1]:[1,0,0];
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 let x=cross(y,ref);const n=Math.hypot(...x);x=x.map(v=>v/n);const z=cross(x,y);
 return {...sphere(a.map((v,i)=>(v+b[i])/2),[width,length/2+width*.3,depth]),basis:[x,y,z]};
}
// Scales a whole figure (every part together, so nothing is distorted) to fit inside w x h and puts its middle at the origin. Sampled on the parts' surfaces.
function fit(parts,w,h){
 let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;
 for(const q of parts)for(let a=0;a<=12;a++)for(let b=0;b<=6;b++){const t=surface(q,a/12,b/6);x0=Math.min(x0,t[0]);x1=Math.max(x1,t[0]);y0=Math.min(y0,t[1]);y1=Math.max(y1,t[1]);}
 const k=Math.min(w/(x1-x0),h/(y1-y0)),mx=(x0+x1)/2,my=(y0+y1)/2;
 return parts.map(q=>({...q,s:q.s.map(v=>v*k),c:[(q.c[0]-mx)*k,(q.c[1]-my)*k,q.c[2]*k]}));
}
// A person (A-pose), about 7.5 heads tall. The picture is laid on in "ordered" mode (see OPTS), so the face lands on the head.
function human(){
 const p=[sphere([0,1.47,0],[.20,.25,.21]),limb([0,1.31,0],[0,1.08,0],.075,.075),
  sphere([0,.76,0],[.37,.44,.22]),sphere([0,.27,0],[.28,.30,.20]),sphere([0,-.08,0],[.34,.22,.22])];
 for(const s of [-1,1]){
  p.push(sphere([s*.42,.99,0],[.13,.13,.13]),limb([s*.44,.95,0],[s*.62,.38,0],.10,.09),limb([s*.62,.38,0],[s*.74,-.14,.05],.08,.075),sphere([s*.76,-.27,.05],[.07,.11,.04]));
  p.push(limb([s*.17,-.15,0],[s*.24,-.85,0],.15,.14),limb([s*.24,-.85,0],[s*.26,-1.52,0],.10,.10),sphere([s*.27,-1.62,.11],[.10,.07,.20]));
 }
 return fit(p,3.4,2.85);
}
// A winged horse in a gallop, facing right: a big feathered wing raised behind the shoulders.
function pegasus(){
 const p=[sphere([0,.10,0],[.95,.45,.38]),sphere([.62,.16,0],[.50,.48,.36]),sphere([-.66,.16,0],[.50,.48,.38]),
  limb([.78,.34,0],[1.26,1.0,0],.22,.20),sphere([1.45,1.11,0],[.36,.21,.19],[0,0,.35]),sphere([1.80,.97,0],[.22,.14,.13],[0,0,.35])];
 for(const z of [-.09,.09])p.push(limb([1.32,1.26,z],[1.30,1.58,z*1.4],.06,.045));
 for(let i=0;i<6;i++){const f=i/5;p.push(sphere([1.12-f*.55,1.02-f*.42,0],[.11,.16,.10],[0,0,.7]))}
 p.push(limb([-1.05,.38,0],[-1.55,-.05,0],.15,.12),limb([-1.55,-.05,0],[-1.8,-.62,0],.12,.09));
 for(const z of [-.2,.2]){
  p.push(limb([.62,-.25,z],[.98,-.62,z],.11,.10),limb([.98,-.62,z],[.84,-1.08,z],.07,.065),sphere([.83,-1.13,z],[.10,.06,.10]));   // bent front legs
  p.push(limb([-.66,-.25,z],[-.52,-.80,z],.12,.11),limb([-.52,-.80,z],[-.80,-1.34,z],.07,.065),sphere([-.80,-1.40,z],[.10,.06,.10]));
 }
 for(const side of [-1,1]){
  p.push(sphere([-.08,.60,side*.30],[.30,.26,.18]));
  for(let i=0;i<8;i++){const f=i/7,a=(100+f*82)*Math.PI/180,len=1.25+.6*Math.sin(f*Math.PI)-.2*f;   // feathers fan out from the shoulder, each one wide and overlapping
   p.push(limb([-.08,.62,side*.30],[-.08+Math.cos(a)*len,.62+Math.sin(a)*len,side*(.42+.5*len/1.7)],.15,.05));}
 }
 return fit(p,4.7,2.9);
}
// Whale (facing right) with a raised V tail and a spout.
function whale(){
 const p=[sphere([.15,0,0],[1.55,.66,.62]),sphere([1.35,-.04,0],[.78,.52,.52]),sphere([1.55,-.30,0],[.75,.22,.40]),sphere([-.2,-.28,0],[1.35,.40,.55]),
  limb([-1.15,.08,0],[-1.8,.28,0],.42,.34),limb([-1.7,.25,0],[-2.25,.58,0],.26,.20),
  limb([-2.2,.55,0],[-2.58,1.18,0],.22,.07),limb([-2.2,.55,0],[-1.82,1.15,0],.22,.07),limb([-.65,.58,0],[-.88,.95,0],.15,.06),
  sphere([1.0,.80,0],[.07,.10,.07]),sphere([1.0,1.05,0],[.08,.11,.08]),sphere([.80,1.2,0],[.09,.09,.08]),sphere([1.2,1.2,0],[.09,.09,.08]),sphere([1.0,1.34,0],[.10,.10,.09])];
 for(const z of [-1,1])p.push(limb([.55,-.42,z*.5],[-.05,-1.05,z*.78],.2,.06));
 return fit(p,4.9,2.7);
}
// Eastern dragon: an S-shaped body that rises into a big horned head with a mane and whiskers, four clawed legs, a ridge of spines.
function dragon(){
 const N=20,pt=t=>[1.45-3.8*t,.62*Math.sin(Math.PI*2.6*t+1.0)-.12+.35*(1-t)],rad=t=>.44-.30*t;
 const pts=[],r=[];for(let i=0;i<=N;i++){pts.push([...pt(i/N),0]);r.push(rad(i/N))}
 const p=[];for(let i=0;i<N;i++)p.push(limb(pts[i],pts[i+1],(r[i]+r[i+1])/2,(r[i]+r[i+1])/2*.95));
 const h=pts[0];
 p.push(sphere([h[0]+.14,h[1]+.02,0],[.52,.42,.40]),sphere([h[0]+.74,h[1]-.04,0],[.50,.24,.26]),sphere([h[0]+.70,h[1]-.28,0],[.46,.10,.22]),
  sphere([h[0]+.22,h[1]+.36,0],[.22,.12,.30]),sphere([h[0]-.22,h[1]+.12,0],[.34,.44,.34]));
 for(const z of [-1,1]){
  p.push(limb([h[0]+.0,h[1]+.40,z*.15],[h[0]-.62,h[1]+.86,z*.28],.10,.08),limb([h[0]-.62,h[1]+.86,z*.28],[h[0]-1.2,h[1]+.86,z*.34],.06,.05),
   limb([h[0]+.85,h[1]-.02,z*.14],[h[0]+1.5,h[1]-.55,z*.46],.04,.035),limb([h[0]+.8,h[1]-.10,z*.12],[h[0]+1.4,h[1]+.28,z*.46],.035,.03));
  p.push(sphere([h[0]+.28,h[1]+.18,z*.2],[.09,.07,.07]));
 }
 for(let i=0;i<7;i++){const a=pts[i+1];p.push(sphere([a[0]-.08,a[1]+r[i+1]+.06,0],[.10,.2-.012*i,.07]))}   // mane
 for(const [k,dx] of [[5,.14],[13,-.10]])for(const z of [-1,1]){
  const a=pts[k],b=[a[0]+dx*1.3,a[1]-.58,z*.26],c=[b[0]+dx,b[1]-.50,z*.30];
  p.push(limb([a[0],a[1]-r[k]*.6,z*.16],b,.10,.09),limb(b,c,.07,.065),sphere([c[0]+.03,c[1]-.04,c[2]],[.13,.06,.09]));
  for(const d of [-1,0,1])p.push(limb([c[0]+.03,c[1]-.03,c[2]],[c[0]+.16,c[1]-.14,c[2]+d*.07],.025,.02));
 }
 for(let i=9;i<N;i++){const a=pts[i];p.push(sphere([a[0],a[1]+r[i]+.04,0],[.045,.12,.035]))}
 const e=pts[N];p.push(sphere([e[0]-.20,e[1]-.08,0],[.32,.15,.05]),sphere([e[0]-.45,e[1]+.1,0],[.2,.1,.04],[0,0,.5]));
 return fit(p,5.0,2.75);
}
// A flock: 14 birds flying toward you, scattered over a 16:9 field (5 + 4 + 5), wings at different moments of the beat.
function flock(){
 const p=[];
 // x, y, depth, size, wing beat (-1 = down … 1 = up)
 const B=[[-2.0,.85,.2,.80,.9],[-1.0,1.05,-.3,.72,-.6],[.1,.95,.4,.84,.3],[1.1,1.1,-.2,.74,1],[2.0,.7,.1,.78,-.9],
  [-1.5,-.02,-.4,.78,.2],[-.5,.12,.3,.88,-.8],[.6,-.04,-.3,.76,.7],[1.55,.04,.45,.80,-.2],
  [-2.1,-.95,.3,.74,-.5],[-1.05,-1.05,-.2,.84,.8],[.05,-.9,.5,.76,-1],[1.0,-1.1,-.4,.82,.4],[2.0,-.9,.2,.74,1]];
 for(const [cx,cy,cz,s,f] of B){
  p.push(sphere([cx,cy,cz],[.11*s,.10*s,.24*s]),sphere([cx,cy+.02*s,cz+.22*s],[.075*s,.07*s,.08*s]),sphere([cx,cy+.0,cz+.32*s],[.025*s,.02*s,.05*s]),limb([cx,cy,cz-.16*s],[cx,cy-.04*s,cz-.40*s],.09*s,.03*s));
  for(const side of [-1,1]){
   const m=[cx+side*.30*s,cy+(.13+.17*f)*s,cz-.05*s],tip=[cx+side*.58*s,cy+(.0+.30*f)*s,cz-.13*s];
   p.push(limb([cx+side*.06*s,cy+.02*s,cz],m,.10*s,.035*s),limb(m,tip,.085*s,.03*s));
  }
 }
 return p;
}
// Balls: 16 x 9 of them, the shape of a 16:9 screen, in a gentle wave.
function spheres(){
 const p=[],nx=16,ny=9,d=.30,r=.138;
 for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)p.push(sphere([(i-(nx-1)/2)*d,(j-(ny-1)/2)*d,.22*Math.sin(i*.55+.6)*Math.cos(j*.7)],[r,r,r]));
 return p;
}
const recipes={human,pegasus,whale,dragon,flock,spheres,apple:()=>[
 {...sphere([0,-.05,0],[1.12,1.03,1.02]),kind:'apple'},
 limb([0,.77,0],[.12,1.32,0],.065),sphere([.43,1.20,0],[.40,.075,.17],[0,0,.40])
],icecream:()=>[
 {kind:'cone',c:[0,-.78,0],s:[.70,1.58,.70],r:[0,0,0]},
 sphere([0,.38,0],[.86,.76,.86]),sphere([0,1.00,0],[.62,.42,.62]),sphere([.0,1.42,0],[.14,.14,.14])
]};
export const presetNames=Object.keys(recipes);
// ordered: the picture is laid onto the shape by position (tile rows from the bottom up, left to right across the patches) so the shape shows the
// picture the way a printed texture would; the older presets (apple, ice cream) keep the scattered layout. min: fewest tiles a part gets.
const OPTS={human:{ordered:true},pegasus:{ordered:true},whale:{ordered:true,min:1},dragon:{ordered:true,min:1},flock:{ordered:true},spheres:{ordered:true,min:1}};
function rotate(p,r){
 let [x,y,z]=p;let c=Math.cos(r[0]),s=Math.sin(r[0]);[y,z]=[y*c-z*s,y*s+z*c];c=Math.cos(r[1]);s=Math.sin(r[1]);[x,z]=[x*c+z*s,-x*s+z*c];c=Math.cos(r[2]);s=Math.sin(r[2]);return [x*c-y*s,x*s+y*c,z];
}
function surface(part,u,v){
 const a=u*Math.PI*2,b=(v-.5)*Math.PI;let p;
 if(part.kind==='cone')p=[Math.cos(a)*part.s[0]*v,(v-.5)*part.s[1],Math.sin(a)*part.s[2]*v];
 else {
  let radius=1;
  // Broad shoulders and a narrower base; subtle lobes near the ends only.
  // Strong equatorial lobes made the previous apple look pentagonal from above.
  if(part.kind==='apple')radius=1+.10*Math.sin(b)+.012*Math.cos(a*5)*Math.pow(Math.sin(b),2);
  p=[Math.cos(a)*Math.cos(b)*part.s[0]*radius,Math.sin(b)*part.s[1],Math.sin(a)*Math.cos(b)*part.s[2]*radius];
  if(part.kind==='apple')p[1]+=-.20*Math.exp(-Math.pow((v-1)*10,2))+.08*Math.exp(-Math.pow(v*12,2));
 }
 if(part.basis){const [x,y,z]=part.basis;p=p.map((_,i)=>x[i]*p[0]+y[i]*p[1]+z[i]*p[2])}else p=rotate(p,part.r);
 return p.map((v,i)=>v+part.c[i]);
}
export function presetTargets(name,tiles=16,sub=5){
 const parts=recipes[name]?.();const total=tiles*tiles;
 const result=new Float32Array(total*sub*sub*6*3);
 if(!parts)return result;
 const weights=parts.map(p=>{const [x,y,z]=p.s;return (x*y+y*z+z*x)}),sum=weights.reduce((a,b)=>a+b,0);
 const opt=OPTS[name]||{},min=opt.min??2;
 const counts=parts.map(()=>min);let remaining=total-min*parts.length;
 const extra=weights.map(w=>Math.floor(w/sum*remaining));extra.forEach((n,i)=>counts[i]+=n);
 let left=total-counts.reduce((a,b)=>a+b,0);
 if(opt.ordered){const n=counts.length;for(let i=0;i<n;i++)counts[i]+=Math.floor((i+1)*left/n)-Math.floor(i*left/n);}   // the rest spread evenly
 else for(let i=0;left>0;i++,left--)counts[i%counts.length]++;
 const patches=[];
 parts.forEach((part,index)=>{
  const n=counts[index],rows=Math.max(1,Math.round(Math.sqrt(n)));let pending=n;
  for(let row=0;row<rows;row++){const cols=Math.ceil(pending/(rows-row));pending-=cols;for(let col=0;col<cols;col++)patches.push({part,u0:col/cols,du:1/cols,v0:row/rows,dv:1/rows})}
 });
 let pick=tile=>patches[(tile*73+19)%total];
 if(opt.ordered){
  const keyed=patches.map(pt=>{const c=surface(pt.part,pt.u0+pt.du/2,pt.v0+pt.dv/2);return {pt,x:c[0],y:c[1]}}).sort((a,b)=>a.y-b.y);
  const ord=[];for(let r=0;r<tiles;r++)for(const q of keyed.slice(r*tiles,(r+1)*tiles).sort((a,b)=>a.x-b.x))ord.push(q.pt);
  pick=tile=>ord[tile];
 }
 let k=0;
 for(let tile=0;tile<total;tile++){
  // Odd multiplier permutes the 256 tiles without repeats, hiding their original layout.
  const patch=pick(tile);
  for(let sy=0;sy<sub;sy++)for(let sx=0;sx<sub;sx++)for(const [dx,dy] of [[0,0],[1,0],[0,1],[1,0],[1,1],[0,1]]){
   const p=surface(patch.part,patch.u0+(sx+dx)/sub*patch.du,patch.v0+(sy+dy)/sub*patch.dv);
   result.set(p,k);k+=3;
  }
 }
 return result;
}
