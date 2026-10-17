// Preserve every input triangle. Split edges only to fit a complete image atlas.
export const MAX_MODEL_TRIANGLES=1000000;
// opts.ordered: lay the picture on by position (tile rows from the bottom up, left to right in each row) instead of in the order the triangles come in,
// so the model shows the picture the way a printed texture would. Off (the default) = as before.
// opts.extras = {data, stride}: more numbers for each corner (stride per corner, 3·stride per triangle, in the order of input), e.g. a GLB's own colour,
// texture coordinates and normal (model-import.js). They are carried through the splits (a new corner gets the average of the edge's two) and returned
// as `extras` (3·stride per triangle, in the order of `target`).
// The triangles are kept in flat arrays (positions as doubles, exactly as before; extras as floats), so a million triangles with extras fit in memory.
export function modelLayout(input,opts={}){
 if(!input.length||input.length%9)throw new Error('三角形の形状を読み取れませんでした。');
 const n=input.length/9;
 if(n>MAX_MODEL_TRIANGLES)throw new Error('三角形100万枚以下に軽量化したGLBを選んでね。');
 const E=opts.extras&&opts.extras.data?.length===n*3*opts.extras.stride?opts.extras.stride:0,X=E*3;
 const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
 for(let i=0;i<input.length;i++){const v=input[i];if(!Number.isFinite(v))throw new Error('モデルの座標が不正です。');const k=i%3;lo[k]=Math.min(lo[k],v);hi[k]=Math.max(hi[k],v)}
 const extent=Math.max(...hi.map((v,i)=>v-lo[i]));
 if(extent<1e-8)throw new Error('大きさのある立体が見つかりませんでした。');
 const center=lo.map((v,i)=>(v+hi[i])/2),scale=3.5/extent;
 const targetCount=Math.max(4096,Math.ceil(n/512)*512);
 const pos=new Float64Array(targetCount*9),ext=X?new Float32Array(targetCount*X):null;
 for(let i=0;i<input.length;i++)pos[i]=(input[i]-center[i%3])*scale;
 if(ext)ext.set(opts.extras.data);
 // Split the largest triangles first, leaving the imported silhouette intact.
 const size=t=>{const o=t*9,a0=pos[o+3]-pos[o],a1=pos[o+4]-pos[o+1],a2=pos[o+5]-pos[o+2],b0=pos[o+6]-pos[o],b1=pos[o+7]-pos[o+1],b2=pos[o+8]-pos[o+2];return Math.hypot(a1*b2-a2*b1,a2*b0-a0*b2,a0*b1-a1*b0)};
 const heapT=new Int32Array(targetCount),heapS=new Float64Array(targetCount);let h=0,used=n;
 function push(t){const s=size(t);let i=h++;while(i){const p=(i-1)>>1;if(heapS[p]>=s)break;heapT[i]=heapT[p];heapS[i]=heapS[p];i=p}heapT[i]=t;heapS[i]=s}
 function pop(){const top=heapT[0],lt=heapT[--h],ls=heapS[h];if(h){let i=0;while(i*2+1<h){let c=i*2+1;if(c+1<h&&heapS[c+1]>heapS[c])c++;if(heapS[c]<=ls)break;heapT[i]=heapT[c];heapS[i]=heapS[c];i=c}heapT[i]=lt;heapS[i]=ls}return top}
 for(let t=0;t<n;t++)push(t);
 const P=[0,0,0,0,0,0,0,0,0],Q=new Float32Array(X||1);
 while(h<targetCount){const t=pop(),o=t*9;for(let j=0;j<9;j++)P[j]=pos[o+j];
  const edge=[0,1,2].map(i=>{let s=0;for(let k=0;k<3;k++)s+=(P[i*3+k]-P[((i+1)%3)*3+k])**2;return s});
  const i=edge.indexOf(Math.max(...edge)),ia=i,ib=(i+1)%3,ic=(i+2)%3,u=used++;
  // [a, m, c] replaces t, [m, b, c] is new
  for(let k=0;k<3;k++){const a=P[ia*3+k],b=P[ib*3+k],c=P[ic*3+k],m=(a+b)/2;pos[o+k]=a;pos[o+3+k]=m;pos[o+6+k]=c;pos[u*9+k]=m;pos[u*9+3+k]=b;pos[u*9+6+k]=c}
  if(ext){const e=t*X,f=u*X;Q.set(ext.subarray(e,e+X));
   for(let k=0;k<E;k++){const a=Q[ia*E+k],b=Q[ib*E+k],c=Q[ic*E+k],m=(a+b)/2;ext[e+k]=a;ext[e+E+k]=m;ext[e+2*E+k]=c;ext[f+k]=m;ext[f+E+k]=b;ext[f+2*E+k]=c}}
  push(t);push(u);
 }
 let order=heapT;
 if(opts.ordered){   // equal numbers of triangles in 16 bands from the bottom (by height), each band left to right
  const cx=t=>(pos[t*9]+pos[t*9+3]+pos[t*9+6])/3,cy=t=>(pos[t*9+1]+pos[t*9+4]+pos[t*9+7])/3;
  const keyed=Array.from(heapT,t=>({t,x:cx(t),y:cy(t)})).sort((a,b)=>a.y-b.y),band=targetCount/16;
  order=[];for(let r=0;r<16;r++)for(const q of keyed.slice(r*band,(r+1)*band).sort((a,b)=>a.x-b.x))order.push(q.t);
 }
 const target=new Float32Array(targetCount*9),extras=ext?new Float32Array(targetCount*X):null,uv=new Float32Array(targetCount*6),cell=new Float32Array(targetCount*6),part=new Float32Array(targetCount*12);
 const quads=targetCount/512,rows=Math.max(1,Math.round(Math.sqrt(quads)));
 let k=0;
 for(let tile=0;tile<256;tile++){let pending=quads;
  for(let row=0;row<rows;row++){const cols=Math.ceil(pending/(rows-row));pending-=cols;
   for(let col=0;col<cols;col++)for(const corners of [[[0,0],[1,0],[0,1]],[[1,0],[1,1],[0,1]]]){
    const t=order[k];target.set(pos.subarray(t*9,t*9+9),k*9);if(extras)extras.set(ext.subarray(t*X,t*X+X),k*X);
    for(let j=0;j<3;j++){const [dx,dy]=corners[j];uv[k*6+j*2]=((tile%16)+(col+dx)/cols)/16;uv[k*6+j*2+1]=(Math.floor(tile/16)+(row+dy)/rows)/16;cell[k*6+j*2]=((tile%16)+.5)/16;cell[k*6+j*2+1]=(Math.floor(tile/16)+.5)/16;
     // each atlas quad is one particle: its centre, and this corner's place inside it
     part.set([((tile%16)+(col+.5)/cols)/16,(Math.floor(tile/16)+(row+.5)/rows)/16,dx,dy],k*12+j*4)}k++;
   }
  }
 }
 return {target,uv,cell,part,extras,originalTriangles:n,triangles:targetCount,scale};
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
