import {clone,StudioError} from './model.js';
export function beginUnfoldEdit(p,clipId){const c=p.clips.find(c=>c.id===clipId);if(!c||c.kind!=='unfold')throw new StudioError('MISSING_UNFOLD');const draft=clone(p.unfolds[c.unfoldId]);return {draft,assets:new Set(draft.dependencies),cancelled:false};}
export function applyUnfoldEdit(p,clipId,draft){const c=p.clips.find(c=>c.id===clipId);if(!c||!draft||draft.version!==1)throw new StudioError('MISSING_UNFOLD');return {type:'replaceUnfold',id:clipId,snapshot:{...clone(draft),id:c.unfoldId}};}
export function cancelUnfoldEdit(session){session.assets.clear();session.cancelled=true;session.draft=null;}
