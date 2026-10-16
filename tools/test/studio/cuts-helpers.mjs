// カット演出のテストの共通部品: 見本の4行・計画の組み立て・文字を測る偽の物差し。
import {planCuts} from '../../../app/studio/cuts/plan.js';
import {BG,CAMERA,FX,TRANS} from '../../../app/studio/cuts/parts.js';
import {ENTER,HOLD,EXIT,TREAT} from '../../../app/studio/cuts/glyphs.js';
import {WORLD} from '../../../app/studio/cuts/worlds.js';

export const SAMPLE_LINES=[
 {text:'折り目が光に変わっていく',start:.4,end:3},
 {text:'小さな紙が風に飛んだ',start:3.04,end:5.75},
 {text:'ほら、もう一回ひろげよう',start:5.79,end:8.45},
 {text:'紙の翼でどこまでも',start:8.83,end:12}
];
export const DEFAULT_LINES_TEXT='';
export const parseLines=()=>({lines:SAMPLE_LINES.map(l=>({...l})),errors:[]});
/** planCuts に、文字色（検査と手直しが文字を測る時に使う）を足したもの。 */
export const planProject=(lines,opts={})=>{const cuts=planCuts(lines,opts);for(const c of cuts){c.color='#ffffff';c.emphasisColor='#ffb347';}return cuts;};
export const describeParts=c=>({bg:c.bgPart?BG[c.bgPart].name:'なし',cam:c.cam?CAMERA[c.cam].name:'なし',fx:c.fx?FX[c.fx].name:'なし',trans:c.trans?TRANS[c.trans].name:'なし'});
export const describeGlyphParts=c=>({enter:ENTER[c.enter]?.name||'なし',hold:HOLD[c.hold]?.name||'なし',exit:EXIT[c.exit]?.name||'なし',treat:TREAT[c.treat]?.name||'なし',font:c.gFont||'同じ',vertical:!!c.gVertical});
export const describeWorld=c=>c.world?WORLD[c.world].name:'なし';
export const glyphChoices=group=>Object.keys({enter:ENTER,hold:HOLD,exit:EXIT,treat:TREAT}[group]).map(key=>({key}));
