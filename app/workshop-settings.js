// Optional, non-executable preview settings. Never put these in runtime code.params.
export function cleanWorkshopSettings(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['shape','strength','words','shelf'].includes(k)))throw Error('工房の設定形式を確認してください。');
 const out={};
 if(value.shape!==undefined){if(typeof value.shape!=='string'||!(/^(none|sphere|heart|torus|star|cube)$/.test(value.shape)||/^glb-[a-zA-Z0-9-]{1,80}$/.test(value.shape)))throw Error('工房の立体設定を確認してください。');out.shape=value.shape;}
 if(value.strength!==undefined){if(!Number.isFinite(value.strength)||value.strength<0||value.strength>.8)throw Error('工房の強さ設定は0〜0.8です。');out.strength=value.strength;}
 if(value.shelf!==undefined){if(value.shelf!=='effect')throw Error('工房の棚の設定を確認してください。');out.shelf=value.shelf;}
 if(value.words!==undefined){if(typeof value.words!=='string'||value.words.length>4000)throw Error('工房の試す言葉は4000文字以内です。');out.words=value.words;}
 return out;
}
export const workshopField=value=>value===undefined?{}:{workshop:cleanWorkshopSettings(value)};
export function settingsOf(d){return cleanWorkshopSettings(Object.fromEntries(['shape','strength','words','shelf'].filter(k=>d[k]!==undefined).map(k=>[k,d[k]])));}
