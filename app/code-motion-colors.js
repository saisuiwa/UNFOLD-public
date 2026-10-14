// Troika colorRanges use offsets within each mesh, while lyric runs use the
// original text. Resolve fragments in creation order, including skipped spaces.
// Besides the colours, `resolve.marks` holds the word decorations (縁取り outline / 中抜き hollow) of the last fragment,
// as ranges of that mesh's own text: [{from,to,outline,hollow}]. `resolve.sizes` holds the word sizes (a run's `scale`, 1 = as set) of the last
// fragment in the same ranges: [{from,to,scale}] (only for runs that are not 1).
export function createMotionColorResolver({text,runs=[],color,accent}){
 let cursor=0;
 const resolve=(value,options={})=>{
  resolve.marks=[];resolve.sizes=[];
  if(Object.hasOwn(options,'colorRanges'))return options.colorRanges;
  value=String(value);if(!value)return null;
  const explicit=Number.isInteger(options.textStart)&&options.textStart>=0&&options.textStart+value.length<=text.length;
  let start=explicit?options.textStart:value===text?0:text.indexOf(value,cursor);
  if(start<0)start=text.indexOf(value);
  if(start<0)return null;
  if(value!==text)cursor=start+value.length;
  const end=start+value.length,base=options.color??color,ranges={0:base};
  let offset=0,styled=false;
  for(const run of runs){
   const next=offset+String(run.text||'').length;
   if(next>start&&offset<end){
    ranges[Math.max(0,offset-start)]=run.color||(run.emphasis?accent:base);
    if(run.color||run.emphasis)styled=true;
    if(run.outline||run.hollow)resolve.marks.push({from:Math.max(0,offset-start),to:Math.min(end,next)-start,outline:!!run.outline,hollow:!!run.hollow,...(run.outline&&run.outlineColor?{outlineColor:run.outlineColor}:{}),...(run.outline&&run.outlineWidth?{outlineWidth:run.outlineWidth}:{})});
   }
   if(next>start&&offset<end&&Number.isFinite(run.scale)&&run.scale>0&&run.scale!==1)resolve.sizes.push({from:Math.max(0,offset-start),to:Math.min(end,next)-start,scale:run.scale});
   offset=next;if(offset>=end)break;
  }
  return styled?ranges:null;
 };
 resolve.marks=[];resolve.sizes=[];
 return resolve;
}
