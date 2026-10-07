export const CODE_SOURCE_LIMIT=32000;
export function cleanCodeMotion(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||value.version!==1||typeof value.source!=='string'||!value.source.trim()||value.source.length>CODE_SOURCE_LIMIT||Object.keys(value).some(k=>!['version','source'].includes(k)))throw Error('コードは version:1、1〜32000文字のJavaScriptで指定してください。');
 return {version:1,source:value.source};
}
const APPROVALS='unfold-code-motion-approved-v1';
function approved(){try{const data=JSON.parse(globalThis.localStorage?.getItem(APPROVALS)||'[]');return Array.isArray(data)?data.filter(s=>typeof s==='string'&&s.length<=CODE_SOURCE_LIMIT).slice(-100):[]}catch{return []}}
export function isCodeMotionApproved(source){return approved().includes(source)}
export function approveCodeMotion(source){cleanCodeMotion({version:1,source});const items=approved().filter(s=>s!==source);try{globalThis.localStorage.setItem(APPROVALS,JSON.stringify([...items,source].slice(-100)))}catch{throw Error('モーションの確認状態を保存できません。ブラウザの空き容量を確認してください。')}}
