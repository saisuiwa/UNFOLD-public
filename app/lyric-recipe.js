// Serializable motion recipes. Never execute imported code.
export const LAYOUTS={editorial:'余白で読ませる',impact:'大きな言葉',vertical:'縦に流れる詩',echo:'響きが広がる',assemble:'文字が集まる',poster:'一文字を風景に'};
export const ENTRANCES={rise:'滑り出す',scatter:'集まる',reveal:'順番に現れる',pop:'弾む',fade:'ふわっと現れる'};
export const SUSTAINS={sway:'ゆらゆら',breathe:'呼吸する明滅',glitch:'短いグリッチ',warp:'波ワープ',echo:'ゆれる残像'};
export const EXITS={fade:'溶けるように消える',drift:'流れて消える',scatter:'ほどけて消える'};
const plain=x=>x&&typeof x==='object'&&!Array.isArray(x);
const bound=(v,f,min,max)=>Number.isFinite(v)?Math.max(min,Math.min(max,v)):f;
export function normalizeRecipe(v={}){
 v=plain(v)?v:{};
 return {version:1,layout:Object.hasOwn(LAYOUTS,v.layout)?v.layout:'editorial',enter:Object.hasOwn(ENTRANCES,v.enter)?v.enter:'rise',sustain:[...new Set(Array.isArray(v.sustain)?v.sustain.filter(x=>Object.hasOwn(SUSTAINS,x)):['sway'])].slice(0,3),exit:Object.hasOwn(EXITS,v.exit)?v.exit:'fade',strength:bound(v.strength,.6,0,1),stagger:bound(v.stagger,.08,0,.2)};
}
export function validateRecipe(v){
 const keys=['version','layout','enter','sustain','exit','strength','stagger'];
 if(!plain(v)||Object.keys(v).some(k=>!keys.includes(k))||keys.some(k=>!Object.hasOwn(v,k)))throw Error('モーションの項目を確認してください。');
 if(v.version!==1)throw Error('未対応のモーション形式です。');
 if(!Object.hasOwn(LAYOUTS,v.layout)||!Object.hasOwn(ENTRANCES,v.enter)||!Object.hasOwn(EXITS,v.exit))throw Error('構成・登場・退場の名前を確認してください。');
 if(!Array.isArray(v.sustain)||v.sustain.length>3||v.sustain.some(k=>!Object.hasOwn(SUSTAINS,k))||new Set(v.sustain).size!==v.sustain.length)throw Error('表示中の動きは重複なしで3種類までです。');
 if(!Number.isFinite(v.strength)||v.strength<0||v.strength>1||!Number.isFinite(v.stagger)||v.stagger<0||v.stagger>.2)throw Error('強さは0〜1、文字の時間差は0〜0.2秒で指定してください。');
 return normalizeRecipe(v);
}
const make=(id,name,description,enter,sustain,exit,font='gothic')=>({id,name,description,motion:{preset:'float',direction:'up',color:'#ffffff',emphasisColor:'#d9f878',size:72,position:'center',font,speed:1,recipe:normalizeRecipe({layout:id,enter,sustain,exit})}});
export const BUILTIN_MOTIONS=[
 make('editorial','余白と揺れる言葉','語句の大小と余白。表示中もゆっくり揺れます。','rise',['sway'],'fade'),
 make('impact','ビート・ポスター','大きな言葉と色面に短いグリッチ。','pop',['glitch'],'drift'),
 make('vertical','縦の詩','右から左に読む縦組み。呼吸するような明滅。','reveal',['breathe','sway'],'fade','mincho'),
 make('echo','声の余韻','薄い輪郭の反復と揺れる残像。','fade',['echo'],'fade'),
 make('assemble','つながる文字','独立した文字が集まり、小さく揺れます。','scatter',['sway'],'scatter'),
 make('poster','波打つ一文字','輪郭の大きな一文字と、波打つ本文。','rise',['warp'],'drift')
];
