// Troika colorRanges use offsets within each mesh, while lyric runs use the
// original text. Resolve fragments in creation order, including skipped spaces.
export function createMotionColorResolver({text,runs=[],color,accent}){
 let cursor=0;
 return (value,options={})=>{
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
   }
   offset=next;if(offset>=end)break;
  }
  return styled?ranges:null;
 };
}
