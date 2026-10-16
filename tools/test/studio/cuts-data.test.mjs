// カット演出のデータ（lyric.cut）: 作る・読む・壊れていても落ちない・歌詞の変更で普通の描き方に戻る・コマンドで入れて元に戻せる。
import test from 'node:test';
import assert from 'node:assert/strict';
import {planCutsRaw,finishCutPlan,cleanCutData,cutActive,absoluteCuts,motionSig,fontsUsed,summarizeCuts,linesOf,CUT_VERSION,CUT_DEFAULTS} from '../../../app/studio/cuts/plan.js';
import {auditPlan} from '../../../app/studio/cuts/audit.js';
import {buildAnyItem} from '../../../app/studio/cuts/items.js';
import {applyCommand} from '../../../app/studio/commands.js';
import {createProject,validateProject,newLayout} from '../../../app/studio/model.js';

const TEXTS=['折り目が光に変わっていく','小さな紙が風に飛んだ','ほら、もう一回ひろげよう','紙の翼でどこまでも'];
const lyric=(i,text=TEXTS[i])=>({id:'L'+i,text,runs:[{id:'r'+i,text}],startUs:Math.round((.4+i*2.8)*1e6),endUs:Math.round((.4+i*2.8+2.6)*1e6),motion:{font:'gothic',color:'#ffffff',emphasisColor:'#ff6fae'},timingSource:'manual',opacity:1});
const projectOf=()=>{const p=createProject({durationUs:12e6});p.locks.lyrics=false;p.lyrics=TEXTS.map((_,i)=>lyric(i));for(const v of Object.values(p.views))for(const l of p.lyrics)v.layout[l.id]=newLayout();return p;};
const measure=(ch,font,px)=>/[\x00-\x7f]/.test(ch)?px*.55:px;
const planOf=(p,o={})=>{const raw=planCutsRaw(p,{seed:3,...o});const itemOf=cut=>buildAnyItem(cut,{W:960,H:540,measure});return finishCutPlan(raw,{itemOf});};

test('the plan gives every lyric its own data; cuts tile the lyric exactly and carry the part keys', () => {
 const p=projectOf(),{data,cuts}=planOf(p);
 assert.deepEqual([...data.keys()],p.lyrics.map(l=>l.id));
 for(const l of p.lyrics){
  const d=data.get(l.id);
  assert.equal(d.v,CUT_VERSION);assert.equal(d.text,l.text);assert.equal(d.sig,motionSig(l));assert.ok(Math.abs(d.dur-(l.endUs-l.startUs)/1e6)<1e-9);
  assert.equal(d.cuts[0].a,0);assert.ok(Math.abs(d.cuts.at(-1).b-d.dur)<.002);
  d.cuts.forEach((c,i)=>{if(i)assert.ok(Math.abs(c.a-d.cuts[i-1].b)<.002);assert.ok(c.b>c.a);for(const k of ['enter','hold','exit','treat','gFont','fontScale','runs'])assert.ok(k in c,k);});
  assert.ok(!('color' in d.cuts[0])&&!('start' in d.cuts[0])&&!('lineIndex' in d.cuts[0]),'colours and absolute times are not stored');
  assert.doesNotThrow(()=>JSON.stringify(d));
 }
 assert.ok(cuts.length>=10);
});

test('the plan is deterministic, and another seed gives another plan', () => {
 const p=projectOf();
 assert.deepEqual([...planOf(p).data],[...planOf(p).data]);
 assert.notDeepEqual([...planOf(p).data],[...planOf(p,{seed:4}).data]);
 assert.ok(planOf(p,{seed:1,camAmount:0,fxAmount:0,transAmount:0,worldAmount:0,carryAmount:0,ghostAmount:0}).cuts.every(c=>!c.cam&&!c.fx&&!c.trans&&!c.world&&!c.carry&&c.ghost===0),'amount 0 switches the axes off');
});

test('refine runs and the audit of the finished plan has no small-text / clash issues that have a cure', () => {
 const {audit,fixes}=planOf(projectOf(),{camAmount:1,fxAmount:1,transAmount:1,worldAmount:1,carryAmount:1});
 assert.ok(Array.isArray(fixes));
 for(const code of ['heavy','run','cam-hold','cam-world','recap-busy','carry-fx','dup-world'])assert.ok(!(audit.summary.byCode[code]>0),code);
 const off=planOf(projectOf(),{camAmount:1,fxAmount:1,transAmount:1,worldAmount:1,carryAmount:1,refine:false});
 assert.equal(off.fixes.length,0);
});

test('cutActive / absoluteCuts: a plan on the lyric draws; changed text or a hand-picked motion switches it off; stretched timing stretches the cuts', () => {
 const p=projectOf(),{data}=planOf(p),l={...p.lyrics[1],cut:data.get('L1')};
 assert.equal(cutActive(l),true);
 const abs=absoluteCuts(l);
 assert.equal(abs[0].start,l.startUs/1e6);assert.equal(abs.at(-1).end,l.endUs/1e6);
 assert.ok(abs.every(c=>c.color==='#ffffff'&&c.emphasisColor==='#ff6fae'),'colours come from the lyric\'s motion at draw time');
 assert.ok(abs.every((c,i)=>c.id===`L1:${i}`));
 assert.equal(absoluteCuts({...l,motion:{...l.motion,color:'#ff0000'}})[0].color,'#ff0000');
 assert.equal(cutActive({...l,text:'ちがう歌詞'}),false);
 assert.equal(cutActive({...l,motion:{...l.motion,code:{version:1,source:'return 1'}}}),false);
 assert.equal(cutActive({...l,motion:{...l.motion,recipe:{layout:'center'}}}),false);
 assert.equal(cutActive({...l,motion:{...l.motion,color:'#00ff00'}}),true,'a colour change keeps the plan');
 assert.equal(cutActive({...p.lyrics[1]}),false);
 // longer lyric: same boundaries, scaled
 const long={...l,endUs:l.startUs+2*(l.endUs-l.startUs)},a2=absoluteCuts(long);
 assert.equal(a2.at(-1).end,long.endUs/1e6);
 abs.forEach((c,i)=>{if(i<abs.length-1)assert.ok(Math.abs((a2[i].end-long.startUs/1e6)-2*(c.end-l.startUs/1e6))<1e-6);});
 assert.ok(a2.every(c=>c.transDur<=.45*(c.end-c.start)+1e-9&&c.carryDur<=.5*(c.end-c.start)+1e-9));
});

