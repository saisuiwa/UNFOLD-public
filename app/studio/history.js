import {clone,assertProject} from './model.js';
import {applyCommand} from './commands.js';
export function projectAssetRefs(p){const refs=new Set();for(const x of [...p.clips,...p.lyrics,...p.audio]){if(x.assetId)refs.add(x.assetId);if(x.motion?.fontAssetId)refs.add(x.motion.fontAssetId);if(x.unfoldId)for(const id of p.unfolds[x.unfoldId]?.dependencies||[])refs.add(id);}return refs;}
function label(c){if(c.type==='setLayout')return c.viewId==='tall'?'縦の配置変更':'横の配置変更';if(c.type.startsWith('split'))return '共通の分割';if(c.type==='setLock')return '位置固定の変更';return '共通の編集';}
export function createHistory(initial){
 let states=[clone(assertProject(initial))],labels=[],index=0,revision=initial.revision;
 const get=()=>({...clone(states[index]),revision});
 return {get,execute(command){const result=applyCommand(get(),command);if(!result.changed)return;states=states.slice(0,index+1);labels=labels.slice(0,index);states.push(result.project);labels.push(label(command));index++;},
 undo(){if(index>0)index--;},redo(){if(index<states.length-1)index++;},
 refs(){return new Set(states.flatMap(p=>[...projectAssetRefs(p)]));},
 status(){return {canUndo:index>0,canRedo:index<states.length-1,undoLabel:labels[index-1]||'',redoLabel:labels[index]||''};},
 markSaved(savedRevision){if(Number.isSafeInteger(savedRevision)&&savedRevision>=revision)revision=savedRevision;},
 reset(p){states=[clone(assertProject(p))];labels=[];index=0;revision=p.revision;}};
}
