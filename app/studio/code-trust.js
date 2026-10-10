import {WORKSHOP_EXAMPLES} from '../workshop-examples.js';
const key='unfold-studio-approved-code-v1';const bundled=new Set(WORKSHOP_EXAMPLES.map(e=>e.source));
export function isStudioCodeApproved(source){if(bundled.has(source))return true;try{return JSON.parse(localStorage.getItem(key)||'[]').includes(source);}catch{return false;}}
export function approveStudioCode(source){if(typeof source!=='string'||source.length>32000)throw Error('コードの形式を確認してください');let current=[];try{current=JSON.parse(localStorage.getItem(key)||'[]');}catch{}localStorage.setItem(key,JSON.stringify([...new Set([...current,source])].slice(-100)));}
export function projectCodeSources(p){return [...new Set([...p.clips,...p.lyrics].map(c=>c.motion?.code?.source).concat(Object.values(p.unfolds).flatMap(u=>(u.state.methods||[]).map(m=>m.code?.source||m.vertex||m.source))).filter(Boolean))];}
