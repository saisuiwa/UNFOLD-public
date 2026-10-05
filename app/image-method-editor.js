import * as THREE from './vendor/three.module.min.js';
import {createMethodEditor} from './method-editor.js?v=4';
import {createImageMethodRuntime} from './image-method-runtime.js';
import {IMAGE_METHOD_PRESETS} from './image-method-presets.js';
import {cleanImageCode,newImageMethodId,imageFrame} from './image-method-format.js';
import {getCustom,registerCustom,isImageMethodKey} from './method-registry.js';
import {makeTestImage} from './method-preview.js';
import {downloadMethodFile} from './method-transfer.js';
import {savedLyricFonts,importLyricFont,listLocalLyricFonts,selectLocalLyricFont} from './lyric-fonts.js';
const node=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e};
export function createImageMethodEditor(options){
 const old=createMethodEditor(options);let current=null;
 const openImage=({id,copyOf}={})=>{
  current?.close();const original=getCustom(id||copyOf),record=structuredClone(original?.code?original:IMAGE_METHOD_PRESETS[0]);
  if(!document.querySelector('link[data-image-editor]')){const link=node('link');link.rel='stylesheet';link.href=new URL('./image-method-editor.css',import.meta.url);link.dataset.imageEditor='';document.head.append(link)}
  const d=node('dialog');d.className='image-method-dialog';current=d;const heading=node('h2','画像メソッドをコードで作る'),close=node('button','閉じる');close.onclick=()=>d.close();const header=node('header');header.append(heading,close);d.append(header);
  const layout=node('div');layout.className='image-editor-layout';const left=node('div'),right=node('div');layout.append(left,right);d.append(layout);
  const name=node('input');name.value=copyOf?record.name+' コピー':record.name;name.maxLength=20;name.setAttribute('aria-label','画像メソッド名');left.append(name);
  const samples=node('select');samples.setAttribute('aria-label','画像モーションのサンプル');samples.append(new Option('サンプルを選ぶ',''));IMAGE_METHOD_PRESETS.forEach((x,i)=>samples.append(new Option(x.name,i)));left.append(samples);
  const source=node('textarea');source.value=record.code.source;source.spellcheck=false;source.setAttribute('aria-label','画像メソッド JavaScriptコード');left.append(source);
  const details=node('details'),summary=node('summary','使えるAPIと書き方');details.append(summary,node('p','api.THREE / Text / gsap / RAPIER、createImagePlane、createImageTiles、createText、physics.bind・floor・at、params、size、random。return {timeline, physicsTime(frame), update(frame), beforeStep(step), afterStep(step)}。updateは絶対時刻で指定します。画像の単位はワールド座標です。外部importや通信は使えません。'));left.append(details);
  const canvas=node('canvas');canvas.width=800;canvas.height=450;right.append(canvas);const ctx=canvas.getContext('2d');let image=options.getPreviewImage?.()||makeTestImage(),runtime=null,checked='',generation=0,playing=false,t=0,busy=false,wanted=false,raf,last=0;
  const note=node('p','画像 → 演出 → 元の画像。立体形状との接続は今後対応します。画像・文字は同じ3D空間です。');right.append(note);
  const status=node('p','プレビューで動作を確認してから追加できます。');status.setAttribute('role','status');right.append(status);
  const params={...record.code.params},controls=node('div');controls.className='image-code-params';right.append(controls);
  function field(label,input){const l=node('label',label);l.append(input);controls.append(l);return input}
  const paramInputs={};for(const [k,label,min,max,step]of [['columns','横の分割数',2,24,1],['gravity','重力',0,20,.1],['bounce','反発',0,1,.05],['seed','ランダムの種',0,999999,1]]){const e=node('input');e.type='number';e.min=min;e.max=max;e.step=step;e.value=params[k];paramInputs[k]=field(label,e);e.oninput=()=>{params[k]=Number(e.value);invalidate()}}
  const mode=node('select');mode.append(new Option('逆再生で戻る','reverse'),new Option('配置を整えて戻る','assemble'));mode.value=params.returnMode;field('戻り方',mode);mode.onchange=()=>{params.returnMode=mode.value;invalidate()};
  const text=node('input');text.value=params.label;text.maxLength=100;field('文字のサンプル',text);text.oninput=()=>{params.label=text.value;invalidate()};
  const font=node('select');for(const [k,n]of [['gothic','ゴシック'],['mincho','明朝'],['round','丸文字'],['dela','太文字'],['marker','手書き'],['dot','ドット'],...savedLyricFonts().map(f=>[f.key,f.label])])font.append(new Option(n,k));font.value=params.font;field('書体',font);font.onchange=()=>{params.font=font.value;invalidate()};
  function button(text,fn,parent=right){const b=node('button',text);b.type='button';b.onclick=async()=>{try{await fn()}catch(e){status.textContent=e.message}};parent.append(b);return b}
  button('フォントファイル',()=>{const input=node('input');input.type='file';input.accept='.ttf,.otf,.woff';input.onchange=async()=>{try{const f=input.files[0];if(!f)return;const key=await importLyricFont(f);font.append(new Option(f.name,key));font.value=key;params.font=key;invalidate()}catch(e){status.textContent=e.message}};input.click()});
  button('PCのフォント',async()=>{const items=await listLocalLyricFonts();const list=node('select');list.size=6;list.setAttribute('aria-label','PCフォント一覧');items.forEach(i=>list.append(new Option(i.label,i.key)));right.append(list);list.onchange=async()=>{try{const item=items.find(i=>i.key===list.value);await selectLocalLyricFont(item);font.append(new Option(item.label,item.key));font.value=item.key;params.font=item.key;invalidate();list.remove()}catch(e){status.textContent=e.message}}});
  const scrub=node('input');scrub.type='range';scrub.min=0;scrub.max=6;scrub.step=.01;scrub.value=0;scrub.setAttribute('aria-label','画像メソッドの時刻');right.append(scrub);
  const amount=node('input');amount.type='range';amount.min=0;amount.max=1;amount.step=.01;amount.value=.8;field('崩れる強さ',amount);amount.oninput=()=>render();
  const makeCode=()=>cleanImageCode({...record.code,source:source.value,params});
  function invalidate(){generation++;checked='';playing=false;runtime?.dispose();runtime=null;status.textContent='変更しました。プレビューを押して確認してください。'}
  source.oninput=invalidate;
  samples.onchange=()=>{if(samples.value==='')return;const sample=IMAGE_METHOD_PRESETS[Number(samples.value)];source.value=sample.code.source;name.value=sample.name;invalidate()};
  async function render(){if(!runtime)return;if(busy){wanted=true;return}busy=true;const own=generation,r=runtime;try{do{wanted=false;const ratio=image.width/image.height,h=Math.min(3.65,5.25/ratio),w=h*ratio;const cam=new THREE.OrthographicCamera(-4,4,2.25,-2.25,.1,100);cam.position.z=10;cam.updateMatrixWorld();const f={...imageFrame(t,6,Number(amount.value)),width:800,height:450,bg:'#101819',camera:{projection:cam.projectionMatrix.toArray(),world:cam.matrixWorld.toArray()}};const b=await r.render(f);if(own!==generation){b.close();return}ctx.clearRect(0,0,800,450);ctx.drawImage(b,0,0);b.close();scrub.value=t;}while(wanted&&own===generation)}catch(e){if(own===generation){status.textContent=e.message;checked='';playing=false;r.dispose();runtime=null}}finally{busy=false}}
  button('プレビュー',async()=>{invalidate();const own=generation,code=makeCode(),ratio=image.width/image.height,h=Math.min(3.65,5.25/ratio);runtime=createImageMethodRuntime();const r=runtime;status.textContent='画像・文字・物理演算を準備しています…';await r.prepare({code,imageA:image,imageB:image,size:{width:h*ratio,height:h}});if(own!==generation)return;t=0;const cam=new THREE.OrthographicCamera(-4,4,2.25,-2.25,.1,100);cam.position.z=10;cam.updateMatrixWorld();const proof=await r.render({...imageFrame(.8,6,Number(amount.value)),width:800,height:450,bg:'#101819',camera:{projection:cam.projectionMatrix.toArray(),world:cam.matrixWorld.toArray()}});proof.close();if(own!==generation)return;await render();if(runtime===r){checked=JSON.stringify(code);status.textContent='確認できました。再生・追加・保存ができます。';playing=true}});
  button('再生／停止',()=>{playing=!playing});scrub.oninput=()=>{playing=false;t=Number(scrub.value);render()};
  button('画像を選ぶ',()=>{const input=node('input');input.type='file';input.accept='image/*';input.onchange=async()=>{if(!input.files[0])return;const url=URL.createObjectURL(input.files[0]);try{const img=new Image();img.src=url;await img.decode();image=img;invalidate()}catch(e){status.textContent=e.message}finally{URL.revokeObjectURL(url)}};input.click()});
  button('コードをコピー',()=>navigator.clipboard.writeText(source.value),left);
  function saved(){const code=makeCode();if(checked!==JSON.stringify(code))throw Error('変更したコードをプレビューしてから保存してください。');if(!name.value.trim())throw Error('名前を付けてください。');return{id:id||newImageMethodId(),name:name.value.trim(),symbol:'◈',code,status:'ok'}}
  button(id?'保存して更新':'ブロックに追加',()=>{const s=saved();registerCustom(s);options.notify?.('画像メソッド「'+s.name+'」を追加しました。メソッド一覧から選べます。');d.close()});
  button('メソッドファイルを書き出す',()=>downloadMethodFile([saved()],{notify:options.notify}));
  function tick(now){const dt=Math.min(.1,(now-last)/1000);last=now;if(playing&&runtime){t=(t+dt)%6;render()}raf=requestAnimationFrame(tick)}raf=requestAnimationFrame(tick);
  d.addEventListener('close',()=>{generation++;runtime?.dispose();cancelAnimationFrame(raf);d.remove();if(current===d)current=null},{once:true});document.body.append(d);d.showModal();
 };
 return {open(args={}){if(isImageMethodKey(args.id||args.copyOf))return openImage(args);if(args.id||args.copyOf)return old.open(args);const d=node('dialog');d.append(node('h2','メソッドを追加'));const choice=(label,fn)=>{const b=node('button',label);b.onclick=()=>{d.close();d.remove();fn()};d.append(b)};choice('GLSLで作る',()=>old.open());choice('JavaScript＋物理演算で作る',()=>openImage());choice('キャンセル',()=>{});document.body.append(d);d.showModal()},openImage,close(){current?.close();old.close()},get isOpen(){return !!current?.open||old.isOpen}};
}
