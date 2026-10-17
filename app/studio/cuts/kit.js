// カット割りの部品を書くための小さな道具（毎日足す部品 daily-parts.js が使う）。どれも純関数で、import しても DOM には触らない。
// 中身は glyphs.js / parts.js の中の同じ名前の道具と同じ式（手で作った部品と同じ感覚で書けるように）。
export const DEG=Math.PI/180,TAU=Math.PI*2;
export const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const lerp=(a,b,u)=>a+(b-a)*u;
export const fract=x=>x-Math.floor(x);
export const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
export const bell=p=>Math.sin(clamp(p)*Math.PI);
export const outCubic=x=>1-(1-clamp(x))**3;
export const inCubic=x=>clamp(x)**3;
export const inOutCubic=x=>{x=clamp(x);return x<.5?4*x*x*x:1-(-2*x+2)**3/2;};
export const outExpo=x=>x>=1?1:1-2**(-10*clamp(x));
export const outBack=(x,s=1.70158)=>{x=clamp(x)-1;return 1+(s+1)*x*x*x+s*x*x;};
export const bounceOut=x=>{x=clamp(x);const n=7.5625,d=2.75;return x<1/d?n*x*x:x<2/d?n*(x-=1.5/d)*x+.75:x<2.5/d?n*(x-=2.25/d)*x+.9375:n*(x-=2.625/d)*x+.984375;};
/** ばねで 1 に落ち着く（u: 0→1。k: 揺れの速さ、d: 減り方） */
export const spring=(u,k=9,d=5)=>{u=clamp(u);return 1-Math.exp(-d*u)*Math.cos(k*u);};
/** 0..1 の決まった乱数（同じ引数なら同じ値。時刻から描く部品で、毎回同じ絵にするため） */
export const hash=(a,b=0,c=0)=>fract(Math.sin(a*127.1+b*311.7+c*74.7)*43758.5453);
export const sign=r=>r()<.5?-1:1;
export const pickW=(r,items,weights)=>{let x=r()*weights.reduce((a,b)=>a+b,0);for(let i=0;i<items.length;i++){x-=weights[i];if(x<=0)return items[i];}return items.at(-1);};
/** 字 i の、登場（退場）の間の進み具合。spread は先頭と最後の字のずれ（全体に対する割合） */
export const local=(p,i,n,spread)=>clamp((p-(n>1?i/(n-1)*spread:0))/Math.max(.05,1-spread));
export const hexRgb=h=>{const n=parseInt(String(h).slice(1,7),16)||0;return [n>>16&255,n>>8&255,n&255];};
export const rgba=(h,a)=>{const [r,g,b]=hexRgb(h);return `rgba(${r},${g},${b},${a})`;};
export const mixHex=(a,b,u)=>{const x=hexRgb(a),y=hexRgb(b);return '#'+x.map((v,i)=>Math.round(lerp(v,y[i],u)).toString(16).padStart(2,'0')).join('');};
export const luma=hex=>{const [r,g,b]=hexRgb(hex);return (.2126*r+.7152*g+.0722*b)/255;};
/** 色 hex の上で読める文字色（明るい色には黒っぽい色、暗い色には白） */
export const contrast=hex=>luma(hex)>.55?'#101018':'#ffffff';
/** 雰囲気のタグ（部品の tags に使う） */
export const MOODS=['calm','pop','glitch','graphic','emotional','impact'];
/** 部品の軸（daily-parts.js の axis）と、画面に出す名前（2026-10-17 作者が決めた英語の名前）。AXIS_HINTS は添える日本語 */
export const AXES={enter:'IN',hold:'STAY',exit:'OUT',treat:'STYLE',bg:'BG',cam:'CAM',fx:'FX',trans:'TRANS',world:'STAGE',deco:'DECO'};
export const AXIS_HINTS={enter:'登場',hold:'保持',exit:'退場',treat:'字の描き方',bg:'背景',cam:'カメラ',fx:'画面効果',trans:'つなぎ',world:'文字を載せる台',deco:'飾り'};

/**
 * 毎日の部品を、軸ごとの表の末尾に足す（glyphs.js / parts.js / worlds.js が、自分の表について呼ぶ）。
 * 手で作った部品と同じ名前（key）の部品は足さない（テストが名前の重なりを落とす）。足した部品には daily:{added,desc} が付く。
 */
export function addDailyParts(tables,parts){
 for(const d of parts){
  const table=tables[d.axis];if(!table)continue;
  if(Object.hasOwn(table,d.key)){console.warn('毎日の部品の名前が、ほかの部品と重なっています:',d.axis,d.key);continue;}
  const {axis,key,added,desc,...def}=d;
  table[key]={...def,daily:{added,desc}};
 }
}
