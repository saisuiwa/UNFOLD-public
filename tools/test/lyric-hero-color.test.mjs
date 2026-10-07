import test from 'node:test';
import assert from 'node:assert/strict';
import {compileLyricScene} from '../../app/lyric-scene.js';
const scene=runs=>compileLyricScene({runs,start:0,end:6,motion:{emphasisColor:'#d9f878',recipe:{version:1,layout:'poster'}}},{width:1280,height:720,measure:(t,size)=>t.length*size});
test('poster hero inherits the selected first glyph color',()=>{const s=scene([{text:'ま',color:'#ff0000'},{text:'われ'}]);assert.equal(s.hero,'ま');assert.equal(s.heroColor,'#ff0000');});
test('poster hero uses the chosen emphasized glyph and its word color',()=>{const s=scene([{text:'まわれ '},{text:'世界',emphasis:true,color:'#00aaff'}]);assert.equal(s.hero,'世');assert.equal(s.heroColor,'#00aaff');});
test('uncolored poster hero keeps the existing accent color',()=>{assert.equal(scene([{text:'まわれ'}]).heroColor,'#d9f878');});
test('a repeated glyph later in the lyric does not recolor the first hero',()=>{assert.equal(scene([{text:'まわれ '},{text:'ま',color:'#ff0000'}]).heroColor,'#d9f878');});
