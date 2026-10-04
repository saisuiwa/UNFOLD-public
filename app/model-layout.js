// Preserve every input triangle. Split edges only to fit a complete image atlas.
export const MAX_MODEL_TRIANGLES=1000000;
// opts.ordered: lay the picture on by position (tile rows from the bottom up, left to right in each row) instead of in the order the triangles come in,
// so the model shows the picture the way a printed texture would. Off (the default) = as before.
export function modelLayout(input,opts={}){
 if(!input.length||input.length%9)throw new Error('三角形の形状を読み取れませんでした。');
 const triangles=[];const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
 for(let i=0;i<input.length;i+=9){const t=Array.from(input.slice(i,i+9));
  if(t.some(v=>!Number.isFinite(v)))throw new Error('モデルの座標が不正です。');
  for(let j=0;j<9;j++){lo[j%3]=Math.min(lo[j%3],t[j]);hi[j%3]=Math.max(hi[j%3],t[j])}triangles.push(t);
 }
 if(triangles.length>MAX_MODEL_TRIANGLES)throw new Error('三角形100万枚以下に軽量化したGLBを選んでね。');
 const extent=Math.max(...hi.map((v,i)=>v-lo[i]));
 if(extent<1e-8)throw new Error('大きさのある立体が見つかりませんでした。');
 const center=lo.map((v,i)=>(v+hi[i])/2),scale=3.5/extent;
 for(const t of triangles)for(let j=0;j<9;j++)t[j]=(t[j]-center[j%3])*scale;
 const targetCount=Math.max(4096,Math.ceil(triangles.length/512)*512);
 // Split the largest triangles first, leaving the imported silhouette intact.
 const size=t=>{const a=t.slice(3,6).map((v,i)=>v-t[i]),b=t.slice(6,9).map((v,i)=>v-t[i]);return Math.hypot(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])};
 const heap=[];
 function push(t){const n={t,s:size(t)};let i=heap.length;heap.push(n);while(i){const p=(i-1)>>1;if(heap[p].s>=n.s)break;heap[i]=heap[p];i=p}heap[i]=n}
 function pop(){const top=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].s>heap[c].s)c++;if(heap[c].s<=last.s)break;heap[i]=heap[c];i=c}heap[i]=last}return top.t}
 triangles.forEach(push);
 while(heap.length<targetCount){const t=pop(),v=[t.slice(0,3),t.slice(3,6),t.slice(6,9)];
  const edge=[0,1,2].map(i=>v[i].reduce((s,x,k)=>s+(x-v[(i+1)%3][k])**2,0));let i=edge.indexOf(Math.max(...edge)),a=v[i],b=v[(i+1)%3],c=v[(i+2)%3],m=a.map((x,k)=>(x+b[k])/2);
  push([...a,...m,...c]);push([...m,...b,...c]);
 }
 let order=heap.map(n=>n.t);
 if(opts.ordered){   // equal numbers of triangles in 16 bands from the bottom (by height), each band left to right
  const keyed=order.map(t=>({t,x:(t[0]+t[3]+t[6])/3,y:(t[1]+t[4]+t[7])/3})).sort((a,b)=>a.y-b.y),band=targetCount/16;
  order=[];for(let r=0;r<16;r++)for(const q of keyed.slice(r*band,(r+1)*band).sort((a,b)=>a.x-b.x))order.push(q.t);
 }
 const target=new Float32Array(targetCount*9),uv=new Float32Array(targetCount*6),cell=new Float32Array(targetCount*6),part=new Float32Array(targetCount*12);
 const quads=targetCount/512,rows=Math.max(1,Math.round(Math.sqrt(quads)));
 let k=0;
 for(let tile=0;tile<256;tile++){let pending=quads;
  for(let row=0;row<rows;row++){const cols=Math.ceil(pending/(rows-row));pending-=cols;
   for(let col=0;col<cols;col++)for(const corners of [[[0,0],[1,0],[0,1]],[[1,0],[1,1],[0,1]]]){
    target.set(order[k],k*9);
    for(let j=0;j<3;j++){const [dx,dy]=corners[j];uv[k*6+j*2]=((tile%16)+(col+dx)/cols)/16;uv[k*6+j*2+1]=(Math.floor(tile/16)+(row+dy)/rows)/16;cell[k*6+j*2]=((tile%16)+.5)/16;cell[k*6+j*2+1]=(Math.floor(tile/16)+.5)/16;
     // each atlas quad is one particle: its centre, and this corner's place inside it
     part.set([((tile%16)+(col+.5)/cols)/16,(Math.floor(tile/16)+(row+.5)/rows)/16,dx,dy],k*12+j*4)}k++;
   }
  }
 }
 return {target,uv,cell,part,originalTriangles:input.length/9,triangles:targetCount,scale};
}
// Particle methods move each `part` as one grain. A big model has far more faces than the built-in shapes (80×80 grains),
// so its grains can be merged on an n×n grid of the image: detail 0 = built-in grain size, 1 = one grain per face pair (as imported).
export const BASE_GRAINS=80;
export function particleParts(data,detail){
 const uv=data.uv,tris=uv.length/6,native=Math.sqrt(tris/2);
 if(detail>=1||native<=BASE_GRAINS)return data.part;
 const n=Math.round(BASE_GRAINS*Math.pow(native/BASE_GRAINS,Math.max(0,detail)));
 if(n>=native)return data.part;
 const part=new Float32Array(data.part.length);
 for(let t=0;t<tris;t++){
  const o=t*6,cx=Math.min(n-1,Math.floor((uv[o]+uv[o+2]+uv[o+4])/3*n)),cy=Math.min(n-1,Math.floor((uv[o+1]+uv[o+3]+uv[o+5])/3*n));
  for(let j=0;j<3;j++){const k=t*12+j*4;part[k]=(cx+.5)/n;part[k+1]=(cy+.5)/n;part[k+2]=uv[o+j*2]*n-cx;part[k+3]=uv[o+j*2+1]*n-cy}
 }
 return part;
}
