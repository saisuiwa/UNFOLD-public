import { cleanShot, DIRECTIONS, cameraPadRect, cameraPadPoint } from './shot-motion.js?v=26';
const NS='http://www.w3.org/2000/svg';
export function createShotControls({value,onChange,getDuration=()=>10,getImage=()=>null}={}){
 let state=cleanShot(value),endpoint='from',fit={x:0,y:0,width:320,height:180};
 const root=document.createElement('details');root.className='shot-controls';
 const summary=document.createElement('summary');summary.textContent='回転方向・カメラの移動';root.append(summary);
 const body=document.createElement('div');body.className='shot-body';root.append(body);
 const fields=new Map();
 const get=path=>path.split('.').reduce((v,k)=>v[k],state);
 const set=(path,value)=>{const parts=path.split('.'),last=parts.pop();parts.reduce((v,k)=>v[k],state)[last]=value;state=cleanShot(state);sync();onChange?.(structuredClone(state));};
 const text=(tag,value)=>{const e=document.createElement(tag);e.textContent=value;body.append(e);return e};
 function field(path,title,{type='number',min,max,step,options}={}){
  const row=document.createElement('label');row.className='shot-field';const caption=document.createElement('span');caption.textContent=title;
  const input=document.createElement(options?'select':'input');if(options){for(const [v,label]of options){const o=document.createElement('option');o.value=v;o.textContent=label;input.append(o)}}else{input.type=type;if(min!==undefined)input.min=min;if(max!==undefined)input.max=max;if(step!==undefined)input.step=step;}
  input.dataset.shot=path;input.setAttribute('aria-label',title);fields.set(path,input);
  input.onchange=()=>set(path,type==='checkbox'?input.checked:options?input.value:Number(input.value));row.append(caption,input);body.append(row);return input;
 }
 text('h3','立体の回転');field('rotation.enabled','回転方向を指定する（OFFで元の動き）',{type:'checkbox'});
 field('rotation.inDirection','入りの方向',{options:DIRECTIONS});field('rotation.inTurns','入りの回転量（回）',{min:0,max:3,step:1});
 field('rotation.outDirection','戻りの方向',{options:DIRECTIONS});field('rotation.outTurns','戻りの回転量（回）',{min:0,max:3,step:1});
 text('p','方向は画面から見た動きです。斜めは縦横を合わせた軸で回転します。回転量は0〜3回の整数で、別の方向へ回しても最後は原画の向きへ戻ります。');
 text('h3','カメラの移動');field('camera.enabled','開始点→終了点のカメラを使う',{type:'checkbox'});
 const row=document.createElement('div');row.className='shot-actions';body.append(row);
 for(const [key,label]of [['from','開始点を指定'],['to','終了点を指定']]){const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.endpoint=key;b.onclick=()=>{endpoint=key;sync()};row.append(b)}
 const pad=document.createElementNS(NS,'svg');pad.setAttribute('viewBox','0 0 320 180');pad.setAttribute('role','img');pad.setAttribute('aria-label','カメラ位置パッド。開始点または終了点を選んでクリック');pad.classList.add('shot-pad');body.append(pad);
 const svg=(tag,attrs)=>{const e=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);pad.append(e);return e};
 svg('rect',{width:320,height:180,fill:'#172421'});const picture=svg('image',{x:0,y:0,width:320,height:180,preserveAspectRatio:'xMidYMid meet',opacity:.65});svg('path',{d:'M160 0V180 M0 90H320',stroke:'#aabbad','stroke-opacity':.4});const line=svg('path',{stroke:'#d9f878','stroke-width':2,fill:'none'});
 const a=svg('circle',{r:6,fill:'#d9f878',stroke:'#172421'}),b=svg('circle',{r:6,fill:'#78c8ff',stroke:'#172421'});
 const at=svg('text',{fill:'#d9f878','font-size':13}),bt=svg('text',{fill:'#78c8ff','font-size':13});at.textContent='開始';bt.textContent='終了';
 pad.onclick=e=>{const rect=pad.getBoundingClientRect(),{x,y}=cameraPadPoint(fit,(e.clientX-rect.left)/rect.width*320,(e.clientY-rect.top)/rect.height*180);state.camera.enabled=true;state.camera[endpoint].x=+x.toFixed(3);state.camera[endpoint].y=+y.toFixed(3);sync();onChange?.(structuredClone(state));};
 text('p','黄＝開始、青＝終了。狙いたい場所をクリック（横＋は右、縦＋は上）。数値でも指定できます。これは指定した軌道の移動で、自動追尾ではありません。');
 for(const [key,label]of [['from','開始'],['to','終了']]){field('camera.'+key+'.x',label+'・横位置',{min:-1,max:1,step:.01});field('camera.'+key+'.y',label+'・縦位置',{min:-1,max:1,step:.01});field('camera.'+key+'.zoom',label+'・ズーム倍率',{min:.5,max:4,step:.05});}
 const times=[];for(const [key,title]of [['start','移動開始（秒）'],['end','移動終了（秒）']]){const label=document.createElement('label');label.className='shot-field';const span=document.createElement('span');span.textContent=title;const input=document.createElement('input');input.type='number';input.step=.1;input.min=0;input.dataset.shotTime=key;input.setAttribute('aria-label',title);input.onchange=()=>set('camera.'+key,Number(input.value)/getDuration()*100);label.append(span,input);body.append(label);times.push([key,input]);}
 field('camera.ease','移動の速さの変化',{options:[['smooth','なめらか'],['linear','一定'],['out','はじめ速く'],['in','おわり速く']]});
 text('p','この区間のカメラ位置・ズーム・傾きはここを優先します。冒頭と最後は元の構図へ戻ります。ズーム中も指定位置を中心に捉えます。');
 const presets=document.createElement('div');presets.className='shot-actions';body.append(presets);
 for(const [label,cam]of [['左端から右斜め上へ',{from:{x:-.4,y:0,zoom:1.5},to:{x:.25,y:.3,zoom:2}}],['狙った位置へ寄る',{from:{x:0,y:0,zoom:1},to:{x:.2,y:.15,zoom:2}}],['中央で寄って戻す',{from:{x:0,y:0,zoom:1},to:{x:0,y:0,zoom:2}}]]){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>{state.camera={...state.camera,...cam,enabled:true};sync();onChange?.(structuredClone(state))};presets.append(b)}
 const reset=document.createElement('button');reset.type='button';reset.textContent='回転・カメラを元の動きに戻す';reset.onclick=()=>{state=cleanShot();sync();onChange?.(structuredClone(state))};body.append(reset);
 function sync(){for(const [path,e]of fields){if(e.type==='checkbox')e.checked=get(path);else e.value=get(path)}for(const [key,e]of times){e.max=getDuration();e.value=+(state.camera[key]/100*getDuration()).toFixed(2)}for(const e of row.children)e.setAttribute('aria-pressed',e.dataset.endpoint===endpoint?'true':'false');const xy=p=>[fit.x+(p.x+.5)*fit.width,fit.y+(.5-p.y)*fit.height];const [ax,ay]=xy(state.camera.from),[bx,by]=xy(state.camera.to);a.setAttribute('cx',ax);a.setAttribute('cy',ay);b.setAttribute('cx',bx);b.setAttribute('cy',by);at.setAttribute('x',Math.max(4,Math.min(286,ax+8)));at.setAttribute('y',Math.max(14,Math.min(174,ay-8)));bt.setAttribute('x',Math.max(4,Math.min(286,bx+8)));bt.setAttribute('y',Math.max(14,Math.min(174,by+18)));line.setAttribute('d',`M${ax} ${ay}L${bx} ${by}`);}
 root.addEventListener('toggle',()=>{if(root.open){const image=getImage();if(image?.toDataURL){fit=cameraPadRect(image.width,image.height);picture.setAttribute('href',image.toDataURL('image/jpeg',.7));}sync()}});
 sync();return {element:root,setValue(value){state=cleanShot(value);sync()},get value(){return structuredClone(state)}};
}
