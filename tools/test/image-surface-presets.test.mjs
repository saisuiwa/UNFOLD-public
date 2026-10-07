import test from 'node:test';
import assert from 'node:assert/strict';
import {IMAGE_METHOD_PRESETS} from '../../app/image-method-presets.js';
import {cleanImageCode} from '../../app/image-method-format.js';
import {buildMethodFile,parseMethodFile} from '../../app/method-file.js';
const names=['焦げ穴と炎','インクのにじみ','水彩の溶け出し','凍結と霜','電撃で消失','酸の侵食','絵の具が垂れる','紙が風化する'];
test('eight editable surface effects can be shared as valid image methods',()=>{
 const effects=IMAGE_METHOD_PRESETS.filter(x=>names.includes(x.name));
 assert.equal(effects.length,8);
 for(const effect of effects){assert.equal(effect.previewShape,'none');assert.deepEqual(cleanImageCode(effect.code),effect.code);assert.doesNotThrow(()=>new Function('api',effect.code.source));}
 const records=effects.map((p,i)=>({...p,id:'im-surface-test-'+i}));
 const result=parseMethodFile(buildMethodFile(records));assert.deepEqual(result.problems,[]);assert.equal(result.methods.length,8);
 result.methods.forEach((m,i)=>assert.equal(m.code.source,effects[i].code.source));
});