test('cleanCutData: broken or foreign data is dropped or repaired, never thrown; unknown part keys become "none"', () => {
 const p=projectOf(),{data}=planOf(p),good=data.get('L0');
 for(const bad of [null,undefined,1,'x',[],{},{v:2,cuts:[],dur:1},{...good,cuts:[]},{...good,dur:0},{...good,cuts:[{...good.cuts[0],text:''}]},{...good,cuts:[{...good.cuts[0],a:2,b:1}]},{...good,cuts:[good.cuts[1],good.cuts[0]]}])assert.equal(cleanCutData(bad),null,JSON.stringify(bad)?.slice(0,60));
 const weird={...good,cuts:good.cuts.map(c=>({...c,enter:'nope',exit:5,hold:'x',treat:{},bgPart:'zzz',cam:'q',fx:'q',trans:'q',world:'q',gFont:'comic',fontScale:99,bg:'red',ghost:'much',place:{rotation:'a',scale:-3},runs:'bad',transP:5,worldP:'x'}))};
 const c=cleanCutData(weird);assert.ok(c);
 for(const x of c.cuts){assert.equal(x.enter,'cut');assert.equal(x.hold,'still');assert.equal(x.exit,'cut');assert.equal(x.treat,'none');assert.equal(x.bgPart,null);assert.equal(x.cam,null);assert.equal(x.fx,null);assert.equal(x.trans,null);assert.equal(x.world,null);assert.equal(x.gFont,'gothic');assert.ok(x.fontScale<=.5);assert.match(x.bg,/^#[\da-f]{6}$/i);assert.equal(x.ghost,0);assert.ok(x.place.scale>=.3);assert.deepEqual(x.runs,[{text:x.text}]);assert.deepEqual(x.transP,{});}
 // whatever survives can be turned into drawable cuts
 const l={...p.lyrics[0],cut:weird};l.cut.sig=motionSig(l);l.cut.text=l.text;
 assert.equal(cutActive(l),true);assert.ok(absoluteCuts(l).length>=1);
});

test('the setLyricAppearance command carries the plan, undo-able as a whole, and the project stays valid', () => {
 const p=projectOf(),{data}=planOf(p);
 const batch={type:'batch',commands:p.lyrics.map(l=>({type:'setLyricAppearance',id:l.id,patch:{cut:data.get(l.id),motion:{...l.motion,color:'#ffd23f'}}}))};
 const {project:q,changed}=applyCommand(p,batch);
 assert.ok(changed);assert.deepEqual(validateProject(q),[]);
 assert.ok(q.lyrics.every(l=>cutActive(l)&&l.motion.color==='#ffd23f'));
 assert.deepEqual(p.lyrics.map(l=>l.cut),[undefined,undefined,undefined,undefined],'the old project is untouched');
 // removing it
 const {project:r}=applyCommand(q,{type:'batch',commands:q.lyrics.map(l=>({type:'setLyricAppearance',id:l.id,patch:{cut:null}}))});
 assert.ok(r.lyrics.every(l=>!('cut' in l)));assert.deepEqual(validateProject(r),[]);
 // other fields are still refused
 assert.throws(()=>applyCommand(p,{type:'setLyricAppearance',id:'L0',patch:{text:'x'}}),/INVALID_PATCH/);
 // a malformed plan is refused by the project check
 assert.ok(validateProject({...p,lyrics:p.lyrics.map((l,i)=>i?l:{...l,cut:{v:1}})}).some(i=>i.code==='INVALID_LYRIC'));
 assert.ok(validateProject({...p,lyrics:p.lyrics.map((l,i)=>i?l:{...l,cut:5})}).some(i=>i.code==='INVALID_LYRIC'));
 // editing the lyric text keeps working (the plan simply stops being used)
 const {project:t}=applyCommand(q,{type:'setLyricText',id:'L0',text:'書き換えた',runs:[{id:'r0',text:'書き換えた'}]});
 assert.equal(cutActive(t.lyrics[0]),false);assert.equal(cutActive(t.lyrics[1]),true);
});

test('linesOf skips lyrics without text and keeps time order; fontsUsed / summarizeCuts describe the plan', () => {
 const p=projectOf();p.lyrics.push({...lyric(9,'   '),id:'blank',startUs:20e6,endUs:21e6});
 const {lyrics,lines}=linesOf(p);assert.equal(lyrics.length,4);assert.equal(lines[0].start,.4);
 const raw=planCutsRaw(projectOf(),{seed:2});
 assert.ok(fontsUsed(raw.cuts).every(f=>['gothic','mincho','round','marker','dela','dot'].includes(f)));
 const s=summarizeCuts(raw.cuts);assert.equal(s.cuts,raw.cuts.length);assert.ok(s.avgCut>.4&&s.avgCut<1.6);
 assert.equal(CUT_DEFAULTS.ghostAmount,.2);
});
