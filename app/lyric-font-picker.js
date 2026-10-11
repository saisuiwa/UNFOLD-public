// The two ways to a font of your own, as a small block: a font installed on this PC (Chrome / Edge on a PC) and a font file.
// `onPick(key,label)` gets the font key (local:... / file:...) once the font is ready to use.
import {listLocalLyricFonts,selectLocalLyricFont,importLyricFont} from './lyric-fonts.js';
const node=(tag,text,cls)=>Object.assign(document.createElement(tag),{...(text==null?{}:{textContent:text}),...(cls?{className:cls}:{})});
export function createFontPicker({onPick,onStatus=()=>{}}){
 const element=node('div',null,'font-picker'),row=node('div',null,'lq-row'),pc=node('button','PCのフォント','btn'),fileButton=node('button','フォントファイル','btn'),file=node('input');
 pc.type=fileButton.type='button';file.type='file';file.accept='.ttf,.otf,.woff,.woff2';file.hidden=true;row.append(pc,fileButton,file);
 const browser=node('div',null,'lq-font-browser'),search=node('input'),list=node('select');browser.hidden=true;search.placeholder='フォント名で絞り込む';search.setAttribute('aria-label','PCフォントを検索');list.size=6;list.setAttribute('aria-label','PCフォント一覧');browser.append(search,list);
 const note=node('p','PCフォントはこのPCから参照します。ファイルはこのブラウザに保存。別のPCでは同じフォントを指定してください。','hint');
 element.append(row,browser,note);
 let fonts=[];
 const busy=value=>{pc.disabled=fileButton.disabled=list.disabled=value};
 async function use(load,label){busy(true);try{const key=await load();await onPick(key,label?.(key));}catch(e){onStatus(e.message||String(e));}finally{busy(false);}}
 function filter(){const q=search.value.toLocaleLowerCase(),items=fonts.filter(i=>i.label.toLocaleLowerCase().includes(q)).slice(0,200);list.replaceChildren(new Option('書体を選んで適用',''));for(const i of items)list.append(new Option(i.label,i.key));list.value='';}
 pc.onclick=async()=>{busy(true);try{fonts=await listLocalLyricFonts();browser.hidden=false;filter();onStatus(fonts.length+'書体。名前で検索し、選ぶと反映されます。');}catch(e){onStatus(e.message);}finally{busy(false);}};
 search.oninput=filter;
 list.onchange=()=>{const item=fonts.find(f=>f.key===list.value);if(item)use(()=>selectLocalLyricFont(item),()=>item.label);};
 fileButton.onclick=()=>file.click();
 file.onchange=()=>{const chosen=file.files[0];file.value='';if(chosen)use(()=>importLyricFont(chosen),()=>chosen.name);};
 return {element,busy};
}
