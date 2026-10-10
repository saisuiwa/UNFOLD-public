/**
 * Gives a project's assets new ids (an opened file must never share byte ids with the project that is already open).
 * ONLY references to assets change. A settings key or a text that merely equals an asset id (for example the asset
 * "orbit" and the camera setting cam.orbit) is authored data and stays untouched.
 * The reference sites mirror collectAssetRefs (assets.js) plus the places inside an UNFOLD snapshot that it lists as dependencies.
 */
export function remapAssetIds(project,map){
 const re=id=>typeof id==='string'&&map.has(id)?map.get(id):id;
 const p=structuredClone(project);
 p.assets=Object.fromEntries(Object.entries(p.assets).map(([key,meta])=>[re(key),{...meta,id:re(meta.id??key)}]));
 for(const item of [...p.clips,...p.lyrics,...p.audio]){
  if(item.assetId)item.assetId=re(item.assetId);
  if(item.motion?.fontAssetId)item.motion.fontAssetId=re(item.motion.fontAssetId);
 }
 for(const unfold of Object.values(p.unfolds)){
  unfold.dependencies=unfold.dependencies.map(re);
  const state=unfold.state||{};
  for(const slide of state.slides||[]){if(slide.img)slide.img=re(slide.img);if(slide.lyric?.img)slide.lyric.img=re(slide.lyric.img);}
  for(const table of ['modelAssets','fontAssets'])for(const key of Object.keys(state[table]||{}))state[table][key]=re(state[table][key]);
 }
 return p;
}
