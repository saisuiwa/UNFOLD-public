export function el(tag,attrs={},...children){const node=document.createElement(tag);for(const [key,value]of Object.entries(attrs)){if(key.startsWith('on'))node.addEventListener(key.slice(2),value);else if(key==='class')node.className=value;else if(key==='text')node.textContent=value;else if(value!==undefined&&value!==false)node.setAttribute(key,value===true?'':value);}for(const c of children.flat())if(c!==null&&c!==undefined)node.append(c instanceof Node?c:document.createTextNode(String(c)));return node;}
export const action=(controller,fn)=>()=>Promise.resolve().then(fn).catch(e=>controller.notify(e.name==='AbortError'?'操作を取り消しました':e.message));
export const button=(controller,text,fn,attrs={})=>el('button',{type:'button',onclick:action(controller,fn),...attrs},text);
export function field(label,value,change,{type='number',...attrs}={}){const input=el(type==='textarea'?'textarea':'input',{'aria-label':label,...(type==='textarea'?{}:{type}),...attrs});input.value=value??'';input.addEventListener('change',()=>change(type==='number'?Number(input.value):input.value));return el('label',{class:'field'},el('span',{},label),input);}
export function select(label,value,options,change){const input=el('select',{'aria-label':label},options.map(([v,t])=>el('option',{value:v},t)));input.value=value;input.onchange=()=>change(input.value);return el('label',{class:'field'},el('span',{},label),input);}
// A number with a slider next to it (the slider commits on release, the number on change; both stay in step). The range has only a title: the
// number input carries the label, so one label names one control.
export function sliderField(label,value,change,{min=0,max=1,step=.01,disabled=false}={}){
 const num=el('input',{type:'number','aria-label':label,step,...(disabled?{disabled:true}:{})}),range=el('input',{type:'range',min,max,step,title:label,class:'slider-range',...(disabled?{disabled:true}:{})});
 num.value=value??'';range.value=value??min;
 range.addEventListener('input',()=>{num.value=range.value;});
 range.addEventListener('change',()=>change(Number(range.value)));
 num.addEventListener('change',()=>{range.value=num.value;change(Number(num.value));});
 return el('div',{class:'field slider-field'},el('span',{},label),el('div',{class:'slider-row'},num,range));
}
